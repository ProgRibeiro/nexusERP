#!/usr/bin/env bash
# ==============================================================================
# SCRIPT DE SETUP INTEGRAL PARA NEXUS ERP NO UBUNTU SERVER
# Autor: DevOps Engineering Team
# Compatibilidade: Ubuntu 22.04 LTS / Ubuntu 24.04 LTS
# ==============================================================================

set -euo pipefail

# ------------------------------------------------------------------------------
# VARIÁVEIS CONFIGURÁVEIS
# ------------------------------------------------------------------------------
DOTNET_VERSION="10.0"                      # Versão do ASP.NET Core Runtime (ex: 8.0, 9.0, 10.0)
APP_DLL="NexusERP.dll"                     # !!! IMPORTANTE: Altere para o nome da DLL principal do seu projeto !!!
DOMAIN="nexusmanutencao.com"
WWW_DOMAIN="www.nexusmanutencao.com"
LETSENCRYPT_EMAIL="ALTERAR_EMAIL"           # Altere para seu e-mail real antes de rodar

DB_NAME="nexus_erp"
DB_USER="nexus_erp_user"
APP_USER="nexuserp"

# ------------------------------------------------------------------------------
# CORES E FORMATAÇÃO DE SAÍDA
# ------------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[AVISO]${NC} $1"; }
log_error() { echo -e "${RED}[ERRO]${NC} $1"; }

# ------------------------------------------------------------------------------
# VALIDAÇÃO DE USUÁRIO ROOT
# ------------------------------------------------------------------------------
if [ "$EUID" -ne 0 ]; then
    log_error "Este script precisa ser executado como root (sudo)."
    exit 1
fi

log_info "Iniciando a preparação do servidor VPS para o Nexus ERP..."

# ------------------------------------------------------------------------------
# 1. ATUALIZAÇÃO DO SISTEMA E INSTALAÇÃO DE DEPENDÊNCIAS
# ------------------------------------------------------------------------------
log_info "Atualizando pacotes do sistema e instalando utilitários essenciais..."
apt-get update -y && apt-get upgrade -y
apt-get install -y curl wget git unzip gnupg ufw fail2ban postgresql postgresql-contrib nginx certbot python3-certbot-nginx ca-certificates lsb-release

# ------------------------------------------------------------------------------
# 2. INSTALAÇÃO DO ASP.NET CORE RUNTIME
# ------------------------------------------------------------------------------
log_info "Verificando/Instalando ASP.NET Core Runtime ${DOTNET_VERSION}..."
if ! command -v dotnet &>/dev/null; then
    UBUNTU_RELEASE=$(lsb_release -rs)
    wget -q https://packages.microsoft.com/config/ubuntu/${UBUNTU_RELEASE}/packages-microsoft-prod.deb -O /tmp/packages-microsoft-prod.deb
    dpkg -i /tmp/packages-microsoft-prod.deb
    rm /tmp/packages-microsoft-prod.deb
    apt-get update -y
fi

apt-get install -y "aspnetcore-runtime-${DOTNET_VERSION}" || {
    log_warn "Pacote aspnetcore-runtime-${DOTNET_VERSION} não encontrado via repositório direto. Tentando dotnet-runtime-${DOTNET_VERSION}..."
    apt-get install -y "dotnet-runtime-${DOTNET_VERSION}" || true
}

log_success "Dotnet instalado: $(dotnet --version 2>/dev/null || echo 'Runtime configurado')"

# ------------------------------------------------------------------------------
# 3. CRIAÇÃO DO USUÁRIO DE SERVIÇO (SEM LOGIN)
# ------------------------------------------------------------------------------
log_info "Configurando usuário de serviço de sistema '${APP_USER}'..."
if ! id "${APP_USER}" &>/dev/null; then
    useradd -r -s /usr/sbin/nologin -d /var/www/nexus-erp -m "${APP_USER}"
    log_success "Usuário de serviço '${APP_USER}' criado sem privilégios de login shell."
else
    log_warn "Usuário '${APP_USER}' já existe."
fi

# ------------------------------------------------------------------------------
# 4. ESTRUTURA DE DIRETÓRIOS E PERMISSÕES
# ------------------------------------------------------------------------------
log_info "Criando estrutura de diretórios do Nexus ERP..."

# Aplicação e releases
mkdir -p /var/www/nexus-erp/releases
mkdir -p /var/www/nexus-erp/releases/initial

# Dados permanentes
mkdir -p /var/lib/nexus-erp/uploads
mkdir -p /var/lib/nexus-erp/documentos
mkdir -p /var/lib/nexus-erp/imagens
mkdir -p /var/lib/nexus-erp/anexos

# Configurações, logs e backups
mkdir -p /etc/nexus-erp
mkdir -p /var/log/nexus-erp
mkdir -p /var/backups/nexus-erp

# Criar symlink 'current' inicial apontando para 'initial'
if [ ! -L /var/www/nexus-erp/current ]; then
    ln -s /var/www/nexus-erp/releases/initial /var/www/nexus-erp/current
fi

# Ajustar permissões rígidas e seguras
chown -R "${APP_USER}:${APP_USER}" /var/www/nexus-erp
chown -R "${APP_USER}:${APP_USER}" /var/lib/nexus-erp
chown -R "${APP_USER}:${APP_USER}" /var/log/nexus-erp
chown -R "${APP_USER}:${APP_USER}" /var/backups/nexus-erp
chmod -R 755 /var/www/nexus-erp
chmod -R 750 /var/lib/nexus-erp
chmod -R 750 /var/log/nexus-erp

log_success "Estrutura de diretórios configurada com sucesso."

# ------------------------------------------------------------------------------
# 5. CONFIGURAÇÃO DO BANCO DE DADOS POSTGRESQL
# ------------------------------------------------------------------------------
log_info "Configurando banco de dados PostgreSQL..."

# Gerar senha forte aleatória para o banco de dados
DB_PASS=$(openssl rand -hex 24)

sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL ON SCHEMA public TO ${DB_USER};"

log_success "Banco '${DB_NAME}' e usuário '${DB_USER}' configurados no PostgreSQL."

# ------------------------------------------------------------------------------
# 6. ARQUIVO DE VARIÁVEIS DE AMBIENTE (/etc/nexus-erp/nexus-erp.env)
# ------------------------------------------------------------------------------
log_info "Gerando arquivo de variáveis de ambiente..."

CONN_STRING="Host=127.0.0.1;Port=5432;Database=${DB_NAME};Username=${DB_USER};Password=${DB_PASS};"

cat <<EOF > /etc/nexus-erp/nexus-erp.env
# ==============================================================================
# NEXUS ERP - VARIÁVEIS DE AMBIENTE DE PRODUÇÃO
# ==============================================================================
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_URLS=http://127.0.0.1:5000
ConnectionStrings__DefaultConnection=${CONN_STRING}
EOF

# Proteção máxima do arquivo de credenciais
chown root:"${APP_USER}" /etc/nexus-erp/nexus-erp.env
chmod 640 /etc/nexus-erp/nexus-erp.env

log_success "Arquivo /etc/nexus-erp/nexus-erp.env gerado com permissões restritas (640)."

# ------------------------------------------------------------------------------
# 7. CRIAR SERVIÇO SYSTEMD (nexus-erp.service)
# ------------------------------------------------------------------------------
log_info "Configurando o serviço systemd 'nexus-erp.service'..."

cat <<EOF > /etc/systemd/system/nexus-erp.service
[Unit]
Description=Nexus ERP - ASP.NET Core Web Service
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=/var/www/nexus-erp/current
ExecStart=/usr/bin/dotnet /var/www/nexus-erp/current/${APP_DLL}
Restart=always
RestartSec=10
KillSignal=SIGINT
SyslogIdentifier=nexus-erp

# Opções de Hardening e Segurança Linux
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/var/lib/nexus-erp /var/log/nexus-erp /var/www/nexus-erp

# Variáveis de Ambiente
EnvironmentFile=/etc/nexus-erp/nexus-erp.env

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable nexus-erp.service
log_success "Serviço systemd registrado e ativado para boot automático."

# ------------------------------------------------------------------------------
# 8. CONFIGURAÇÃO DO NGINX
# ------------------------------------------------------------------------------
log_info "Configurando Nginx para reverse proxy em ${DOMAIN}..."

cat <<EOF > /etc/nginx/sites-available/${DOMAIN}
map \$http_upgrade \$connection_upgrade {
    default upgrade;
    '' close;
}

server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} ${WWW_DOMAIN};

    client_max_body_size 50M;

    access_log /var/log/nginx/nexus-erp.access.log;
    error_log /var/log/nginx/nexus-erp.error.log;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;

        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;

        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$host;

        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
}
EOF

ln -sf /etc/nginx/sites-available/${DOMAIN} /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default || true

nginx -t
systemctl restart nginx
log_success "Nginx configurado e reiniciado."

# ------------------------------------------------------------------------------
# 9. SCRIPT DE DEPLOY AUTOMATIZADO (/usr/local/bin/deploy-nexus-erp)
# ------------------------------------------------------------------------------
log_info "Instalando script de deploy automatizado 'deploy-nexus-erp'..."

cat <<'EOF' > /usr/local/bin/deploy-nexus-erp
#!/usr/bin/env bash
set -euo pipefail

APP_USER="nexuserp"
APP_DLL="NexusERP.dll"
DEPLOY_DIR="/tmp/nexus-deploy"
RELEASES_DIR="/var/www/nexus-erp/releases"
CURRENT_LINK="/var/www/nexus-erp/current"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
NEW_RELEASE_DIR="${RELEASES_DIR}/${TIMESTAMP}"

echo "[DEPLOY] Iniciando processo de publicação do Nexus ERP..."

if [ ! -d "${DEPLOY_DIR}" ]; then
    echo "[ERRO] Diretório de deploy '${DEPLOY_DIR}' não foi encontrado!"
    exit 1
fi

if [ ! -f "${DEPLOY_DIR}/${APP_DLL}" ]; then
    echo "[ERRO] Arquivo principal '${APP_DLL}' não encontrado em '${DEPLOY_DIR}'!"
    exit 1
fi

echo "[DEPLOY] Criando nova release: ${TIMESTAMP}..."
mkdir -p "${NEW_RELEASE_DIR}"

cp -a ${DEPLOY_DIR}/. "${NEW_RELEASE_DIR}/"

chown -R ${APP_USER}:${APP_USER} "${NEW_RELEASE_DIR}"
chmod -R 755 "${NEW_RELEASE_DIR}"

PREVIOUS_RELEASE=""
if [ -L "${CURRENT_LINK}" ]; then
    PREVIOUS_RELEASE=$(readlink -f "${CURRENT_LINK}")
fi

echo "[DEPLOY] Atualizando o link de versão ativa ('current')..."
ln -sfn "${NEW_RELEASE_DIR}" "${CURRENT_LINK}"

echo "[DEPLOY] Reiniciando serviço systemd 'nexus-erp'..."
systemctl restart nexus-erp

echo "[DEPLOY] Verificando estabilidade do serviço..."
sleep 4

if systemctl is-active --quiet nexus-erp; then
    echo "[OK] Nexus ERP iniciado com sucesso na versão ${TIMESTAMP}!"
    ls -dt ${RELEASES_DIR}/* | tail -n +6 | xargs rm -rf 2>/dev/null || true
    rm -rf "${DEPLOY_DIR}"
    echo "[OK] Deploy concluído e limpo com sucesso!"
else
    echo "[ERRO CRÍTICO] O ERP falhou ao iniciar! Iniciando rollback imediato..."
    if [ -n "${PREVIOUS_RELEASE}" ] && [ -d "${PREVIOUS_RELEASE}" ]; then
        echo "[ROLLBACK] Retornando para release anterior: ${PREVIOUS_RELEASE}"
        ln -sfn "${PREVIOUS_RELEASE}" "${CURRENT_LINK}"
        systemctl restart nexus-erp
        echo "[ROLLBACK] Rollback concluído."
    fi
    exit 1
fi
EOF

chmod +x /usr/local/bin/deploy-nexus-erp
log_success "Script '/usr/local/bin/deploy-nexus-erp' instalado."

# ------------------------------------------------------------------------------
# 10. SCRIPT DE BACKUP AUTOMÁTICO (/usr/local/bin/backup-nexus-erp)
# ------------------------------------------------------------------------------
log_info "Instalando script de backup 'backup-nexus-erp'..."

cat <<'EOF' > /usr/local/bin/backup-nexus-erp
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/var/backups/nexus-erp"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/nexus_erp_backup_${TIMESTAMP}.tar.gz"
TEMP_SQL="/tmp/nexus_db_${TIMESTAMP}.sql"
DB_NAME="nexus_erp"

echo "[BACKUP] Iniciando rotina de backup..."

DB_PASS=$(grep "ConnectionStrings__DefaultConnection" /etc/nexus-erp/nexus-erp.env | sed -n 's/.*Password=\([^;]*\);.*/\1/p')
DB_USER=$(grep "ConnectionStrings__DefaultConnection" /etc/nexus-erp/nexus-erp.env | sed -n 's/.*Username=\([^;]*\);.*/\1/p')

PGPASSWORD="${DB_PASS}" pg_dump -h 127.0.0.1 -U "${DB_USER}" -d "${DB_NAME}" -F p > "${TEMP_SQL}"

tar -czf "${BACKUP_FILE}" -C /tmp "nexus_db_${TIMESTAMP}.sql" -C /var/lib nexus-erp

rm -f "${TEMP_SQL}"
chmod 600 "${BACKUP_FILE}"

echo "[OK] Backup criado com sucesso em: ${BACKUP_FILE}"

find "${BACKUP_DIR}" -type f -name "nexus_erp_backup_*.tar.gz" -mtime +15 -delete
echo "[OK] Limpeza de backups antigos realizada."
EOF

chmod +x /usr/local/bin/backup-nexus-erp

cat <<EOF > /etc/cron.d/nexus-erp-backup
0 3 * * * root /usr/local/bin/backup-nexus-erp >> /var/log/nexus-erp/backup.log 2>&1
EOF
chmod 644 /etc/cron.d/nexus-erp-backup
log_success "Backup automático agendado diariamente às 03:00 AM."

# ------------------------------------------------------------------------------
# 11. FIREWALL (UFW)
# ------------------------------------------------------------------------------
log_info "Configurando Firewall UFW..."
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh comment 'SSH Access'
ufw allow 80/tcp comment 'HTTP Web'
ufw allow 443/tcp comment 'HTTPS SSL'
ufw --force enable
log_success "Firewall UFW ativado (Apenas SSH:22, HTTP:80 e HTTPS:443 liberados)."

# ------------------------------------------------------------------------------
# 12. FAIL2BAN
# ------------------------------------------------------------------------------
log_info "Configurando Fail2ban..."
cat <<EOF > /etc/fail2ban/jail.local
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port    = ssh
EOF

systemctl restart fail2ban
systemctl enable fail2ban
log_success "Fail2ban ativado."

# ------------------------------------------------------------------------------
# 13. SSL / CERTBOT
# ------------------------------------------------------------------------------
echo "------------------------------------------------------------------------------"
if [ "${LETSENCRYPT_EMAIL}" != "ALTERAR_EMAIL" ] && [ -n "${LETSENCRYPT_EMAIL}" ]; then
    log_info "Emitindo certificado SSL..."
    certbot --nginx -d "${DOMAIN}" -d "${WWW_DOMAIN}" --non-interactive --agree-tos -m "${LETSENCRYPT_EMAIL}" --redirect || true
else
    log_warn "Para habilitar o SSL via Certbot após propagação do DNS, execute:"
    echo -e "${GREEN}sudo certbot --nginx -d ${DOMAIN} -d ${WWW_DOMAIN} --agree-tos -m seu-email@dominio.com --redirect${NC}"
fi
echo "------------------------------------------------------------------------------"

log_success "====================================================================="
log_success " SETUP DO SERVIDOR LINUX CONCLUÍDO COM SUCESSO PARA O NEXUS ERP! "
log_success "====================================================================="
