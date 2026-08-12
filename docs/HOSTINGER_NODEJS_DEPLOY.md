# Deploy Node.js na Hostinger VPS (Next.js + Prisma + PostgreSQL)

Este guia coloca o NX ERP online em VPS Hostinger com Node.js, PM2 e Nginx.
Inclui 2 modos: deploy simples e deploy blue/green (zero-downtime).

## Arquivos criados neste projeto

- `ecosystem.config.cjs`
- `deploy/hostinger/deploy-hostinger.sh`
- `deploy/hostinger/nginx-hostinger.conf`
- `deploy/hostinger/.env.hostinger.example`
- `deploy/hostinger/deploy-hostinger-bluegreen.sh`
- `deploy/hostinger/rollback-hostinger-bluegreen.sh`
- `deploy/hostinger/nginx-hostinger-bluegreen.conf`
- `.github/workflows/deploy-hostinger.yml`

## 1) Preparar VPS (uma vez)

```bash
sudo apt update
sudo apt install -y git nginx postgresql postgresql-client certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pm2
```

## 2) Banco de dados PostgreSQL

```bash
sudo -u postgres psql
```

```sql
CREATE ROLE nexus_erp LOGIN PASSWORD 'troque_senha_forte';
CREATE DATABASE nexus_erp OWNER nexus_erp;
\q
```

## 3) Estrutura da aplicacao

```bash
sudo mkdir -p /var/www/nexus-erp/releases /var/www/nexus-erp/repo /var/www/nexus-erp/shared /var/log/nexus-erp
sudo chown -R $USER:$USER /var/www/nexus-erp /var/log/nexus-erp
```

```bash
git clone <URL_DO_REPOSITORIO> /var/www/nexus-erp/repo
cd /var/www/nexus-erp/repo
cp deploy/hostinger/.env.hostinger.example .env
```

Edite `.env` com valores reais.

## 4) Primeiro deploy

```bash
cd /var/www/nexus-erp/repo
chmod +x deploy/hostinger/deploy-hostinger.sh
APP_BASE_URL=https://erp.seudominio.com.br BRANCH=main bash deploy/hostinger/deploy-hostinger.sh
```

Observacao: este projeto esta com branch padrao de deploy `agent/erp-beta-linux`.
Se quiser seguir a branch atual, basta omitir `BRANCH`.

## 5) Nginx + dominio + SSL

```bash
sudo cp /var/www/nexus-erp/repo/deploy/hostinger/nginx-hostinger.conf /etc/nginx/sites-available/nexus-erp
sudo sed -i 's/erp.seudominio.com.br/SEU_DOMINIO_AQUI/g' /etc/nginx/sites-available/nexus-erp
sudo ln -sfn /etc/nginx/sites-available/nexus-erp /etc/nginx/sites-enabled/nexus-erp
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

SSL (Let's Encrypt):

```bash
sudo certbot --nginx -d seu-dominio.com.br
```

## 6) Atualizacao de versao

```bash
cd /var/www/nexus-erp/repo
git pull
BRANCH=main bash deploy/hostinger/deploy-hostinger.sh
```

## 6.1) Blue/Green com PM2 (recomendado)

1. Instale o Nginx usando o template blue/green:

```bash
sudo cp /var/www/nexus-erp/repo/deploy/hostinger/nginx-hostinger-bluegreen.conf /etc/nginx/sites-available/nexus-erp
sudo sed -i 's/erp.seudominio.com.br/SEU_DOMINIO_AQUI/g' /etc/nginx/sites-available/nexus-erp
```

2. Crie o upstream inicial (slot blue):

```bash
sudo tee /etc/nginx/conf.d/nexus-erp-upstream.conf >/dev/null <<'EOF'
upstream nexus_erp_backend {
	server 127.0.0.1:3001;
	keepalive 64;
}
EOF
sudo nginx -t && sudo systemctl reload nginx
```

3. Execute deploy blue/green:

```bash
cd /var/www/nexus-erp/repo
chmod +x deploy/hostinger/deploy-hostinger-bluegreen.sh deploy/hostinger/rollback-hostinger-bluegreen.sh
APP_DOMAIN=erp.seudominio.com.br BRANCH=agent/erp-beta-linux bash deploy/hostinger/deploy-hostinger-bluegreen.sh
```

4. Rollback rapido (troca de slot):

```bash
APP_ROOT=/var/www/nexus-erp bash deploy/hostinger/rollback-hostinger-bluegreen.sh
```

## 7) Rollback rapido

Listar releases:

```bash
ls -1dt /var/www/nexus-erp/releases/*
```

Apontar para release anterior e recarregar PM2:

```bash
ln -sfn /var/www/nexus-erp/releases/RELEASE_ANTERIOR /var/www/nexus-erp/current
pm2 reload /var/www/nexus-erp/current/ecosystem.config.cjs --update-env
```

## 8) Comandos de operacao

```bash
pm2 ls
pm2 logs nexus-erp
pm2 restart nexus-erp
curl -fsS https://seu-dominio.com.br/api/health
```

## 9) Deploy automatico com GitHub Actions

Workflow: `.github/workflows/deploy-hostinger.yml`.

Configure estes secrets no repositório GitHub:

- `HOSTINGER_HOST` (IP ou dominio da VPS)
- `HOSTINGER_USER` (usuario SSH)
- `HOSTINGER_SSH_KEY` (chave privada)
- `HOSTINGER_PORT` (opcional, padrao 22)

Variaveis opcionais no servidor (shell profile):

- `DEPLOY_BRANCH` (padrao `agent/erp-beta-linux`)
- `APP_DOMAIN`
- `APP_BASE_URL`
- `APP_ROOT`

O workflow dispara em push na branch `agent/erp-beta-linux` e roda o script
blue/green remotamente por SSH.

## Checklist de publicacao

- DNS do dominio apontando para IP da VPS
- `.env` com `DATABASE_URL`, `SESSION_SECRET` e `INTEGRATION_ENCRYPTION_KEY`
- migrations aplicadas com sucesso (`npm run prisma:deploy` no deploy)
- `pm2 ls` com app online
- Nginx validado (`nginx -t`)
- HTTPS ativo via certbot
- rota de health respondendo `200`
- login funcional no ERP
