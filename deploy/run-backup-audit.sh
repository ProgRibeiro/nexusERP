#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${NEXUS_ROOT:-/opt/nexus-erp}"
MAX_AGE_HOURS="${BACKUP_MAX_AGE_HOURS:-26}"

if [[ ! -d "$ROOT" ]]; then
  echo "Diretório raiz do ERP não encontrado: $ROOT" >&2
  exit 1
fi

ACTIVE_SLOT="$(cat "$ROOT/active-slot" 2>/dev/null || true)"
if [[ "$ACTIVE_SLOT" != "blue" && "$ACTIVE_SLOT" != "green" ]]; then
  echo "Nenhum slot ativo encontrado em $ROOT/active-slot" >&2
  exit 1
fi

cd "$ROOT/slots/$ACTIVE_SLOT"
export BACKUP_MAX_AGE_HOURS="$MAX_AGE_HOURS"
/usr/bin/npx --no-install tsx scripts/backup-audit.ts --max=3 --max-age-hours="$MAX_AGE_HOURS"
