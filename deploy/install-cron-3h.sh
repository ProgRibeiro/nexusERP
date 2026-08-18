#!/usr/bin/env bash
set -Eeuo pipefail

# Script para instalar o agendador crontab de 3 horas em servidores Linux / macOS
# Execução a cada 3 horas (00:00, 03:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00)

ROOT="${NEXUS_ROOT:-/opt/nexus-erp}"
SOURCE="${NEXUS_SOURCE:-$ROOT/source}"
SCRIPT_PATH="$SOURCE/deploy/update-linux.sh"
LOG_PATH="$ROOT/shared/auto-update-3h.log"

if [[ ! -f "$SCRIPT_PATH" ]]; then
  SCRIPT_PATH="$(dirname "$(readlink -f "$0")")/update-linux.sh"
fi

CRON_JOB="0 */3 * * * sudo bash $SCRIPT_PATH >> $LOG_PATH 2>&1"

echo "Configurando crontab para atualização autônoma a cada 3 horas..."

(crontab -l 2>/dev/null | grep -v "$SCRIPT_PATH" || true; echo "$CRON_JOB") | crontab -

echo "✔ Crontab configurado com sucesso!"
echo "Linha adicionada: $CRON_JOB"
echo "Logs de atualização serão gravados em: $LOG_PATH"
