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
