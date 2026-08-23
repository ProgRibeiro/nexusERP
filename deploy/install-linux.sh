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
DOMAIN="${NEXUS_DOMAIN:-oprestador.tech}"
WWW_DOMAIN="${NEXUS_WWW_DOMAIN:-www.oprestador.tech}"
APP_DOMAIN="${NEXUS_APP_DOMAIN:-app.oprestador.tech}"
COMMERCIAL_DOMAIN="${NEXUS_COMMERCIAL_DOMAIN:-vendas.oprestador.tech}"
DEV_DOMAIN="${NEXUS_DEV_DOMAIN:-dev.oprestador.tech}"
LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@erp.local}"
ADMIN_NAME="${ADMIN_NAME:-Administrador}"
GENERATED_ADMIN_PASSWORD=false
AUTO_UPDATE="${NEXUS_AUTO_UPDATE:-false}"

for domain_name in "$DOMAIN" "$WWW_DOMAIN" "$APP_DOMAIN" "$COMMERCIAL_DOMAIN" "$DEV_DOMAIN"; do
  if [[ ! "$domain_name" =~ ^[A-Za-z0-9.-]+$ ]]; then
    echo "Domínio inválido: $domain_name" >&2
    exit 1
  fi
done

echo "[1/8] Instalando dependências do sistema..."
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get full-upgrade -y
apt-get autoremove -y
apt-get install -y build-essential ca-certificates curl fail2ban git gnupg jq nginx openssl postgresql postgresql-client postgresql-contrib python3-certbot-nginx rsync tar ufw unzip util-linux wget

if ! node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 20 || (major === 20 && minor >= 9) ? 0 : 1)' 2>/dev/null; then
  echo "Instalando Node.js 22 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

for command_name in node npm npx git nginx psql pg_dump flock curl rsync tar; do
  command -v "$command_name" >/dev/null 2>&1 || { echo "Dependência ausente: $command_name" >&2; exit 1; }
done

echo "[2/8] Criando usuário e diretórios persistentes..."
hostnamectl set-hostname nexus-erp
if ! id lucas >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash lucas
fi
usermod -aG sudo lucas
if [[ -f /root/.ssh/authorized_keys && ! -f /home/lucas/.ssh/authorized_keys ]]; then
  install -d -o lucas -g lucas -m 0700 /home/lucas/.ssh
  install -o lucas -g lucas -m 0600 /root/.ssh/authorized_keys /home/lucas/.ssh/authorized_keys
  echo "Chaves SSH atuais copiadas para lucas; valide o novo acesso antes de alterar o login root."
fi
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
  MIGRATION_DB_PASSWORD="${NEXUS_MIGRATION_DB_PASSWORD:-$(openssl rand -hex 24)}"
  BACKUP_DB_PASSWORD="${NEXUS_BACKUP_DB_PASSWORD:-$(openssl rand -hex 24)}"
  SESSION_SECRET="${SESSION_SECRET:-$(openssl rand -hex 48)}"
  # Cada instalação dedicada possui banco próprio; o tenant principal precisa
  # coincidir com o registro criado pela migration inicial de RLS.
  TENANT_ID="${TENANT_ID:-00000000-0000-4000-8000-000000000001}"
  runuser -u postgres -- psql -v ON_ERROR_STOP=1 \
    --set=db_password="$DB_PASSWORD" \
    --set=migration_password="$MIGRATION_DB_PASSWORD" \
    --set=backup_password="$BACKUP_DB_PASSWORD" <<'SQL'
SELECT 'CREATE ROLE nexus_migrate LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'nexus_migrate') \gexec
SELECT 'CREATE ROLE nexus_erp LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'nexus_erp') \gexec
SELECT 'CREATE ROLE nexus_backup LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'nexus_backup') \gexec
ALTER ROLE nexus_migrate WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD :'migration_password';
ALTER ROLE nexus_erp WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD :'db_password';
ALTER ROLE nexus_backup WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS PASSWORD :'backup_password';
SQL

  if ! runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_database WHERE datname='nexus_erp'" | grep -q 1; then
    runuser -u postgres -- createdb --owner=nexus_migrate nexus_erp
  fi

  runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d nexus_erp <<'SQL'
ALTER DATABASE nexus_erp OWNER TO nexus_migrate;
REVOKE ALL ON DATABASE nexus_erp FROM PUBLIC;
GRANT CONNECT ON DATABASE nexus_erp TO nexus_erp, nexus_backup;
GRANT USAGE ON SCHEMA public TO nexus_erp, nexus_backup;
ALTER DEFAULT PRIVILEGES FOR ROLE nexus_migrate IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nexus_erp;
ALTER DEFAULT PRIVILEGES FOR ROLE nexus_migrate IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO nexus_erp;
ALTER DEFAULT PRIVILEGES FOR ROLE nexus_migrate IN SCHEMA public GRANT SELECT ON TABLES TO nexus_backup;
SQL

  # A aplicação e o PostgreSQL compartilham a mesma VPS. A porta do banco não
  # deve aceitar conexões vindas da internet ou da rede privada.
  runuser -u postgres -- psql -v ON_ERROR_STOP=1 -c "ALTER SYSTEM SET listen_addresses = 'localhost';"
  systemctl restart postgresql

  umask 027
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
DATABASE_URL=postgresql://nexus_erp:${DB_PASSWORD}@127.0.0.1:5432/nexus_erp?schema=public
MIGRATION_DATABASE_URL=postgresql://nexus_migrate:${MIGRATION_DB_PASSWORD}@127.0.0.1:5432/nexus_erp?schema=public
BACKUP_DATABASE_URL=postgresql://nexus_backup:${BACKUP_DB_PASSWORD}@127.0.0.1:5432/nexus_erp?schema=public
TENANT_ID=${TENANT_ID}
SESSION_SECRET=${SESSION_SECRET}
ALLOW_ROLE_SWITCH=false
NEXUS_MARKETING_HOSTS=${DOMAIN},${WWW_DOMAIN}
NEXUS_APP_HOST=${APP_DOMAIN}
NEXUS_COMMERCIAL_HOST=${COMMERCIAL_DOMAIN}
NEXUS_DEV_HOST=${DEV_DOMAIN}
NEXUS_DEVELOPER_HOST=${DEV_DOMAIN}
NEXUS_MARKETING_REDIRECT_URL=https://${DOMAIN}
APP_BASE_URL=https://${APP_DOMAIN}
NEXT_PUBLIC_NEXUS_MARKETING_URL=https://${DOMAIN}
NEXT_PUBLIC_NEXUS_APP_URL=https://${APP_DOMAIN}
NEXT_PUBLIC_NEXUS_COMMERCIAL_URL=https://${COMMERCIAL_DOMAIN}
NEXT_PUBLIC_NEXUS_DEVELOPER_URL=https://${DEV_DOMAIN}
SESSION_COOKIE_DOMAIN=.${DOMAIN}
PASSWORD_RESET_WEBHOOK_URL=
BACKUP_DIR=$ROOT/shared/backups
REQUIRE_OFFSITE_BACKUP=true
BACKUP_MAX_AGE_HOURS=26
BACKUP_LOCK_MAX_MINUTES=240
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
ALERT_WEBHOOK_URL=
ALERT_WHATSAPP_WEBHOOK_URL=
ALERT_DISCORD_WEBHOOK_URL=
ALERT_SLACK_WEBHOOK_URL=
ALERT_TELEGRAM_BOT_TOKEN=
ALERT_TELEGRAM_CHAT_ID=
ALERT_EMAIL_TO=
ALERT_EMAIL_FROM=noreply@oprestador.tech
ALERT_MAIL_COMMAND=mail
# Configure uma conta PostgreSQL isolada com CREATEDB antes de habilitar o
# teste semanal. Nunca aponte esta variável para DATABASE_URL.
RESTORE_TEST_DATABASE_URL=
EOF
  chown root:root "$ENV_FILE"
  chmod 600 "$ENV_FILE"
fi

# Garante que instalações antigas sejam interrompidas para correção consciente,
# em vez de continuarem com a conta do site ignorando RLS.
if ! grep -q '^MIGRATION_DATABASE_URL=' "$ENV_FILE" || ! grep -q '^BACKUP_DATABASE_URL=' "$ENV_FILE"; then
  echo "Ambiente legado detectado em $ENV_FILE." >&2
  echo "Configure MIGRATION_DATABASE_URL e BACKUP_DATABASE_URL com contas separadas antes de continuar." >&2
  exit 1
fi

# Instalações atualizadas também precisam compartilhar a sessão entre os
# subdomínios. Preserva valores personalizados já existentes.
if ! grep -q '^SESSION_COOKIE_DOMAIN=' "$ENV_FILE"; then
  echo "SESSION_COOKIE_DOMAIN=.${DOMAIN}" >> "$ENV_FILE"
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
  "$SOURCE/deploy/run-backup-audit.sh" \
  "$SOURCE/deploy/run-backup-alert.sh" \
  "$SOURCE/deploy/run-restore-test.sh" \
  "$SOURCE/deploy/update-linux.sh" \
  "$SOURCE/deploy/update-status.sh" \
  "$SOURCE/deploy/rollback-linux.sh" \
  "$SOURCE/deploy/check-linux.sh"

sed -e "s/__NEXUS_DOMAIN__/$DOMAIN/g" \
  -e "s/__NEXUS_WWW_DOMAIN__/$WWW_DOMAIN/g" \
  -e "s/__NEXUS_APP_DOMAIN__/$APP_DOMAIN/g" \
  -e "s/__NEXUS_COMMERCIAL_DOMAIN__/$COMMERCIAL_DOMAIN/g" \
  -e "s/__NEXUS_DEV_DOMAIN__/$DEV_DOMAIN/g" \
  "$SOURCE/deploy/nginx-nexus-erp.conf" > /etc/nginx/sites-available/nexus-erp
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

# Expõe somente SSH (preservando regras locais pré-existentes ou CIDR específico) e Nginx Web.
# PostgreSQL e os slots Node continuam vinculados ao loopback e nunca devem ser liberados no firewall.
ufw default deny incoming
ufw default allow outgoing

if [[ -n "${NEXUS_SSH_ALLOWED_CIDR:-}" ]]; then
  ufw allow from "$NEXUS_SSH_ALLOWED_CIDR" to any port 22 proto tcp
elif ufw status 2>/dev/null | grep -qE '22(/tcp)?.*ALLOW'; then
  echo "Preservando regras SSH existentes do UFW..."
else
  ufw allow OpenSSH
fi
ufw allow 'Nginx Full'
ufw --force enable

cat > /etc/fail2ban/jail.d/nexus-erp.local <<'EOF'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
backend = systemd
EOF
systemctl enable --now fail2ban

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

if [[ "$GENERATED_ADMIN_PASSWORD" == "true" ]]; then
  ADMIN_CREDENTIAL_FILE="/root/nexus-erp-initial-admin.txt"
  umask 077
  printf 'Usuário: %s\nSenha inicial: %s\n' "$ADMIN_EMAIL" "$ADMIN_PASSWORD" > "$ADMIN_CREDENTIAL_FILE"
  chmod 600 "$ADMIN_CREDENTIAL_FILE"
fi

echo "[8/8] Ativando backups e verificando a instalação..."
# O health check exige ao menos uma cópia local íntegra. Criá-la agora também
# valida pg_dump, permissões, checksum e o diretório persistente.
runuser -u nexus --preserve-environment -- "$SOURCE/deploy/run-backup.sh" daily
systemctl enable --now \
  nexus-erp-backup-hourly.timer \
  nexus-erp-backup-daily.timer \
  nexus-erp-backup-weekly.timer \
  nexus-erp-backup-audit.timer \
  nexus-erp-backup-alert.timer
if grep -qE '^RESTORE_TEST_DATABASE_URL=.+$' "$ENV_FILE"; then
  systemctl enable --now nexus-erp-restore-test.timer
  echo "Teste semanal de restauração habilitado com banco isolado."
else
  systemctl disable --now nexus-erp-restore-test.timer 2>/dev/null || true
  echo "Teste de restauração desabilitado até configurar RESTORE_TEST_DATABASE_URL."
fi
if [[ "$AUTO_UPDATE" == "true" ]]; then
  systemctl enable --now nexus-erp-update.timer
  echo "Atualização automática habilitada: o Git será verificado a cada 5 minutos."
else
  systemctl disable --now nexus-erp-update.timer 2>/dev/null || true
  echo "Atualização automática desabilitada; use deploy/update-linux.sh manualmente."
fi
bash "$SOURCE/deploy/check-linux.sh"

if [[ -n "$LETSENCRYPT_EMAIL" ]]; then
  echo "Solicitando certificado HTTPS..."
  CERTBOT_DOMAINS=(-d "$DOMAIN")
  if [[ "$WWW_DOMAIN" != "$DOMAIN" ]]; then
    CERTBOT_DOMAINS+=(-d "$WWW_DOMAIN")
  fi
  for portal_domain in "$APP_DOMAIN" "$COMMERCIAL_DOMAIN" "$DEV_DOMAIN"; do
    if [[ "$portal_domain" != "$DOMAIN" && "$portal_domain" != "$WWW_DOMAIN" ]]; then
      CERTBOT_DOMAINS+=(-d "$portal_domain")
    fi
  done
  if certbot --nginx --non-interactive --agree-tos --redirect \
      --email "$LETSENCRYPT_EMAIL" "${CERTBOT_DOMAINS[@]}"; then
    certbot renew --dry-run || echo "AVISO: valide depois a renovação com: sudo certbot renew --dry-run" >&2
  else
    echo "AVISO: SSL direto não foi emitido (ou você está utilizando Cloudflare Tunnel)." >&2
  fi
else
  echo "SSL não solicitado (Cloudflare Tunnel atua na borda ou Let's Encrypt manual)."
fi


SERVER_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo
echo "O Prestador ERP instalado com sucesso."
echo "Domínio: https://$DOMAIN"
echo "Acesso local de diagnóstico: http://127.0.0.1"
echo "Usuário administrador: $ADMIN_EMAIL"
if [[ "$GENERATED_ADMIN_PASSWORD" == "true" ]]; then
  echo "Senha inicial salva com permissão 600 em /root/nexus-erp-initial-admin.txt"
else
  echo "Senha inicial: foi utilizada a senha fornecida em ADMIN_PASSWORD (não exibida)."
fi
echo "Troque a senha após o primeiro acesso e guarde /etc/nexus-erp.env em local seguro."
