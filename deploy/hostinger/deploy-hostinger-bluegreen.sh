#!/usr/bin/env bash
set -Eeuo pipefail

# Blue/Green deploy para VPS Hostinger com PM2 + Nginx.
APP_ROOT="${APP_ROOT:-/var/www/nexus-erp}"
REPO_DIR="${REPO_DIR:-$APP_ROOT/repo}"
RELEASES_DIR="${RELEASES_DIR:-$APP_ROOT/releases}"
SLOTS_DIR="${SLOTS_DIR:-$APP_ROOT/slots}"
ACTIVE_SLOT_FILE="${ACTIVE_SLOT_FILE:-$APP_ROOT/active-slot}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
BRANCH="${BRANCH:-${DEPLOY_BRANCH:-main}}"
APP_DOMAIN="${APP_DOMAIN:-erp.seudominio.com.br}"
DRAIN_SECONDS="${DRAIN_SECONDS:-5}"

BLUE_PORT="3001"
GREEN_PORT="3002"
BLUE_NAME="nexus-erp-blue"
GREEN_NAME="nexus-erp-green"
UPSTREAM_FILE="${UPSTREAM_FILE:-/etc/nginx/conf.d/nexus-erp-upstream.conf}"

mkdir -p "$APP_ROOT" "$RELEASES_DIR" "$SLOTS_DIR" /var/log/nexus-erp

if [[ ! -d "$REPO_DIR/.git" ]]; then
  echo "Repositorio nao encontrado em $REPO_DIR" >&2
  echo "Clone antes: git clone <url> $REPO_DIR" >&2
  exit 1
fi

for command_name in node npm pm2 nginx curl; do
  command -v "$command_name" >/dev/null 2>&1 || { echo "Dependencia ausente: $command_name" >&2; exit 1; }
done

if [[ ! -f "$ACTIVE_SLOT_FILE" ]]; then
  echo "blue" > "$ACTIVE_SLOT_FILE"
fi

ACTIVE_SLOT="$(cat "$ACTIVE_SLOT_FILE")"
if [[ "$ACTIVE_SLOT" == "blue" ]]; then
  TARGET_SLOT="green"
  TARGET_PORT="$GREEN_PORT"
  TARGET_NAME="$GREEN_NAME"
  OLD_PORT="$BLUE_PORT"
  OLD_NAME="$BLUE_NAME"
else
  TARGET_SLOT="blue"
  TARGET_PORT="$BLUE_PORT"
  TARGET_NAME="$BLUE_NAME"
  OLD_PORT="$GREEN_PORT"
  OLD_NAME="$GREEN_NAME"
fi

pushd "$REPO_DIR" >/dev/null

echo "[1/10] Atualizando codigo ($BRANCH)..."
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

RELEASE_ID="$(date +%Y%m%d%H%M%S)-$(git rev-parse --short HEAD)"
RELEASE_PATH="$RELEASES_DIR/$RELEASE_ID"


echo "[2/10] Criando release $RELEASE_ID..."
mkdir -p "$RELEASE_PATH"
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete \
    --exclude .git \
    --exclude node_modules \
    --exclude .next \
    "$REPO_DIR/" "$RELEASE_PATH/"
else
  cp -R "$REPO_DIR/." "$RELEASE_PATH/"
  rm -rf "$RELEASE_PATH/.git" "$RELEASE_PATH/node_modules" "$RELEASE_PATH/.next"
fi

pushd "$RELEASE_PATH" >/dev/null

echo "[3/10] Instalando dependencias..."
npm ci

echo "[4/10] Prisma generate..."
npm run prisma:generate

echo "[5/10] Prisma deploy..."
npm run prisma:deploy

echo "[6/10] Build de producao..."
npm run build

popd >/dev/null

SLOT_PATH="$SLOTS_DIR/$TARGET_SLOT"
ln -sfn "$RELEASE_PATH" "$SLOT_PATH"


echo "[7/10] Subindo slot $TARGET_SLOT ($TARGET_NAME:$TARGET_PORT)..."
pm2 delete "$TARGET_NAME" >/dev/null 2>&1 || true
pm2 start node_modules/next/dist/bin/next \
  --name "$TARGET_NAME" \
  --cwd "$SLOT_PATH" \
  -- start -p "$TARGET_PORT"


echo "[8/10] Healthcheck interno do novo slot..."
for attempt in {1..30}; do
  if curl -fsS "http://127.0.0.1:${TARGET_PORT}/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
  if [[ "$attempt" -eq 30 ]]; then
    echo "Falha no healthcheck do novo slot" >&2
    pm2 logs "$TARGET_NAME" --lines 100 || true
    exit 1
  fi
done


echo "[9/10] Trocando upstream Nginx para $TARGET_SLOT..."
cat > "$UPSTREAM_FILE" <<EOF
upstream nexus_erp_backend {
    server 127.0.0.1:${TARGET_PORT};
    keepalive 64;
}
EOF
nginx -t
systemctl reload nginx

sleep "$DRAIN_SECONDS"

echo "$TARGET_SLOT" > "$ACTIVE_SLOT_FILE"

# Mantem o slot antigo por seguranca para rollback rapido.
pm2 save


echo "[10/10] Limpando releases antigas..."
ls -1dt "$RELEASES_DIR"/* 2>/dev/null | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -rf

popd >/dev/null

echo
HOST="${APP_BASE_URL:-https://$APP_DOMAIN}"
echo "Blue/Green deploy finalizado."
echo "Slot ativo: $TARGET_SLOT"
echo "Slot anterior mantido: $ACTIVE_SLOT"
echo "Healthcheck: $HOST/api/health"
echo "Rollback rapido: APP_ROOT=$APP_ROOT bash deploy/hostinger/rollback-hostinger-bluegreen.sh"
