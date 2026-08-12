#!/usr/bin/env bash
set -Eeuo pipefail

# Deploy para VPS Hostinger usando release current + PM2.
# Ajuste os caminhos abaixo para o seu servidor.
APP_ROOT="${APP_ROOT:-/var/www/nexus-erp}"
REPO_DIR="${REPO_DIR:-$APP_ROOT/repo}"
CURRENT_LINK="${CURRENT_LINK:-$APP_ROOT/current}"
RELEASES_DIR="${RELEASES_DIR:-$APP_ROOT/releases}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
BRANCH="${BRANCH:-agent/erp-beta-linux}"
PM2_APP_NAME="${PM2_APP_NAME:-nexus-erp}"
APP_DOMAIN="${APP_DOMAIN:-erp.seudominio.com.br}"

mkdir -p "$APP_ROOT" "$RELEASES_DIR" /var/log/nexus-erp

if [[ ! -d "$REPO_DIR/.git" ]]; then
  echo "Repositorio nao encontrado em $REPO_DIR" >&2
  echo "Clone antes: git clone <url> $REPO_DIR" >&2
  exit 1
fi

command -v node >/dev/null 2>&1 || { echo "Node.js nao encontrado" >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm nao encontrado" >&2; exit 1; }
command -v pm2 >/dev/null 2>&1 || { echo "pm2 nao encontrado. Instale com: npm i -g pm2" >&2; exit 1; }

pushd "$REPO_DIR" >/dev/null

echo "[1/8] Atualizando codigo..."
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

RELEASE_ID="$(date +%Y%m%d%H%M%S)-$(git rev-parse --short HEAD)"
RELEASE_PATH="$RELEASES_DIR/$RELEASE_ID"


echo "[2/8] Criando release $RELEASE_ID..."
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

echo "[3/8] Instalando dependencias..."
npm ci

echo "[4/8] Gerando Prisma Client..."
npm run prisma:generate

echo "[5/8] Aplicando migrations..."
npm run prisma:deploy

echo "[6/8] Build de producao..."
npm run build

popd >/dev/null


echo "[7/8] Ativando nova release..."
ln -sfn "$RELEASE_PATH" "$CURRENT_LINK"

if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
  pm2 reload "$CURRENT_LINK/ecosystem.config.cjs" --update-env
else
  pm2 start "$CURRENT_LINK/ecosystem.config.cjs" --env production
fi
pm2 save


echo "[8/8] Limpando releases antigas..."
ls -1dt "$RELEASES_DIR"/* 2>/dev/null | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -rf

popd >/dev/null

echo
HOST="${APP_BASE_URL:-https://$APP_DOMAIN}"
echo "Deploy finalizado."
echo "Healthcheck: $HOST/api/health"
