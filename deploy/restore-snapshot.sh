#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Execute com sudo: sudo bash deploy/restore-snapshot.sh [caminho_do_dump]" >&2
  exit 1
fi

ROOT="${NEXUS_ROOT:-/opt/nexus-erp}"
BACKUP_DIR="$ROOT/shared/backups"

DUMP_FILE="${1:-}"

if [[ -z "$DUMP_FILE" ]]; then
  LATEST_DUMP="$(ls -t "$BACKUP_DIR"/*.dump 2>/dev/null | head -n 1 || true)"
  if [[ -z "$LATEST_DUMP" ]]; then
    echo "Nenhum arquivo .dump encontrado em $BACKUP_DIR." >&2
    exit 1
  fi
  DUMP_FILE="$LATEST_DUMP"
fi

if [[ ! -f "$DUMP_FILE" ]]; then
  echo "Arquivo de backup não encontrado: $DUMP_FILE" >&2
  exit 1
fi

echo "Restaurando o banco de dados nexus_erp a partir de: $DUMP_FILE"
ACTIVE="$(cat "$ROOT/active-slot" 2>/dev/null || echo "blue")"
systemctl stop "nexus-erp@$ACTIVE.service" || true

runuser -u postgres -- psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'nexus_erp' AND pid <> pg_backend_pid();" 2>/dev/null || true
runuser -u postgres -- dropdb nexus_erp 2>/dev/null || true
runuser -u postgres -- createdb --owner=nexus_erp nexus_erp
runuser -u postgres -- pg_restore --dbname=nexus_erp --no-owner --no-privileges "$DUMP_FILE" || true
runuser -u postgres -- psql -c "ALTER ROLE nexus_erp WITH BYPASSRLS;" 2>/dev/null || true

systemctl start "nexus-erp@$ACTIVE.service"
echo "Restauração do banco concluída com sucesso!"
