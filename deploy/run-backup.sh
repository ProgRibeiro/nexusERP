#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${NEXUS_ROOT:-/opt/nexus-erp}"
TYPE="${1:-hourly}"
ACTIVE_SLOT="$(cat "$ROOT/active-slot" 2>/dev/null || true)"

if [[ "$ACTIVE_SLOT" != "blue" && "$ACTIVE_SLOT" != "green" ]]; then
  echo "Nenhum slot ativo encontrado em $ROOT/active-slot" >&2
  exit 1
fi

cd "$ROOT/slots/$ACTIVE_SLOT"
exec /usr/bin/npx --no-install tsx scripts/backup-db.ts "--type=$TYPE"
