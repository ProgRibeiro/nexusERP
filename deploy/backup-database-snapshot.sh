#!/usr/bin/env bash
set -Eeuo pipefail

# Script de backup de emergência e proteção contínua de dados do banco de dados (Nexus ERP)

BACKUP_DIR="${NEXUS_BACKUP_DIR:-/opt/nexus-erp/backups}"
mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/nexus_erp_snapshot_${TIMESTAMP}.sql.gz"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] [backup-segurança] Gerando snapshot de proteção do banco de dados..."

if [[ -n "${DATABASE_URL:-}" ]]; then
  if command -v pg_dump >/dev/null 2>&1; then
    pg_dump "$DATABASE_URL" | gzip > "$BACKUP_FILE"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [backup-segurança] ✅ Snapshot salvo com sucesso: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
  else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [backup-segurança] [AVISO] pg_dump não encontrado no sistema. Pulando snapshot SQL."
  fi
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [backup-segurança] [AVISO] DATABASE_URL não definida em /etc/nexus-erp-update.env."
fi

# Manter os últimos 30 backups diários/de snapshot e excluir anteriores
find "$BACKUP_DIR" -name "nexus_erp_snapshot_*.sql.gz" -mtime +30 -delete 2>/dev/null || true
