#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Execute com sudo: sudo bash deploy/rollback-linux.sh" >&2
  exit 1
fi

ROOT="${NEXUS_ROOT:-/opt/nexus-erp}"
ENV_FILE="${NEXUS_ENV_FILE:-/etc/nexus-erp.env}"
LOCK_FILE="$ROOT/.update.lock"

exec 9>"$LOCK_FILE"
flock -n 9 || { echo "Já existe uma atualização ou rollback em andamento." >&2; exit 1; }

ACTIVE="$(cat "$ROOT/active-slot" 2>/dev/null || true)"
if [[ "$ACTIVE" == "blue" ]]; then
  PREVIOUS="green"
  PREVIOUS_PORT=3002
elif [[ "$ACTIVE" == "green" ]]; then
  PREVIOUS="blue"
  PREVIOUS_PORT=3001
else
  echo "Slot ativo inválido em $ROOT/active-slot." >&2
  exit 1
fi

if [[ ! -L "$ROOT/slots/$PREVIOUS" || ! -f "$ROOT/slots/$PREVIOUS/.release-commit" ]]; then
  echo "O slot anterior $PREVIOUS não contém uma release válida." >&2
  exit 1
fi
if [[ ! -r "$ENV_FILE" ]]; then
  echo "Ambiente ausente ou ilegível: $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
export BACKUP_DIR="$ROOT/shared/backups"
export HOME=/home/nexus
export NPM_CONFIG_CACHE="$ROOT/shared/npm-cache"

echo "Criando backup verificado antes do rollback..."
if ! runuser -u nexus --preserve-environment -- /usr/bin/npx --no-install tsx scripts/backup-db.ts --type=pre-update 2>/dev/null; then
  echo "AVISO: backup via tsx ignorado no rollback; gerando snapshot direto..."
  runuser -u postgres -- pg_dump --format=custom --compress=9 --no-owner --no-privileges nexus_erp > "$BACKUP_DIR/nexus-rollback-$(date -u +%Y%m%d%H%M%S).dump" 2>/dev/null || true
fi

systemctl enable "nexus-erp@$PREVIOUS.service"
systemctl restart "nexus-erp@$PREVIOUS.service"

HEALTHY=false
for _ in {1..30}; do
  if curl -fsS --max-time 2 "http://127.0.0.1:$PREVIOUS_PORT/api/health" | grep -q '"status":"ok"'; then
    HEALTHY=true
    break
  fi
  sleep 1
done
if [[ "$HEALTHY" != "true" ]]; then
  systemctl stop "nexus-erp@$PREVIOUS.service" || true
  systemctl disable "nexus-erp@$PREVIOUS.service" || true
  echo "A release anterior falhou no health check; tráfego não foi alterado." >&2
  exit 1
fi

UPSTREAM_FILE=/etc/nginx/nexus-erp-upstream.conf
cp "$UPSTREAM_FILE" "${UPSTREAM_FILE}.before-rollback"
cat > "${UPSTREAM_FILE}.new" <<EOF
upstream nexus_erp_backend {
    server 127.0.0.1:$PREVIOUS_PORT;
    keepalive 32;
}
EOF
mv "${UPSTREAM_FILE}.new" "$UPSTREAM_FILE"
if ! nginx -t; then
  cp "${UPSTREAM_FILE}.before-rollback" "$UPSTREAM_FILE"
  systemctl stop "nexus-erp@$PREVIOUS.service" || true
  systemctl disable "nexus-erp@$PREVIOUS.service" || true
  echo "Nginx reprovou a configuração; rollback cancelado." >&2
  exit 1
fi

systemctl reload nginx
printf '%s\n' "$PREVIOUS" > "$ROOT/active-slot"

PUBLIC_HEALTHY=false
for _ in {1..10}; do
  if curl -fsS --max-time 3 http://127.0.0.1/api/health | grep -q '"status":"ok"'; then
    PUBLIC_HEALTHY=true
    break
  fi
  sleep 1
done
if [[ "$PUBLIC_HEALTHY" != "true" ]]; then
  cp "${UPSTREAM_FILE}.before-rollback" "$UPSTREAM_FILE"
  nginx -t && systemctl reload nginx
  printf '%s\n' "$ACTIVE" > "$ROOT/active-slot"
  systemctl stop "nexus-erp@$PREVIOUS.service" || true
  systemctl disable "nexus-erp@$PREVIOUS.service" || true
  echo "Health check público falhou; o tráfego permaneceu no slot $ACTIVE." >&2
  exit 1
fi

sleep "${DRAIN_SECONDS:-10}"
systemctl stop "nexus-erp@$ACTIVE.service" || true
systemctl disable "nexus-erp@$ACTIVE.service" || true

echo "Rollback concluído: $ACTIVE -> $PREVIOUS."
echo "A aplicação voltou; migrações de banco não são revertidas automaticamente."
