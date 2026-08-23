#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Execute com sudo: sudo bash deploy/clean-reset-server.sh" >&2
  exit 1
fi

ROOT="${NEXUS_ROOT:-/opt/nexus-erp}"
ENV_FILE="/etc/nexus-erp.env"

echo "=========================================================="
echo "   RESET COMPLETO DO SERVIDOR E BANCO DE DADOS NEXUS ERP"
echo "=========================================================="
echo "ATENÇÃO: Todos os dados do banco de dados e arquivos antigos serão zerados."
echo "Um snapshot de segurança será gravado em $ROOT/shared/backups/ antes do reset."
echo

mkdir -p "$ROOT/shared/backups"
runuser -u postgres -- pg_dump --format=custom --compress=9 --no-owner --no-privileges nexus_erp > "$ROOT/shared/backups/nexus-pre-reset-$(date -u +%Y%m%d%H%M%S).dump" 2>/dev/null || true

echo "[1/5] Parando serviços do ERP..."
systemctl stop nexus-erp@blue.service nexus-erp@green.service 2>/dev/null || true
systemctl stop nexus-erp-update.timer nexus-erp-update.service 2>/dev/null || true

echo "[2/5] Recriando banco de dados PostgreSQL do zero..."
runuser -u postgres -- psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'nexus_erp' AND pid <> pg_backend_pid();" 2>/dev/null || true
runuser -u postgres -- dropdb nexus_erp 2>/dev/null || true
runuser -u postgres -- createdb --owner=nexus_migrate nexus_erp 2>/dev/null || true
runuser -u postgres -- psql -c "ALTER ROLE nexus_erp WITH LOGIN NOBYPASSRLS;" 2>/dev/null || true

echo "[3/5] Limpando releases e slots anteriores..."
rm -rf "$ROOT/releases"/* "$ROOT/slots"/* "$ROOT/active-slot" "$ROOT/.release-commit"
rm -f "$ENV_FILE" /etc/nexus-erp-blue.env /etc/nexus-erp-green.env

echo "[4/5] Executando reinstalação limpa a partir do código-fonte..."
cd "$ROOT/source"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@nexus.local}" ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin123!}" bash deploy/install-linux.sh

echo "[5/5] Reset limpo concluído com sucesso!"
