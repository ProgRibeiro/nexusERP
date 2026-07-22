#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Execute com sudo: sudo bash deploy/update-linux.sh" >&2
  exit 1
fi

ROOT="${NEXUS_ROOT:-/opt/nexus-erp}"
SOURCE="$ROOT/source"
RELEASES="$ROOT/releases"
SLOTS="$ROOT/slots"
SHARED="$ROOT/shared"
BRANCH="${DEPLOY_BRANCH:-main}"
ENV_FILE="${NEXUS_ENV_FILE:-/etc/nexus-erp.env}"
LOCK_FILE="$ROOT/.update.lock"

if [[ ! -r "$ENV_FILE" ]]; then
  echo "Ambiente ausente ou ilegível: $ENV_FILE" >&2
  exit 1
fi

for command_name in git node npm npx curl nginx systemctl flock; do
  command -v "$command_name" >/dev/null 2>&1 || { echo "Dependência ausente: $command_name" >&2; exit 1; }
done

mkdir -p "$RELEASES" "$SLOTS" "$SHARED/uploads" "$SHARED/backups" "$SHARED/npm-cache"
chown -R nexus:nexus "$ROOT"
exec 9>"$LOCK_FILE"
flock -n 9 || { echo "Já existe uma atualização em andamento." >&2; exit 1; }

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
export BACKUP_DIR="$SHARED/backups"
export HOME="/home/nexus"
export NPM_CONFIG_CACHE="$SHARED/npm-cache"

ACTIVE="$(cat "$ROOT/active-slot" 2>/dev/null || echo blue)"
if [[ "$ACTIVE" != "blue" && "$ACTIVE" != "green" ]]; then
  echo "Slot ativo inválido em $ROOT/active-slot: $ACTIVE" >&2
  exit 1
fi
[[ "$ACTIVE" == "blue" ]] && CANDIDATE="green" || CANDIDATE="blue"
[[ "$CANDIDATE" == "blue" ]] && CANDIDATE_PORT=3001 || CANDIDATE_PORT=3002
[[ "$ACTIVE" == "blue" ]] && ACTIVE_PORT=3001 || ACTIVE_PORT=3002

if [[ ! -d "$SOURCE/.git" ]]; then
  echo "$SOURCE precisa ser um clone Git do projeto." >&2
  exit 1
fi

git -C "$SOURCE" fetch --prune origin "$BRANCH"
NEW_COMMIT="$(git -C "$SOURCE" rev-parse "origin/$BRANCH")"
OLD_COMMIT=""
[[ -f "$SLOTS/$ACTIVE/.release-commit" ]] && OLD_COMMIT="$(cat "$SLOTS/$ACTIVE/.release-commit")"

if [[ -n "$OLD_COMMIT" && "$OLD_COMMIT" == "$NEW_COMMIT" ]]; then
  echo "O servidor já está na versão $NEW_COMMIT."
  exit 0
fi

if [[ -n "$OLD_COMMIT" ]]; then
  DANGEROUS_MIGRATIONS="$(git -C "$SOURCE" diff --name-only "$OLD_COMMIT" "$NEW_COMMIT" -- 'prisma/migrations/*/migration.sql' | while read -r file; do
    git -C "$SOURCE" show "$NEW_COMMIT:$file" 2>/dev/null | grep -Eiq 'DROP[[:space:]]+(TABLE|COLUMN)|ALTER[[:space:]].*TYPE|SET[[:space:]]+NOT[[:space:]]+NULL' && echo "$file" || true
  done)"
  if [[ -n "$DANGEROUS_MIGRATIONS" && "${ALLOW_DESTRUCTIVE_MIGRATIONS:-false}" != "true" ]]; then
    echo "Atualização bloqueada: migração potencialmente destrutiva:" >&2
    echo "$DANGEROUS_MIGRATIONS" >&2
    echo "Use migrações expand/contract ou ALLOW_DESTRUCTIVE_MIGRATIONS=true conscientemente." >&2
    exit 1
  fi
fi

if [[ -n "$OLD_COMMIT" ]]; then
  echo "Criando backup verificado antes da atualização..."
  cd "$SLOTS/$ACTIVE"
  runuser -u nexus --preserve-environment -- /usr/bin/npx --no-install tsx scripts/backup-db.ts --type=pre-update
fi

RELEASE_ID="$(date -u +%Y%m%d%H%M%S)-${NEW_COMMIT:0:12}"
RELEASE="$RELEASES/$RELEASE_ID"
git -C "$SOURCE" worktree add --detach "$RELEASE" "$NEW_COMMIT"
rm -rf "$RELEASE/public/uploads" "$RELEASE/backups"
ln -s "$SHARED/uploads" "$RELEASE/public/uploads"
ln -s "$SHARED/backups" "$RELEASE/backups"
printf '%s\n' "$NEW_COMMIT" > "$RELEASE/.release-commit"
printf 'APP_RELEASE=%s\n' "$RELEASE_ID" > "$RELEASE/.release.env"
chown -R nexus:nexus "$RELEASE" "$SHARED"

echo "Instalando e compilando a versão $RELEASE_ID fora do ar ativo..."
cd "$RELEASE"
runuser -u nexus --preserve-environment -- /usr/bin/npm ci --include=dev
runuser -u nexus --preserve-environment -- /usr/bin/npx --no-install prisma generate
runuser -u nexus --preserve-environment -- /usr/bin/npm run build
runuser -u nexus --preserve-environment -- /usr/bin/npx --no-install prisma migrate deploy

ln -sfn "$RELEASE" "$SLOTS/$CANDIDATE.next"
mv -Tf "$SLOTS/$CANDIDATE.next" "$SLOTS/$CANDIDATE"
systemctl enable "nexus-erp@$CANDIDATE.service"
systemctl restart "nexus-erp@$CANDIDATE.service"

echo "Validando o slot $CANDIDATE na porta $CANDIDATE_PORT..."
HEALTHY=false
for _ in {1..30}; do
  if curl -fsS --max-time 2 "http://127.0.0.1:$CANDIDATE_PORT/api/health" | grep -q '"status":"ok"'; then
    HEALTHY=true
    break
  fi
  sleep 1
done
if [[ "$HEALTHY" != "true" ]]; then
  systemctl stop "nexus-erp@$CANDIDATE.service" || true
  systemctl disable "nexus-erp@$CANDIDATE.service" || true
  echo "Nova versão reprovada no health check. O slot ativo não foi alterado." >&2
  exit 1
fi

UPSTREAM_FILE="/etc/nginx/nexus-erp-upstream.conf"
UPSTREAM_BACKUP="${UPSTREAM_FILE}.previous"
[[ -f "$UPSTREAM_FILE" ]] && cp "$UPSTREAM_FILE" "$UPSTREAM_BACKUP"
cat > "${UPSTREAM_FILE}.new" <<EOF
upstream nexus_erp_backend {
    server 127.0.0.1:$CANDIDATE_PORT;
    keepalive 32;
}
EOF
mv "${UPSTREAM_FILE}.new" "$UPSTREAM_FILE"
if ! nginx -t; then
  [[ -f "$UPSTREAM_BACKUP" ]] && cp "$UPSTREAM_BACKUP" "$UPSTREAM_FILE"
  systemctl stop "nexus-erp@$CANDIDATE.service" || true
  systemctl disable "nexus-erp@$CANDIDATE.service" || true
  echo "Configuração Nginx inválida; atualização revertida antes da troca." >&2
  exit 1
fi

systemctl reload nginx
printf '%s\n' "$CANDIDATE" > "$ROOT/active-slot"

PUBLIC_HEALTHY=false
for _ in {1..10}; do
  if curl -fsS --max-time 3 "http://127.0.0.1/api/health" | grep -q '"status":"ok"'; then
    PUBLIC_HEALTHY=true
    break
  fi
  sleep 1
done
if [[ "$PUBLIC_HEALTHY" != "true" ]]; then
  [[ -f "$UPSTREAM_BACKUP" ]] && cp "$UPSTREAM_BACKUP" "$UPSTREAM_FILE"
  nginx -t && systemctl reload nginx
  printf '%s\n' "$ACTIVE" > "$ROOT/active-slot"
  systemctl stop "nexus-erp@$CANDIDATE.service" || true
  systemctl disable "nexus-erp@$CANDIDATE.service" || true
  echo "Health check público falhou; o Nginx voltou ao slot $ACTIVE." >&2
  exit 1
fi
# O Nginx já envia novas conexões ao candidato. Mantém o slot anterior vivo
# por um período de drenagem para concluir requisições que estavam em curso.
sleep "${DRAIN_SECONDS:-30}"
systemctl stop "nexus-erp@$ACTIVE.service" 2>/dev/null || true
systemctl disable "nexus-erp@$ACTIVE.service" 2>/dev/null || true

echo "Atualização concluída sem interrupção: $OLD_COMMIT -> $NEW_COMMIT ($CANDIDATE)."

mapfile -t OLD_RELEASES < <(find "$RELEASES" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -rn | tail -n +6 | cut -d' ' -f2-)
for old_release in "${OLD_RELEASES[@]}"; do
  [[ "$(readlink -f "$SLOTS/blue" 2>/dev/null || true)" == "$old_release" ]] && continue
  [[ "$(readlink -f "$SLOTS/green" 2>/dev/null || true)" == "$old_release" ]] && continue
  git -C "$SOURCE" worktree remove --force "$old_release" || true
done

# Avança o clone de administração sem apagar alterações locais inesperadas.
# Se alguém editou esse clone diretamente, o merge falha com segurança.
git -C "$SOURCE" merge --ff-only "$NEW_COMMIT"
