-- 도배장이 — Supabase 최초 설정
--
-- 이 파일은 supabase/migrations/ 의 파일들을 순서대로 합친 것이다.
-- 직접 고치지 말 것. 마이그레이션을 고친 뒤 `npm run db:bundle`로 다시 만든다.
--
-- 쓰는 법: Supabase 대시보드 → SQL Editor → 전체 복사해서 붙여넣고 Run


-- ==================================================================
-- 0001_init.sql
-- ==================================================================

-- 도배 업무관리 v0 스키마
--
-- 처음부터 owner_id + RLS로 잡아둔다. 나중에 직원 계정이 늘어나도
-- 테이블을 갈아엎지 않고 정책만 확장하면 되기 때문이다.

create type site_status as enum (
  'inquiry',      -- 문의
  'quoted',       -- 견적발송
  'confirmed',    -- 계약확정
  'in_progress',  -- 시공중
  'done'          -- 완료
);

create type area_basis as enum ('supply', 'exclusive');

create type wallpaper_kind as enum ('silk', 'wide', 'narrow');

create table public.sites (
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

create index sites_owner_created_idx on public.sites (owner_id, created_at desc);
create index sites_owner_scheduled_idx on public.sites (owner_id, scheduled_on);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger sites_touch_updated_at
  before update on public.sites
  for each row execute function public.touch_updated_at();

-- 본인 현장만 보이고 본인 현장만 고칠 수 있다.
alter table public.sites enable row level security;

create policy "본인 현장 조회" on public.sites
  for select using (auth.uid() = owner_id);

create policy "본인 현장 등록" on public.sites
  for insert with check (auth.uid() = owner_id);

create policy "본인 현장 수정" on public.sites
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "본인 현장 삭제" on public.sites
  for delete using (auth.uid() = owner_id);

-- ==================================================================
-- 0002_estimates.sql
-- ==================================================================

-- 견적 이력
--
-- input(입력)과 result(계산 결과)를 둘 다 남긴다.
-- input만 저장하면 나중에 견적 엔진이나 기본 단가를 손볼 때 과거 견적
-- 금액이 조용히 바뀐다. 고객에게 이미 보낸 견적서가 다른 금액이 되는 건
-- 있을 수 없으므로, 계산 결과를 그 시점 그대로 박아 둔다.

-- 차수 카운터. max(version) + 1로 매기면 중간 차수를 지웠을 때 번호가
-- 재사용된다 — 이미 보낸 "2차 견적"이 나중에 다른 견적을 가리키게 된다.
-- 현장마다 마지막 번호를 들고 있으면 삭제와 무관하게 계속 올라간다.
alter table public.sites
  add column last_estimate_version integer not null default 0;

create table public.estimates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  site_id uuid not null references public.sites (id) on delete cascade,
  created_at timestamptz not null default now(),

  -- 현장 안에서의 차수 (1차, 2차…)
  version integer not null check (version > 0),
  label text,
  memo text,

  input jsonb not null,
  result jsonb not null,
  total integer not null check (total >= 0),

  -- 차수가 겹치면 어느 게 "2차 견적"인지 알 수 없게 된다.
  unique (site_id, version)
);

create index estimates_site_version_idx
  on public.estimates (site_id, version desc);

alter table public.estimates enable row level security;

create policy "본인 견적 조회" on public.estimates
  for select using (auth.uid() = owner_id);

create policy "본인 견적 등록" on public.estimates
  for insert with check (auth.uid() = owner_id);

create policy "본인 견적 삭제" on public.estimates
  for delete using (auth.uid() = owner_id);

-- 견적은 한 번 저장하면 고치지 않는다. 값을 바꿔야 하면 새 차수를 만든다.
-- update 정책을 일부러 만들지 않았다.

/**
 * 차수를 매기면서 견적을 저장한다.
 *
 * sites.last_estimate_version을 update ... returning으로 올린다. 그 행이
 * 잠기므로 동시에 두 건이 저장돼도 같은 번호가 나오지 않고, 삭제된 번호를
 * 다시 쓰지도 않는다.
 *
 * SECURITY INVOKER(기본값)로 둔다. 호출자 권한으로 돌아야 RLS가 걸린다.
 */
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

-- ==================================================================
-- 0003_estimate_sharing.sql
-- ==================================================================

-- 견적서 공개 링크
--
-- 고객은 로그인하지 않는다. 그래서 RLS를 그대로 두면 공개 견적서를 읽을 수
-- 없다. 테이블에 anon 읽기 정책을 열어 주는 건 위험하므로(정책 조건을
-- 잘못 쓰면 전부 새어나간다), 열쇠로만 한 건을 꺼내는 함수를 따로 만들고
-- 그 함수만 anon에게 준다.

-- 공유 열쇠를 만들 때 gen_random_bytes를 쓴다. pgcrypto에 들어 있고
-- Supabase 프로젝트에는 이미 켜져 있지만, 없는 환경을 대비해 확인한다.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

alter table public.estimates
  add column share_token text unique
    check (share_token is null or length(share_token) >= 32);

comment on column public.estimates.share_token is
  '고객용 공개 링크의 열쇠. null이면 공유가 꺼진 상태. 링크를 아는 사람은 누구나 볼 수 있다.';

/**
 * 열쇠로 공개 견적서 한 건을 꺼낸다.
 *
 * SECURITY DEFINER라 RLS를 우회한다. 그만큼 조심해야 해서:
 *  - 조건은 share_token 정확 일치 하나뿐이다
 *  - 돌려주는 컬럼을 명시적으로 고른다. memo(내부 메모), owner_id,
 *    연락처는 내보내지 않는다
 *  - search_path를 고정해 함수 안의 이름이 가로채이지 않게 한다
 */
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

/**
 * 공개 링크를 켠다. 이미 켜져 있으면 기존 열쇠를 그대로 돌려준다 —
 * 고객에게 이미 보낸 링크가 다시 공유했다는 이유로 죽으면 안 된다.
 *
 * SECURITY INVOKER(기본값)이라 RLS가 그대로 걸린다.
 *
 * search_path를 고정한다. gen_random_bytes는 pgcrypto에 있고 Supabase는
 * 그걸 extensions 스키마에 둔다. 호출자의 search_path에 기대면 설정이 조금만
 * 달라도 "function gen_random_bytes does not exist"로 죽는다.
 * (public도 넣어 둔다. pgcrypto를 public에 설치한 프로젝트도 있다.)
 */
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

-- 공개 링크를 켜고 끄려면 update가 필요하다. 0002에서는 견적을 고치지
-- 않는다는 전제로 update 정책을 아예 만들지 않았는데, share_token만은 예외다.
create policy "본인 견적 공유 설정" on public.estimates
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- RLS는 행 단위라 "share_token만 고칠 수 있다"를 표현하지 못한다. 정책만
-- 열어 두면 저장된 result를 고쳐 쓸 수 있게 되어, 견적 스냅샷이 변하지
-- 않는다는 전제가 깨진다. 컬럼 권한으로 막는다.
revoke update on public.estimates from anon, authenticated;
grant update (share_token) on public.estimates to authenticated;

-- ==================================================================
-- 0004_settings.sql
-- ==================================================================

-- 사용자별 단가표
--
-- 코드의 DEFAULTS는 "아무것도 설정하지 않았을 때의 출발점"으로 남고,
-- 여기 저장된 값이 실제 견적에 쓰인다.
--
-- 컬럼을 하나하나 만들지 않고 jsonb 한 칸에 넣는다. 항목이 계속 늘 텐데
-- (벽지 종류 추가, 계수 추가) 그때마다 마이그레이션을 붙이는 것보다
-- 앱에서 기본값으로 채우는 편이 낫다. 이 값으로 검색하거나 집계할 일도 없다.

create table public.settings (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create trigger settings_touch_updated_at
  before update on public.settings
  for each row execute function public.touch_updated_at();

alter table public.settings enable row level security;

create policy "본인 단가표 조회" on public.settings
  for select using (auth.uid() = owner_id);

create policy "본인 단가표 등록" on public.settings
  for insert with check (auth.uid() = owner_id);

create policy "본인 단가표 수정" on public.settings
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
