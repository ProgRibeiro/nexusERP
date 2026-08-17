#!/usr/bin/env bash
# ==============================================================================
# SCRIPT DE BACKUP AUTOMÁTICO DO BANCO E DADOS PERMANENTES DO NEXUS ERP
# Instalar em: /usr/local/bin/backup-nexus-erp (chmod +x)
# ==============================================================================

set -euo pipefail

BACKUP_DIR="/var/backups/nexus-erp"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/nexus_erp_backup_${TIMESTAMP}.tar.gz"
TEMP_SQL="/tmp/nexus_db_${TIMESTAMP}.sql"
DB_NAME="nexus_erp"

echo "[BACKUP] Iniciando rotina de backup..."

# Extrair credenciais do arquivo de variáveis de ambiente
DB_PASS=$(grep "ConnectionStrings__DefaultConnection" /etc/nexus-erp/nexus-erp.env | sed -n 's/.*Password=\([^;]*\);.*/\1/p')
DB_USER=$(grep "ConnectionStrings__DefaultConnection" /etc/nexus-erp/nexus-erp.env | sed -n 's/.*Username=\([^;]*\);.*/\1/p')

# 1. Executar pg_dump do banco PostgreSQL
PGPASSWORD="${DB_PASS}" pg_dump -h 127.0.0.1 -U "${DB_USER}" -d "${DB_NAME}" -F p > "${TEMP_SQL}"

# 2. Compactar o Dump do Banco + Arquivos Persistentes (/var/lib/nexus-erp)
tar -czf "${BACKUP_FILE}" -C /tmp "nexus_db_${TIMESTAMP}.sql" -C /var/lib nexus-erp

# Limpar o arquivo SQL temporário
rm -f "${TEMP_SQL}"

# Proteger o arquivo de backup (permissão restrita)
chmod 600 "${BACKUP_FILE}"

echo "[OK] Backup criado com sucesso em: ${BACKUP_FILE}"

# 3. Exclusão automática dos backups locais com mais de 15 dias
find "${BACKUP_DIR}" -type f -name "nexus_erp_backup_*.tar.gz" -mtime +15 -delete
echo "[OK] Limpeza de backups com mais de 15 dias realizada."
