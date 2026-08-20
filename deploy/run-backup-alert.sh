#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${NEXUS_ROOT:-/opt/nexus-erp}"
STATUS="${1:-warning}"
SUMMARY="${2:-Backup em estado de atenção.}"

if [[ "$STATUS" != "ok" && "$STATUS" != "warning" && "$STATUS" != "critical" ]]; then
  STATUS="warning"
fi

cd "$ROOT/slots/$(cat "$ROOT/active-slot" 2>/dev/null || echo blue)" 2>/dev/null || true
/usr/bin/npx --no-install tsx scripts/backup-alert.ts --status="$STATUS" --summary="$SUMMARY"
