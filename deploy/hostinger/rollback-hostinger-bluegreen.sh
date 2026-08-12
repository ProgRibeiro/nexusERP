#!/usr/bin/env bash
set -Eeuo pipefail

APP_ROOT="${APP_ROOT:-/var/www/nexus-erp}"
ACTIVE_SLOT_FILE="${ACTIVE_SLOT_FILE:-$APP_ROOT/active-slot}"
UPSTREAM_FILE="${UPSTREAM_FILE:-/etc/nginx/conf.d/nexus-erp-upstream.conf}"

BLUE_PORT="3001"
GREEN_PORT="3002"

if [[ ! -f "$ACTIVE_SLOT_FILE" ]]; then
  echo "Arquivo active-slot nao encontrado em $ACTIVE_SLOT_FILE" >&2
  exit 1
fi

CURRENT="$(cat "$ACTIVE_SLOT_FILE")"
if [[ "$CURRENT" == "blue" ]]; then
  TARGET="green"
  TARGET_PORT="$GREEN_PORT"
else
  TARGET="blue"
  TARGET_PORT="$BLUE_PORT"
fi

cat > "$UPSTREAM_FILE" <<EOF
upstream nexus_erp_backend {
    server 127.0.0.1:${TARGET_PORT};
    keepalive 64;
}
EOF

nginx -t
systemctl reload nginx
echo "$TARGET" > "$ACTIVE_SLOT_FILE"

echo "Rollback concluido. Slot ativo: $TARGET"
