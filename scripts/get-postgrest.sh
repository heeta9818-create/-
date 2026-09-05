#!/usr/bin/env bash
# PostgREST 실행 파일을 내려받는다. (선택)
#
# 있으면 `npm run test:db`가 저장소 코드까지 진짜 API에 대고 검증한다.
# 없으면 그 묶음은 건너뛰고 SQL 검증만 한다.
#
#   ./scripts/get-postgrest.sh
#   POSTGREST_BIN=.cache/postgrest npm run test:db
set -euo pipefail

VERSION="${POSTGREST_VERSION:-v12.2.3}"
DEST="${POSTGREST_DEST:-.cache}"
URL="https://github.com/PostgREST/postgrest/releases/download/$VERSION/postgrest-$VERSION-linux-static-x64.tar.xz"

if [ -x "$DEST/postgrest" ]; then
  echo "이미 있습니다: $DEST/postgrest"
  "$DEST/postgrest" --version
  exit 0
fi

mkdir -p "$DEST"
echo "내려받는 중: $URL"
curl -sSL "$URL" | tar xJ -C "$DEST"
chmod +x "$DEST/postgrest"
"$DEST/postgrest" --version
echo
echo "이제 이렇게 쓰세요:"
echo "  POSTGREST_BIN=$DEST/postgrest npm run test:db"
