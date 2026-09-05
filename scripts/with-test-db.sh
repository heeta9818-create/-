#!/usr/bin/env bash
# 임시 Postgres를 띄우고, DATABASE_URL을 채운 채로 넘겨받은 명령을 실행한다.
# 끝나면 클러스터를 지운다. 남는 것 없음.
#
#   ./scripts/with-test-db.sh npx vitest run supabase/test
#
# POSTGREST_BIN 을 지정하면 PostgREST도 함께 띄운다. 그러면 supabase-js가
# 실제로 주고받는 부분(저장소 코드)까지 검증한다. 없으면 그 묶음은 건너뛴다.
#   POSTGREST_BIN=/path/to/postgrest ./scripts/with-test-db.sh npm test
set -euo pipefail

PG_BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
PORT="${PGTESTPORT:-55432}"
# initdb는 root로 못 돌린다. root라면 postgres 계정을 빌린다.
PGUSER_SYS="${PGUSER_SYS:-postgres}"
DATADIR="${PGTESTDATA:-/var/lib/postgresql/dobae-test-$$}"

if [ ! -x "$PG_BIN/initdb" ]; then
  echo "Postgres를 찾지 못했습니다: $PG_BIN" >&2
  echo "PG_BIN 환경변수로 경로를 지정하거나 postgresql 서버 패키지를 설치하세요." >&2
  exit 1
fi

run_as() {
  if [ "$(id -u)" -eq 0 ]; then
    su "$PGUSER_SYS" -c "$1"
  else
    bash -c "$1"
  fi
}

PGRST_PID=""

cleanup() {
  if [ -n "$PGRST_PID" ]; then
    kill "$PGRST_PID" 2>/dev/null || true
    wait "$PGRST_PID" 2>/dev/null || true
  fi
  run_as "$PG_BIN/pg_ctl -D $DATADIR stop -m immediate" >/dev/null 2>&1 || true
  rm -rf "$DATADIR"
}
trap cleanup EXIT

mkdir -p "$DATADIR"
if [ "$(id -u)" -eq 0 ]; then
  chown "$PGUSER_SYS" "$DATADIR"
fi
chmod 700 "$DATADIR"

run_as "$PG_BIN/initdb -D $DATADIR -U postgres --auth=trust -E UTF8 --locale=C" >/dev/null
run_as "$PG_BIN/pg_ctl -D $DATADIR -o '-p $PORT -k /tmp -c listen_addresses=' -l $DATADIR/log start -w" >/dev/null

export DATABASE_URL="postgresql://postgres@localhost:$PORT/postgres?host=/tmp"

# --- PostgREST (선택) -------------------------------------------------------
if [ -n "${POSTGREST_BIN:-}" ] && [ -x "$POSTGREST_BIN" ]; then
  PGRST_PORT="${PGRST_PORT:-3010}"
  # 실제 Supabase 프로젝트의 JWT 비밀키 자리. 검증용이라 고정값이어도 된다.
  JWT_SECRET="${PGRST_JWT_SECRET:-dobae-local-test-secret-at-least-32-chars}"

  # "이미 있어서 건너뜁니다" 같은 NOTICE는 볼 필요 없다.
  export PGOPTIONS="-c client_min_messages=warning"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f supabase/test/preamble.sql
  for f in supabase/migrations/*.sql; do
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$f"
  done

  # PostgREST가 붙는 계정. 요청의 JWT에 적힌 역할로 갈아탄다.
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q <<SQL
do \$\$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login noinherit password 'authenticator';
  end if;
end
\$\$;
grant anon, authenticated, service_role to authenticator;
SQL

  # 설정은 실제 파일로 둔다. 프로세스 치환(<(...))으로 넘기면 PostgREST가
  # 설정을 다시 읽는 순간 그 임시 파일이 없어서 jwt-secret을 잃어버린다.
  cat >"$DATADIR/postgrest.conf" <<CONF
db-uri = "postgresql://authenticator:authenticator@localhost:$PORT/postgres?host=/tmp"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$JWT_SECRET"
server-port = $PGRST_PORT
CONF

  "$POSTGREST_BIN" "$DATADIR/postgrest.conf" >"$DATADIR/postgrest.log" 2>&1 &
  PGRST_PID=$!

  # 응답 코드가 무엇이든 HTTP로 답하면 살아 있는 것이다.
  # 루트 경로는 권한에 따라 401을 주기도 해서 -f 로 판단하면 안 된다.
  pgrst_up() {
    curl -s -o /dev/null --max-time 2 "http://localhost:$PGRST_PORT/" 2>/dev/null
  }

  for _ in $(seq 1 40); do
    if pgrst_up; then break; fi
    sleep 0.25
  done

  if ! pgrst_up; then
    echo "PostgREST가 뜨지 않았습니다:" >&2
    tail -20 "$DATADIR/postgrest.log" >&2
    exit 1
  fi

  export SUPABASE_TEST_URL="http://localhost:$PGRST_PORT"
  export SUPABASE_TEST_JWT_SECRET="$JWT_SECRET"
fi

"$@"
