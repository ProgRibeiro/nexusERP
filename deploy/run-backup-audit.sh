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
AUDIT_OUTPUT="$(/usr/bin/npx --no-install tsx scripts/backup-audit.ts --max=3 --max-age-hours="$MAX_AGE_HOURS")"
STATUS="$(node -e 'const fs=require("node:fs"); const input=fs.readFileSync(0, "utf8"); try { const data=JSON.parse(input); process.stdout.write(String(data.readiness?.status || "warning")); } catch { process.stdout.write("warning"); }' <<<"$AUDIT_OUTPUT")"

printf '%s\n' "$AUDIT_OUTPUT"

if [[ "$STATUS" == "warning" || "$STATUS" == "critical" ]]; then
  SUMMARY="$(node -e 'const fs=require("node:fs"); const input=fs.readFileSync(0, "utf8"); try { const payload=JSON.parse(input); const latest = payload.readiness?.latestBackup; const status = payload.readiness?.status || "warning"; const issues = (payload.readiness?.issues || []).join("; "); const file = latest ? latest.fileName : "nenhum backup"; const age = payload.readiness?.latestBackupAgeHours ?? "indefinida"; const summary = issues ? issues : `Último backup: ${file}; idade estimada: ${age}h`; process.stdout.write(`${status.toUpperCase()}: ${summary}`); } catch { process.stdout.write("BACKUP ALERT: verifique a auditoria de backups."); }' <<<"$AUDIT_OUTPUT")"
  /usr/bin/npx --no-install tsx scripts/backup-alert.ts --status="$STATUS" --summary="$SUMMARY" || true
fi
