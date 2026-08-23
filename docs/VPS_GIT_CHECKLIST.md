# Publicação Git → VPS — O Prestador

Este roteiro prepara uma VPS Ubuntu 24.04 nova. Ele não migra, restaura nem altera o banco do servidor antigo.

## 1. Antes do push

Na máquina de desenvolvimento:

```bash
npm run prepare:vps
git status --short
```

Revise as alterações, faça o commit e envie para `main`. Nunca inclua `.env`, dumps, uploads ou o arquivo de credencial inicial.

## 2. DNS

Depois de a VPS passar no diagnóstico, crie registros `A` para o IP da VPS:

- `oprestador.tech`
- `www.oprestador.tech`
- `app.oprestador.tech`
- `vendas.oprestador.tech`
- `dev.oprestador.tech`

Não altere o DNS antes da validação local por `Host` feita pelo instalador.

## 3. Instalação inicial

Na VPS, como `root`:

```bash
export NEXUS_REPO_URL=https://github.com/ProgRibeiro/nexusERP.git
export LETSENCRYPT_EMAIL=SEU_EMAIL_REAL
export ADMIN_EMAIL=SEU_EMAIL_ADMIN
bash <(curl -fsSL https://raw.githubusercontent.com/ProgRibeiro/nexusERP/main/deploy/install-linux.sh)
```

Se o repositório for privado, clone-o primeiro com uma chave de deploy e execute:

```bash
cd /opt/nexus-erp/source
sudo bash deploy/install-linux.sh
```

O instalador não imprime senhas. Quando ele gerar a senha inicial, ela ficará apenas em `/root/nexus-erp-initial-admin.txt`, com permissão `600`. Apague esse arquivo depois de entrar e trocar a senha.

## 4. Configurações externas obrigatórias

Edite `/etc/nexus-erp.env` sem publicar seu conteúdo:

- `PASSWORD_RESET_WEBHOOK_URL`: entrega de recuperação de senha;
- `BACKUP_BUCKET` e credenciais: cópia externa obrigatória para atualizações futuras;
- `STORAGE_BUCKET` e credenciais: recomendado para uploads externos;
- pelo menos um `ALERT_*`: alerta de backup;
- `RESTORE_TEST_DATABASE_URL`: conta isolada com permissão para criar e apagar somente bancos temporários.

Após alterar o ambiente:

```bash
sudo chmod 600 /etc/nexus-erp.env
sudo systemctl restart nexus-erp@$(cat /opt/nexus-erp/active-slot).service
sudo bash /opt/nexus-erp/source/deploy/check-linux.sh
```

O teste semanal de restauração permanece desativado até `RESTORE_TEST_DATABASE_URL` ser configurada.

## 5. Atualizações

```bash
cd /opt/nexus-erp/source
sudo bash deploy/update-linux.sh
sudo bash deploy/check-linux.sh
```

O deploy cria backup, compila no slot inativo, executa migrations, testa `/api/health` e somente então muda o Nginx. Em falha, mantém ou restaura o slot anterior.

## 6. Diagnóstico

```bash
systemctl status nexus-erp@$(cat /opt/nexus-erp/active-slot).service --no-pager
journalctl -u nexus-erp@$(cat /opt/nexus-erp/active-slot).service -n 200 --no-pager
systemctl list-timers 'nexus-erp-*'
nginx -t
ufw status verbose
fail2ban-client status sshd
curl -kfsS https://127.0.0.1/api/health | jq
```

Migração do banco real é uma etapa separada e exige autorização explícita.
