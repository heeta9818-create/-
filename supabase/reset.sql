-- 도배장이 — 처음부터 다시 (초기화)
--
-- ⚠️ 이 앱이 만든 표를 전부 지운다. 저장된 현장·견적·단가표가 사라진다.
--    아직 실제로 쓰기 전, 설치가 꼬였을 때만 쓸 것.
--
-- 쓰는 법:
--   1) 이 파일을 SQL Editor에 붙여넣고 Run
--   2) 이어서 supabase/setup.sql 을 붙여넣고 Run
--
-- 설치가 절반만 되어 "이미 존재합니다" 오류로 막혔을 때, 어디까지 됐는지
-- 따질 것 없이 싹 지우고 다시 시작하는 게 제일 빠르다.
--
-- 로그인 계정(auth.users)은 건드리지 않는다. 가입한 계정은 그대로 남는다.

-- 함수부터. 표를 참조하고 있어서 먼저 치운다.
drop function if exists public.create_estimate(uuid, text, text, jsonb, jsonb, integer);
drop function if exists public.enable_estimate_sharing(uuid);
drop function if exists public.find_shared_estimate(text);

-- 표. cascade가 딸린 정책·인덱스·트리거까지 함께 지운다.
drop table if exists public.estimates cascade;
drop table if exists public.settings cascade;
drop table if exists public.sites cascade;

-- 표가 사라진 뒤에야 타입을 지울 수 있다.
drop type if exists site_status;
drop type if exists area_basis;
drop type if exists wallpaper_kind;

-- 갱신 시각 트리거 함수. 위 표들만 쓰던 것이다.
drop function if exists public.touch_updated_at();
