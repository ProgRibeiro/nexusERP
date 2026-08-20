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
STATUS_FILE="$SHARED/update-status.json"
STATIC_ROOT="${NEXUS_STATIC_ROOT:-/var/cache/nexus-erp/static}"
SAFETY_ROOT="$SHARED/update-safety"
REQUIRE_OFFSITE_BACKUP="${REQUIRE_OFFSITE_BACKUP:-true}"

if [[ ! -r "$ENV_FILE" ]]; then
  echo "Ambiente ausente ou ilegível: $ENV_FILE" >&2
  exit 1
fi

for command_name in git node npm npx curl nginx systemctl flock rsync runuser; do
  command -v "$command_name" >/dev/null 2>&1 || { echo "Dependência ausente: $command_name" >&2; exit 1; }
done

mkdir -p "$RELEASES" "$SLOTS" "$SHARED/uploads" "$SHARED/backups" "$SHARED/npm-cache" "$SAFETY_ROOT"
install -d -o nexus -g www-data -m 0750 "$STATIC_ROOT"
chown -R nexus:nexus "$ROOT"
exec 9>"$LOCK_FILE"
flock -n 9 || { echo "Já existe uma atualização em andamento." >&2; exit 1; }

write_update_status() {
  local state="$1"
  local message="$2"
  local temporary="${STATUS_FILE}.tmp"

  STATUS_STATE="$state" \
  STATUS_MESSAGE="$message" \
  STATUS_ACTIVE_SLOT="${ACTIVE:-}" \
  STATUS_CANDIDATE_SLOT="${CANDIDATE:-}" \
  STATUS_ACTIVE_PORT="${ACTIVE_PORT:-}" \
  STATUS_CANDIDATE_PORT="${CANDIDATE_PORT:-}" \
  STATUS_FROM_COMMIT="${OLD_COMMIT:-}" \
  STATUS_TO_COMMIT="${NEW_COMMIT:-}" \
  node <<'NODE' > "$temporary"
const payload = {
  state: process.env.STATUS_STATE,
  message: process.env.STATUS_MESSAGE,
  updatedAt: new Date().toISOString(),
  activeSlot: process.env.STATUS_ACTIVE_SLOT || null,
  candidateSlot: process.env.STATUS_CANDIDATE_SLOT || null,
  activePort: process.env.STATUS_ACTIVE_PORT ? Number(process.env.STATUS_ACTIVE_PORT) : null,
  candidatePort: process.env.STATUS_CANDIDATE_PORT ? Number(process.env.STATUS_CANDIDATE_PORT) : null,
  fromCommit: process.env.STATUS_FROM_COMMIT || null,
  toCommit: process.env.STATUS_TO_COMMIT || null,
};
process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
NODE
  mv "$temporary" "$STATUS_FILE"
  chown root:nexus "$STATUS_FILE"
  chmod 0640 "$STATUS_FILE"
}

on_error() {
  local exit_code=$?
  local line="${1:-desconhecida}"
  trap - ERR
  if [[ "${SWITCHED:-false}" == "true" && -n "${UPSTREAM_BACKUP:-}" && -f "${UPSTREAM_BACKUP:-}" ]]; then
    cp "$UPSTREAM_BACKUP" "$UPSTREAM_FILE" || true
    nginx -t >/dev/null 2>&1 && systemctl reload nginx || true
    printf '%s\n' "$ACTIVE" > "$ROOT/active-slot" || true
    systemctl stop "nexus-erp@$CANDIDATE.service" 2>/dev/null || true
    systemctl enable "nexus-erp@$ACTIVE.service" 2>/dev/null || true
    systemctl restart "nexus-erp@$ACTIVE.service" 2>/dev/null || true
    write_update_status "rolled-back" "Falha inesperada na linha $line; tráfego restaurado automaticamente para a versão anterior." || true
  else
    write_update_status "failed" "Atualização interrompida na linha $line; o tráfego permaneceu na versão estável." || true
  fi
  exit "$exit_code"
}
trap 'on_error "$LINENO"' ERR

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
export BACKUP_DIR="$SHARED/backups"
export HOME="/home/nexus"
export NPM_CONFIG_CACHE="$SHARED/npm-cache"

git_nexus() {
  runuser -u nexus --preserve-environment -- /usr/bin/git -C "$SOURCE" "$@"
}

ACTIVE="$(cat "$ROOT/active-slot" 2>/dev/null || echo blue)"
SWITCHED=false
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

git_nexus fetch --prune origin "$BRANCH"
NEW_COMMIT="$(git_nexus rev-parse "origin/$BRANCH")"
OLD_COMMIT=""
[[ -f "$SLOTS/$ACTIVE/.release-commit" ]] && OLD_COMMIT="$(cat "$SLOTS/$ACTIVE/.release-commit")"

if [[ -n "$OLD_COMMIT" && "$OLD_COMMIT" == "$NEW_COMMIT" ]]; then
  write_update_status "current" "O servidor já está na versão mais recente."
  echo "O servidor já está na versão $NEW_COMMIT."
  exit 0
fi

if [[ -n "$OLD_COMMIT" ]]; then
  DANGEROUS_MIGRATIONS="$(git_nexus diff --name-only "$OLD_COMMIT" "$NEW_COMMIT" -- 'prisma/migrations/*/migration.sql' | while read -r file; do
    if ! git_nexus cat-file -e "$NEW_COMMIT:$file" 2>/dev/null; then
      echo "$file (migração removida)"
      continue
    fi
    git_nexus show "$NEW_COMMIT:$file" 2>/dev/null \
      | tr '\n' ' ' \
      | grep -Eiq 'DROP[[:space:]]+(TABLE|COLUMN|SCHEMA|TYPE)|TRUNCATE([[:space:]]+TABLE)?|DELETE[[:space:]]+FROM|ALTER[[:space:]]+TABLE.*[[:space:]]DROP[[:space:]]|ALTER[[:space:]]+TABLE.*[[:space:]]RENAME[[:space:]]|ALTER[[:space:]].*TYPE|SET[[:space:]]+NOT[[:space:]]+NULL' \
      && echo "$file" || true
  done)"
  if [[ -n "$DANGEROUS_MIGRATIONS" && "${ALLOW_DESTRUCTIVE_MIGRATIONS:-false}" != "true" ]]; then
    write_update_status "blocked" "Migração potencialmente destrutiva bloqueada antes de alterar o servidor."
    echo "Atualização bloqueada: migração potencialmente destrutiva:" >&2
    echo "$DANGEROUS_MIGRATIONS" >&2
    echo "Use migrações expand/contract ou ALLOW_DESTRUCTIVE_MIGRATIONS=true conscientemente." >&2
    exit 1
  fi
fi

if [[ -n "$OLD_COMMIT" ]]; then
  write_update_status "backup" "Criando e verificando o backup anterior à atualização."
  echo "Criando backup verificado antes da atualização..."
  cd "$SLOTS/$ACTIVE"
  runuser -u nexus --preserve-environment -- /usr/bin/npx --no-install tsx scripts/backup-db.ts --type=pre-update

  RCLONE_GATE=false
  if [[ -n "${BACKUP_RCLONE_REMOTE:-}" ]]; then
    command -v rclone >/dev/null 2>&1 || {
      write_update_status "blocked" "rclone configurado, mas o executável não está instalado."
      echo "Atualização bloqueada: rclone não está instalado." >&2
      exit 1
    }
    echo "Confirmando a terceira camada criptografada via rclone..."
    runuser -u nexus --preserve-environment -- rclone copy "$SHARED/backups" "$BACKUP_RCLONE_REMOTE"
    runuser -u nexus --preserve-environment -- rclone check "$SHARED/backups" "$BACKUP_RCLONE_REMOTE" --one-way --size-only
    RCLONE_GATE=true
  fi

  BACKUP_GATE_RESULT="$(BACKUP_DIR="$SHARED/backups" node <<'NODE'
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const directory = process.env.BACKUP_DIR;
const metadata = JSON.parse(fs.readFileSync(path.join(directory, "latest.json"), "utf8"));
const dump = path.join(directory, metadata.fileName || "");
const checksum = `${dump}.sha256`;
const digest = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const expected = fs.existsSync(checksum) ? fs.readFileSync(checksum, "utf8").trim().split(/\s+/)[0] : "";
const dumpValid = fs.existsSync(dump) && fs.statSync(dump).size >= 1024 && /^[a-f0-9]{64}$/i.test(expected) && digest(dump) === expected.toLowerCase();
const uploads = metadata.uploadsFileName ? path.join(directory, metadata.uploadsFileName) : null;
const uploadsValid = !uploads || (fs.existsSync(uploads) && (!metadata.uploadsSha256 || digest(uploads) === metadata.uploadsSha256));
const ok = metadata.type === "pre-update" && dumpValid && uploadsValid;
process.stdout.write(JSON.stringify({ ok, dumpValid, uploadsValid, remoteUploaded: metadata.remoteUploaded === true, fileName: metadata.fileName || null }));
NODE
)"
  if ! grep -q '"ok":true' <<<"$BACKUP_GATE_RESULT"; then
    write_update_status "blocked" "Backup local anterior à atualização não passou na verificação."
    echo "Atualização bloqueada: backup local íntegro não confirmado: $BACKUP_GATE_RESULT" >&2
    exit 1
  fi
  if [[ "$REQUIRE_OFFSITE_BACKUP" == "true" && "$RCLONE_GATE" != "true" ]] && ! grep -q '"remoteUploaded":true' <<<"$BACKUP_GATE_RESULT"; then
    write_update_status "blocked" "Terceira camada externa não confirmada; a versão estável foi mantida."
    echo "Atualização bloqueada: configure BACKUP_BUCKET e credenciais; cópia externa não confirmada." >&2
    exit 1
  fi

  CRITICAL_MANIFEST="$SAFETY_ROOT/${NEW_COMMIT:0:12}-before.json"
  node "$SOURCE/scripts/critical-data-manifest.mjs" capture "$CRITICAL_MANIFEST"
  if [[ -d "$SLOTS/$ACTIVE/.next/static" ]]; then
    rsync -a "$SLOTS/$ACTIVE/.next/static/" "$STATIC_ROOT/"
  fi
fi

RELEASE_ID="$(date -u +%Y%m%d%H%M%S)-${NEW_COMMIT:0:12}"
RELEASE="$RELEASES/$RELEASE_ID"
git_nexus worktree add --detach "$RELEASE" "$NEW_COMMIT"
rm -rf "$RELEASE/public/uploads" "$RELEASE/backups"
printf '%s\n' "$NEW_COMMIT" > "$RELEASE/.release-commit"
printf 'APP_RELEASE=%s\nNEXT_DEPLOYMENT_ID=%s\n' "$RELEASE_ID" "$RELEASE_ID" > "$RELEASE/.release.env"
chown -R nexus:nexus "$RELEASE" "$SHARED"

echo "Instalando e compilando a versão $RELEASE_ID fora do ar ativo..."
write_update_status "building" "Instalando dependências e compilando a nova versão na porta de upgrade."
cd "$RELEASE"
runuser -u nexus --preserve-environment -- /usr/bin/npm ci --include=dev
runuser -u nexus --preserve-environment -- /usr/bin/npx --no-install prisma generate
runuser -u nexus --preserve-environment -- env NEXT_DEPLOYMENT_ID="$RELEASE_ID" /usr/bin/npm run build

# Criar os links simbólicos das pastas compartilhadas (uploads/backups) após a compilação,
# evitando que o Turbopack analise symlinks externos durante o build.
rm -rf "$RELEASE/public/uploads" "$RELEASE/backups"
ln -s "$SHARED/uploads" "$RELEASE/public/uploads"
ln -s "$SHARED/backups" "$RELEASE/backups"
chown -h nexus:nexus "$RELEASE/public/uploads" "$RELEASE/backups" 2>/dev/null || true

# Mantém chunks com hash de releases anteriores. Assim, uma tela que já estava
# aberta durante a troca ainda consegue carregar componentes sob demanda.
rsync -a "$RELEASE/.next/static/" "$STATIC_ROOT/"

chown -R nexus:www-data "$STATIC_ROOT"
find "$STATIC_ROOT" -type d -exec chmod 0750 {} +
find "$STATIC_ROOT" -type f -exec chmod 0640 {} +
write_update_status "migrating" "Aplicando somente migrações compatíveis e aditivas no PostgreSQL."
runuser -u nexus --preserve-environment -- /usr/bin/npx --no-install prisma migrate deploy
runuser -u nexus --preserve-environment -- /usr/bin/npx --no-install prisma migrate status

# Camada lógica: uma atualização nunca pode reduzir registros ou totais dos
# domínios protegidos. Se houver divergência, a versão antiga continua ativa.
if [[ -n "${CRITICAL_MANIFEST:-}" ]]; then
  node "$RELEASE/scripts/critical-data-manifest.mjs" verify "$CRITICAL_MANIFEST"
fi

ln -sfn "$RELEASE" "$SLOTS/$CANDIDATE.next"
mv -Tf "$SLOTS/$CANDIDATE.next" "$SLOTS/$CANDIDATE"
systemctl enable "nexus-erp@$CANDIDATE.service"
systemctl restart "nexus-erp@$CANDIDATE.service"

echo "Validando o slot $CANDIDATE na porta $CANDIDATE_PORT..."
write_update_status "testing" "Nova versão isolada em teste na porta 127.0.0.1:$CANDIDATE_PORT."
HEALTHY=false
for _ in {1..30}; do
  CANDIDATE_HEALTH="$(curl -fsS --max-time 2 "http://127.0.0.1:$CANDIDATE_PORT/api/health" 2>/dev/null || true)"
  if grep -q '"status":"ok"' <<<"$CANDIDATE_HEALTH" && grep -q "\"release\":\"$RELEASE_ID\"" <<<"$CANDIDATE_HEALTH"; then
    HEALTHY=true
    break
  fi
  sleep 1
done
if [[ "$HEALTHY" != "true" ]]; then
  systemctl stop "nexus-erp@$CANDIDATE.service" || true
  systemctl disable "nexus-erp@$CANDIDATE.service" || true
  write_update_status "rejected" "Nova versão reprovada na porta de upgrade; usuários continuaram na versão anterior."
  echo "Nova versão reprovada no health check. O slot ativo não foi alterado." >&2
  exit 1
fi

UPSTREAM_FILE="/etc/nginx/nexus-erp-upstream.conf"
UPSTREAM_BACKUP="${UPSTREAM_FILE}.previous"
write_update_status "switching" "Testes aprovados; direcionando novas conexões para a nova versão."
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
  write_update_status "rejected" "Nginx recusou a configuração; usuários permaneceram na versão anterior."
  echo "Configuração Nginx inválida; atualização revertida antes da troca." >&2
  exit 1
fi

systemctl reload nginx
printf '%s\n' "$CANDIDATE" > "$ROOT/active-slot"
SWITCHED=true

PUBLIC_HEALTHY=false
for _ in {1..10}; do
  PUBLIC_HEALTH="$(curl -fsS --max-time 3 "http://127.0.0.1/api/health" 2>/dev/null || true)"
  if grep -q '"status":"ok"' <<<"$PUBLIC_HEALTH" && grep -q "\"release\":\"$RELEASE_ID\"" <<<"$PUBLIC_HEALTH"; then
    PUBLIC_HEALTHY=true
    break
  fi
  sleep 1
done
if [[ "$PUBLIC_HEALTHY" != "true" ]]; then
  [[ -f "$UPSTREAM_BACKUP" ]] && cp "$UPSTREAM_BACKUP" "$UPSTREAM_FILE"
  nginx -t && systemctl reload nginx
  printf '%s\n' "$ACTIVE" > "$ROOT/active-slot"
  SWITCHED=false
  systemctl stop "nexus-erp@$CANDIDATE.service" || true
  systemctl disable "nexus-erp@$CANDIDATE.service" || true
  write_update_status "rolled-back" "Teste público falhou; Nginx retornou automaticamente para a versão anterior."
  echo "Health check público falhou; o Nginx voltou ao slot $ACTIVE." >&2
  exit 1
fi
# O Nginx já envia novas conexões ao candidato. Mantém o slot anterior vivo
# por um período de drenagem para concluir requisições que estavam em curso.
sleep "${DRAIN_SECONDS:-30}"
systemctl stop "nexus-erp@$ACTIVE.service" 2>/dev/null || true
systemctl disable "nexus-erp@$ACTIVE.service" 2>/dev/null || true

ACTIVE="$CANDIDATE"
ACTIVE_PORT="$CANDIDATE_PORT"
SWITCHED=false
write_update_status "complete" "Atualização concluída sem interrupção e com os dados persistentes preservados."
echo "Atualização concluída sem interrupção: $OLD_COMMIT -> $NEW_COMMIT ($CANDIDATE)."

# Sela a nova versão com outro backup. O pré-update permanece disponível para
# recuperação, e este snapshot registra o estado já aprovado em produção.
cd "$SLOTS/$ACTIVE"
runuser -u nexus --preserve-environment -- /usr/bin/npx --no-install tsx scripts/backup-db.ts --type=manual || \
  echo "AVISO: snapshot pós-atualização falhou; backup pré-update foi preservado." >&2

mapfile -t OLD_RELEASES < <(find "$RELEASES" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -rn | tail -n +6 | cut -d' ' -f2-)
for old_release in "${OLD_RELEASES[@]}"; do
  [[ "$(readlink -f "$SLOTS/blue" 2>/dev/null || true)" == "$old_release" ]] && continue
  [[ "$(readlink -f "$SLOTS/green" 2>/dev/null || true)" == "$old_release" ]] && continue
  git_nexus worktree remove --force "$old_release" || true
done

# Avança o clone de administração sem apagar alterações locais inesperadas.
# Uma edição indevida no clone não invalida uma publicação já aprovada.
if ! git_nexus merge --ff-only "$NEW_COMMIT"; then
  echo "AVISO: aplicação atualizada, mas o clone de administração não avançou. Verifique $SOURCE." >&2
fi
