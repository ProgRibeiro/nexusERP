#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${NEXUS_ROOT:-/opt/nexus-erp}"
ACTIVE_SLOT="$(cat "$ROOT/active-slot" 2>/dev/null || true)"
if [[ "$ACTIVE_SLOT" != "blue" && "$ACTIVE_SLOT" != "green" ]]; then
  echo "Nenhum slot ativo encontrado em $ROOT/active-slot" >&2
  exit 1
fi

cd "$ROOT/slots/$ACTIVE_SLOT"
if [[ -z "${RESTORE_TEST_DATABASE_URL:-}" ]]; then
  echo "RESTORE_TEST_DATABASE_URL não configurada. O teste nunca usa o banco principal como fallback." >&2
  exit 1
fi
/usr/bin/npx --no-install tsx scripts/restore-test.ts --db-url="$RESTORE_TEST_DATABASE_URL"
