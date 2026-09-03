#!/usr/bin/env bash
# 임시 Postgres를 띄우고, DATABASE_URL을 채운 채로 넘겨받은 명령을 실행한다.
# 끝나면 클러스터를 지운다. 남는 것 없음.
#
#   ./scripts/with-test-db.sh npx vitest run supabase/test
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

cleanup() {
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
"$@"
