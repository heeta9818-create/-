-- 로컬 검증용 Supabase 흉내내기
--
-- 실제 DB에는 넣지 않는다. Supabase 프로젝트가 기본으로 갖고 있는 것들을
-- 로컬 Postgres에 만들어 두고, 그 위에서 마이그레이션을 돌려 보기 위한 파일이다.
-- 여기가 실제와 다르면 검증이 헛것이 되므로, 바꿀 때는 Supabase 문서를 확인할 것.

-- gen_random_bytes(공유 열쇠 생성)가 pgcrypto에 들어 있다.
-- Supabase는 이 확장을 extensions 스키마에 설치한다.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- PostgREST가 요청마다 갈아타는 역할들.
-- 역할은 클러스터 전체에 하나뿐이라 이미 있으면 넘어간다.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;

-- Supabase는 public 스키마에 만들어지는 테이블 권한을 이 역할들에 기본으로 준다.
-- 즉 "권한으로 막혀서 안전한" 게 아니라 RLS가 유일한 방어선이다.
-- 0003의 컬럼 권한 조정이 의미가 있으려면 이 상태를 그대로 재현해야 한다.
alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on functions to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated, service_role;

-- 로그인 사용자 테이블. 실제 auth.users에는 컬럼이 훨씬 많지만
-- 우리 마이그레이션이 참조하는 건 id뿐이다.
create schema if not exists auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique
);

-- 현재 요청을 보낸 사용자의 id.
-- Supabase 정의와 같게, JWT 클레임에서 읽는다.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Supabase의 기본 search_path (extensions가 들어 있다).
-- 검증용 DB 이름은 실행할 때마다 달라지므로 현재 DB에 건다.
do $$
begin
  execute format(
    'alter database %I set search_path to %s',
    current_database(),
    '"$user", public, extensions'
  );
end
$$;
