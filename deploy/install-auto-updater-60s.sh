#!/usr/bin/env bash
set -Eeuo pipefail

# Script de instalação do Robô de Atualização Automática a cada 60 segundos
# Pode ser executado em servidores Linux (systemd / cron) ou macOS.

ROOT="${NEXUS_ROOT:-/opt/nexus-erp}"
SOURCE="${NEXUS_SOURCE:-$ROOT/source}"
SCRIPT_PATH="$SOURCE/deploy/auto-update-60s.sh"

if [[ ! -f "$SCRIPT_PATH" ]]; then
  SCRIPT_PATH="$(dirname "$(readlink -f "$0")")/auto-update-60s.sh"
fi

chmod +x "$SCRIPT_PATH" || true

echo "🤖 Instalando o Robô de Atualização Automática (60 segundos)..."

if command -v systemctl >/dev/null 2>&1 && [[ -w "/etc/systemd/system" || "${EUID:-1000}" -eq 0 ]]; then
  echo "[1/2] Copiando arquivos systemd de timer 60s..."
  cp -f "$SOURCE/deploy/nexus-erp-update.timer" /etc/systemd/system/nexus-erp-update.timer 2>/dev/null || true
  cp -f "$SOURCE/deploy/nexus-erp-update.service" /etc/systemd/system/nexus-erp-update.service 2>/dev/null || true
  systemctl daemon-reload 2>/dev/null || true
  systemctl enable nexus-erp-update.timer 2>/dev/null || true
  systemctl restart nexus-erp-update.timer 2>/dev/null || true
  echo "✔ Timer systemd a cada 60s ativado com sucesso!"
elif command -v pm2 >/dev/null 2>&1; then
  echo "[1/2] Configurando serviço contínuo no PM2..."
  pm2 start "$SCRIPT_PATH" --name "nexus-auto-updater" --interpreter bash 2>/dev/null || pm2 restart "nexus-auto-updater" 2>/dev/null || true
  pm2 save 2>/dev/null || true
  echo "✔ Robô adicionado ao PM2 com sucesso!"
else
  echo "[1/2] Adicionando execução automática ao crontab a cada minuto (* * * * *)..."
  CRON_JOB="* * * * * bash $SCRIPT_PATH --once >> $ROOT/shared/auto-update-60s.log 2>&1"
  (crontab -l 2>/dev/null | grep -v "auto-update-60s.sh" || true; echo "$CRON_JOB") | crontab -
  echo "✔ Crontab configurado para rodar a cada 60 segundos!"
fi

echo "✅ Instalação concluída! O robô verificará novas atualizações a cada 60 segundos."
