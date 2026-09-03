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
