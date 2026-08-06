#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Execute com sudo: sudo bash deploy/install-linux.sh" >&2
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "Instalador compatível com Ubuntu/Debian. Para outra distribuição, use DEPLOYMENT.md." >&2
  exit 1
fi

ROOT="${NEXUS_ROOT:-/opt/nexus-erp}"
SOURCE="$ROOT/source"
ENV_FILE="${NEXUS_ENV_FILE:-/etc/nexus-erp.env}"
BRANCH="${DEPLOY_BRANCH:-main}"
SERVER_NAME="${NEXUS_SERVER_NAME:-_}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@erp.local}"
ADMIN_NAME="${ADMIN_NAME:-Administrador}"
GENERATED_ADMIN_PASSWORD=false
AUTO_UPDATE="${NEXUS_AUTO_UPDATE:-false}"

if [[ ! "$SERVER_NAME" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "NEXUS_SERVER_NAME contém caracteres inválidos." >&2
  exit 1
fi

echo "[1/8] Instalando dependências do sistema..."
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git nginx openssl postgresql postgresql-client rsync tar util-linux

if ! node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 20 || (major === 20 && minor >= 9) ? 0 : 1)' 2>/dev/null; then
  echo "Instalando Node.js 22 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

for command_name in node npm npx git nginx psql pg_dump flock curl rsync tar; do
  command -v "$command_name" >/dev/null 2>&1 || { echo "Dependência ausente: $command_name" >&2; exit 1; }
done

echo "[2/8] Criando usuário e diretórios persistentes..."
if ! id nexus >/dev/null 2>&1; then
  useradd --system --create-home --home-dir /home/nexus --shell /bin/bash nexus
fi
install -d -o nexus -g nexus -m 0750 "$ROOT" "$ROOT/releases" "$ROOT/slots" "$ROOT/shared" "$ROOT/shared/uploads" "$ROOT/shared/backups" "$ROOT/shared/npm-cache"
install -d -o nexus -g www-data -m 0750 /var/cache/nexus-erp /var/cache/nexus-erp/static

echo "[3/8] Preparando PostgreSQL..."
systemctl enable --now postgresql

if [[ -f "$ENV_FILE" ]]; then
  echo "Ambiente existente preservado em $ENV_FILE."
else
  DB_PASSWORD="${NEXUS_DB_PASSWORD:-$(openssl rand -hex 24)}"
  SESSION_SECRET="${SESSION_SECRET:-$(openssl rand -hex 48)}"
  runuser -u postgres -- psql -v ON_ERROR_STOP=1 --set=db_password="$DB_PASSWORD" <<'SQL'
SELECT 'CREATE ROLE nexus_erp LOGIN' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'nexus_erp') \gexec
ALTER ROLE nexus_erp WITH LOGIN PASSWORD :'db_password';
SQL
  if ! runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_database WHERE datname='nexus_erp'" | grep -q 1; then
    runuser -u postgres -- createdb --owner=nexus_erp nexus_erp
  fi

  umask 027
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
DATABASE_URL=postgresql://nexus_erp:${DB_PASSWORD}@127.0.0.1:5432/nexus_erp?schema=public
SESSION_SECRET=${SESSION_SECRET}
ALLOW_ROLE_SWITCH=false
BACKUP_DIR=$ROOT/shared/backups
STORAGE_BUCKET=
STORAGE_REGION=us-east-1
STORAGE_ENDPOINT=
STORAGE_ACCESS_KEY_ID=
STORAGE_SECRET_ACCESS_KEY=
STORAGE_PUBLIC_URL=
STORAGE_FORCE_PATH_STYLE=false
BACKUP_BUCKET=
BACKUP_PREFIX=nexus-erp
BACKUP_REGION=us-east-1
BACKUP_ENDPOINT=
BACKUP_ACCESS_KEY_ID=
BACKUP_SECRET_ACCESS_KEY=
BACKUP_FORCE_PATH_STYLE=false
EOF
  chown root:nexus "$ENV_FILE"
  chmod 640 "$ENV_FILE"
fi

echo "[4/8] Obtendo código-fonte..."
if [[ ! -d "$SOURCE/.git" ]]; then
  REPO_URL="${NEXUS_REPO_URL:-}"
  if [[ -z "$REPO_URL" ]] && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    REPO_URL="$(git remote get-url origin 2>/dev/null || true)"
  fi
  if [[ -z "$REPO_URL" ]]; then
    echo "Informe o repositório: sudo NEXUS_REPO_URL=https://... bash deploy/install-linux.sh" >&2
    exit 1
  fi
  runuser -u nexus -- git clone --branch "$BRANCH" "$REPO_URL" "$SOURCE"
else
  echo "Clone existente preservado em $SOURCE."
fi

echo "[5/8] Instalando serviços systemd e Nginx..."
install -o root -g root -m 0644 "$SOURCE/deploy/nexus-erp@.service" /etc/systemd/system/nexus-erp@.service
install -o root -g root -m 0644 "$SOURCE/deploy/nexus-erp-blue.env" /etc/nexus-erp-blue.env
install -o root -g root -m 0644 "$SOURCE/deploy/nexus-erp-green.env" /etc/nexus-erp-green.env
install -o root -g root -m 0644 "$SOURCE/deploy/nexus-erp-update.service" /etc/systemd/system/nexus-erp-update.service
install -o root -g root -m 0644 "$SOURCE/deploy/nexus-erp-update.timer" /etc/systemd/system/nexus-erp-update.timer
if [[ ! -f /etc/nexus-erp-update.env ]]; then
  umask 027
  cat > /etc/nexus-erp-update.env <<EOF
DEPLOY_BRANCH=$BRANCH
DRAIN_SECONDS=30
EOF
  chown root:root /etc/nexus-erp-update.env
  chmod 0644 /etc/nexus-erp-update.env
fi
for unit in "$SOURCE"/deploy/nexus-erp-backup-*.service "$SOURCE"/deploy/nexus-erp-backup-*.timer; do
  install -o root -g root -m 0644 "$unit" "/etc/systemd/system/$(basename "$unit")"
done
chmod 0755 \
  "$SOURCE/deploy/run-backup.sh" \
  "$SOURCE/deploy/update-linux.sh" \
  "$SOURCE/deploy/update-status.sh" \
  "$SOURCE/deploy/rollback-linux.sh" \
  "$SOURCE/deploy/check-linux.sh"

sed "s/erp.seudominio.com.br/$SERVER_NAME/g" "$SOURCE/deploy/nginx-nexus-erp.conf" > /etc/nginx/sites-available/nexus-erp
cat > /etc/nginx/nexus-erp-upstream.conf <<'EOF'
upstream nexus_erp_backend {
    server 127.0.0.1:3001;
    keepalive 32;
}
EOF
ln -sfn /etc/nginx/sites-available/nexus-erp /etc/nginx/sites-enabled/nexus-erp
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl daemon-reload
systemctl enable --now nginx

echo "[6/8] Publicando primeira versão..."
bash "$SOURCE/deploy/update-linux.sh"

echo "[7/8] Criando administrador inicial sem dados de demonstração..."
if [[ -z "${ADMIN_PASSWORD:-}" ]]; then
  ADMIN_PASSWORD="$(openssl rand -base64 24 | tr -d '\n' | tr '/+' 'AZ')"
  GENERATED_ADMIN_PASSWORD=true
fi
ACTIVE_SLOT="$(cat "$ROOT/active-slot")"
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
runuser -u nexus --preserve-environment -- env ADMIN_EMAIL="$ADMIN_EMAIL" ADMIN_NAME="$ADMIN_NAME" ADMIN_PASSWORD="$ADMIN_PASSWORD" /usr/bin/npm --prefix "$ROOT/slots/$ACTIVE_SLOT" run admin:bootstrap

echo "[8/8] Ativando backups e verificando a instalação..."
systemctl enable --now nexus-erp-backup-hourly.timer nexus-erp-backup-daily.timer nexus-erp-backup-weekly.timer
if [[ "$AUTO_UPDATE" == "true" ]]; then
  systemctl enable --now nexus-erp-update.timer
  echo "Atualização automática habilitada: o Git será verificado a cada 5 minutos."
else
  systemctl disable --now nexus-erp-update.timer 2>/dev/null || true
  echo "Atualização automática desabilitada; use deploy/update-linux.sh manualmente."
fi
bash "$SOURCE/deploy/check-linux.sh"

SERVER_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo
echo "Nexus ERP instalado com sucesso."
echo "Acesso local: http://127.0.0.1"
[[ -n "$SERVER_IP" ]] && echo "Acesso na rede: http://$SERVER_IP"
echo "Usuário administrador: $ADMIN_EMAIL"
if [[ "$GENERATED_ADMIN_PASSWORD" == "true" ]]; then
  echo "Senha inicial (guarde agora): $ADMIN_PASSWORD"
else
  echo "Senha inicial: a senha informada em ADMIN_PASSWORD"
fi
echo "Troque a senha após o primeiro acesso e guarde /etc/nexus-erp.env em local seguro."
