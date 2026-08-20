#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${NEXUS_ROOT:-/opt/nexus-erp}"
ACTIVE_SLOT="$(cat "$ROOT/active-slot" 2>/dev/null || true)"
if [[ "$ACTIVE_SLOT" != "blue" && "$ACTIVE_SLOT" != "green" ]]; then
  echo "Nenhum slot ativo encontrado em $ROOT/active-slot" >&2
  exit 1
fi

cd "$ROOT/slots/$ACTIVE_SLOT"
/usr/bin/npx --no-install tsx scripts/restore-test.ts --db-url="${RESTORE_TEST_DATABASE_URL:-${DATABASE_URL:-}}"
