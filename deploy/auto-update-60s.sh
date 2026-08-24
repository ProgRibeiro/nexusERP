#!/usr/bin/env bash
set -Eeuo pipefail

# Script autônomo do robô de atualização contínua (loop a cada 60 segundos)
# Funciona em qualquer servidor Linux, macOS ou VPS Hostinger.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_SOURCE="$(cd "$SCRIPT_DIR/.." && pwd)"
SOURCE="${NEXUS_SOURCE:-$DEFAULT_SOURCE}"
DEFAULT_ROOT="$(cd "$SOURCE/.." && pwd)"
ROOT="${NEXUS_ROOT:-$DEFAULT_ROOT}"
BRANCH="${DEPLOY_BRANCH:-main}"
LOG_FILE="${NEXUS_LOG:-$ROOT/shared/auto-update-60s.log}"
INTERVAL="${POLL_INTERVAL:-60}"

mkdir -p "$ROOT/shared"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] [robô-atualizador] Iniciado com intervalo de ${INTERVAL}s na branch ${BRANCH}." | tee -a "$LOG_FILE"

check_and_update() {
  if [[ ! -d "$SOURCE/.git" && ! -d ".git" ]]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [robô-atualizador] [AVISO] Diretório .git não encontrado." | tee -a "$LOG_FILE"
    return 0
  fi

  local git_cmd="git"
  if [[ -d "$SOURCE/.git" ]]; then
    git_cmd="git -C $SOURCE"
  fi

  $git_cmd fetch origin "$BRANCH" --quiet 2>/dev/null || return 0

  local local_commit
  local remote_commit
  local_commit="$($git_cmd rev-parse HEAD 2>/dev/null || true)"
  remote_commit="$($git_cmd rev-parse "origin/$BRANCH" 2>/dev/null || true)"

  if [[ -n "$local_commit" && -n "$remote_commit" && "$local_commit" != "$remote_commit" ]]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [robô-atualizador] 🚀 Nova atualização detectada em origin/${BRANCH}!" | tee -a "$LOG_FILE"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [robô-atualizador] Commit local: ${local_commit:0:7} -> Remoto: ${remote_commit:0:7}" | tee -a "$LOG_FILE"

    if [[ -f "$SOURCE/deploy/update-linux.sh" && "${EUID:-1000}" -eq 0 ]]; then
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] [robô-atualizador] Executando deploy seguro blue/green..." | tee -a "$LOG_FILE"
      bash "$SOURCE/deploy/update-linux.sh" >> "$LOG_FILE" 2>&1 || true
    else
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] [robô-atualizador] Realizando git pull e recompilação..." | tee -a "$LOG_FILE"
      $git_cmd pull origin "$BRANCH" --quiet >> "$LOG_FILE" 2>&1
      
      if command -v pm2 >/dev/null 2>&1; then
        pm2 reload ecosystem.config.cjs --env production >> "$LOG_FILE" 2>&1 || pm2 reload all >> "$LOG_FILE" 2>&1 || true
      fi
    fi
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [robô-atualizador] ✅ Atualização aplicada com sucesso!" | tee -a "$LOG_FILE"
  fi
}

# Se for passado o parâmetro --once, roda 1 única vez e sai
if [[ "${1:-}" == "--once" ]]; then
  check_and_update
  exit 0
fi

# Loop contínuo a cada 60s
while true; do
  check_and_update
  sleep "$INTERVAL"
done
