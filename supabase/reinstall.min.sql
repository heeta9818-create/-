drop function if exists public.create_estimate(uuid, text, text, jsonb, jsonb, integer);
drop function if exists public.enable_estimate_sharing(uuid);
drop function if exists public.find_shared_estimate(text);

drop table if exists public.estimates cascade;
drop table if exists public.settings cascade;
drop table if exists public.sites cascade;

drop type if exists site_status;
drop type if exists area_basis;
drop type if exists wallpaper_kind;

drop function if exists public.touch_updated_at();

do $$
begin
  if not exists (select 1 from pg_type where typname = 'site_status') then
    create type site_status as enum (
      'inquiry',      -- 문의
      'quoted',       -- 견적발송
      'confirmed',    -- 계약확정
      'in_progress',  -- 시공중
      'done'          -- 완료
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'area_basis') then
    create type area_basis as enum ('supply', 'exclusive');
  end if;

  if not exists (select 1 from pg_type where typname = 'wallpaper_kind') then
    create type wallpaper_kind as enum ('silk', 'wide', 'narrow');
  end if;
end
$$;

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  customer_name text not null check (length(customer_name) between 1 and 100),
  phone text,
  address text,

  pyeong numeric(6, 2) not null check (pyeong > 0 and pyeong <= 500),
  area_basis area_basis not null default 'supply',
  wallpaper_kind wallpaper_kind not null default 'silk',
  include_ceiling boolean not null default true,
  patterned boolean not null default false,

  scheduled_on date,
  status site_status not null default 'inquiry',
  memo text,
  estimate_total integer not null default 0 check (estimate_total >= 0)
);

create index if not exists sites_owner_created_idx on public.sites (owner_id, created_at desc);
create index if not exists sites_owner_scheduled_idx on public.sites (owner_id, scheduled_on);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sites_touch_updated_at on public.sites;
create trigger sites_touch_updated_at
  before update on public.sites
  for each row execute function public.touch_updated_at();

alter table public.sites enable row level security;

drop policy if exists "본인 현장 조회" on public.sites;
create policy "본인 현장 조회" on public.sites
  for select using (auth.uid() = owner_id);

drop policy if exists "본인 현장 등록" on public.sites;
create policy "본인 현장 등록" on public.sites
  for insert with check (auth.uid() = owner_id);

drop policy if exists "본인 현장 수정" on public.sites;
create policy "본인 현장 수정" on public.sites
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "본인 현장 삭제" on public.sites;
create policy "본인 현장 삭제" on public.sites
  for delete using (auth.uid() = owner_id);

alter table public.sites
  add column if not exists last_estimate_version integer not null default 0;

create table if not exists public.estimates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete cascade,
  created_at timestamptz not null default now(),

  version integer not null check (version > 0),
  label text,
  memo text,

  input jsonb not null,
  result jsonb not null,
  total integer not null check (total >= 0),

  unique (site_id, version)
);

create index if not exists estimates_site_version_idx
  on public.estimates (site_id, version desc);

alter table public.estimates enable row level security;

drop policy if exists "본인 견적 조회" on public.estimates;
create policy "본인 견적 조회" on public.estimates
  for select using (auth.uid() = owner_id);

drop policy if exists "본인 견적 등록" on public.estimates;
create policy "본인 견적 등록" on public.estimates
  for insert with check (auth.uid() = owner_id);

drop policy if exists "본인 견적 삭제" on public.estimates;
create policy "본인 견적 삭제" on public.estimates
  for delete using (auth.uid() = owner_id);

create or replace function public.create_estimate(
  p_site_id uuid,
  p_label text,
  p_memo text,
  p_input jsonb,
  p_result jsonb,
  p_total integer
)
returns public.estimates
language plpgsql
as $$
declare
  v_owner uuid := auth.uid();
  v_version integer;
  v_row public.estimates;
begin
  if v_owner is null then
    raise exception '로그인이 필요합니다';
  end if;

  update public.sites
     set last_estimate_version = last_estimate_version + 1
   where id = p_site_id and owner_id = v_owner
  returning last_estimate_version into v_version;

  if v_version is null then
    raise exception '현장을 찾을 수 없습니다';
  end if;

  insert into public.estimates
    (owner_id, site_id, version, label, memo, input, result, total)
  values
    (v_owner, p_site_id, v_version, p_label, p_memo, p_input, p_result, p_total)
  returning * into v_row;

  return v_row;
end;
$$;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

alter table public.estimates
  add column if not exists share_token text unique
    check (share_token is null or length(share_token) >= 32);

comment on column public.estimates.share_token is
  '고객용 공개 링크의 열쇠. null이면 공유가 꺼진 상태. 링크를 아는 사람은 누구나 볼 수 있다.';

create or replace function public.find_shared_estimate(p_token text)
returns table (
  version integer,
  label text,
  created_at timestamptz,
  input jsonb,
  result jsonb,
  customer_name text,
  address text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    e.version,
    coalesce(e.label, ''),
    e.created_at,
    e.input,
    e.result,
    s.customer_name,
    coalesce(s.address, '')
  from public.estimates e
  join public.sites s on s.id = e.site_id
  where e.share_token = p_token
    and p_token is not null
    and length(p_token) >= 32
  limit 1;
$$;

revoke all on function public.find_shared_estimate(text) from public;
grant execute on function public.find_shared_estimate(text) to anon, authenticated;

create or replace function public.enable_estimate_sharing(p_estimate_id uuid)
returns text
language plpgsql
set search_path = public, extensions
as $$
declare
  v_token text;
begin
  select share_token into v_token
    from public.estimates
   where id = p_estimate_id
     and owner_id = auth.uid();

  if not found then
    return null;
  end if;

  if v_token is not null then
    return v_token;
  end if;

  -- 128비트 무작위. 링크를 아는 사람은 누구나 볼 수 있으므로 추측 불가능해야 한다.
  v_token := encode(gen_random_bytes(16), 'hex');

  update public.estimates
     set share_token = v_token
   where id = p_estimate_id
     and owner_id = auth.uid();

  return v_token;
end;
$$;

drop policy if exists "본인 견적 공유 설정" on public.estimates;
create policy "본인 견적 공유 설정" on public.estimates
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

revoke update on public.estimates from anon, authenticated;
grant update (share_token) on public.estimates to authenticated;

create table if not exists public.settings (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists settings_touch_updated_at on public.settings;
create trigger settings_touch_updated_at
  before update on public.settings
  for each row execute function public.touch_updated_at();

alter table public.settings enable row level security;

drop policy if exists "본인 단가표 조회" on public.settings;
create policy "본인 단가표 조회" on public.settings
  for select using (auth.uid() = owner_id);

drop policy if exists "본인 단가표 등록" on public.settings;
create policy "본인 단가표 등록" on public.settings
  for insert with check (auth.uid() = owner_id);

drop policy if exists "본인 단가표 수정" on public.settings;
create policy "본인 단가표 수정" on public.settings
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
