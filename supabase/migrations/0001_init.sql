-- 도배 업무관리 v0 스키마
--
-- 처음부터 owner_id + RLS로 잡아둔다. 나중에 직원 계정이 늘어나도
-- 테이블을 갈아엎지 않고 정책만 확장하면 되기 때문이다.
--
-- 몇 번을 실행해도 괜찮게 써 둔다. 대시보드에 붙여넣다가 중간에 끊기거나
-- 실수로 두 번 눌렀을 때 "이미 있습니다" 오류로 막히면, 어디까지 됐는지
-- 알 수 없어 손을 못 댄다. 그냥 다시 실행하면 되는 편이 낫다.

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

-- 본인 현장만 보이고 본인 현장만 고칠 수 있다.
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
