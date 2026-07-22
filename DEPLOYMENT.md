# Instalação do Nexus ERP em servidor Linux local (sem Docker)

Este projeto está preparado para Ubuntu Server 22.04/24.04 ou Debian 12, com
PostgreSQL, Node.js, Nginx e `systemd` instalados diretamente no Linux. As
atualizações usam dois slots (blue/green): a nova versão é compilada e testada
antes de receber tráfego, enquanto banco, uploads, backups e segredos permanecem
fora das versões da aplicação.

## Requisitos recomendados

- 2 núcleos de CPU, 4 GB de RAM e 40 GB de SSD;
- IP fixo ou reserva DHCP na rede local;
- acesso `sudo` e acesso do servidor ao repositório Git;
- Ubuntu Server 22.04/24.04 ou Debian 12 atualizado.

Não instale Docker. O instalador configura Node.js 22, PostgreSQL, Nginx,
serviços, backups e o primeiro administrador.

## 1. Colocar o código no servidor

Depois de enviar esta versão ao repositório Git, conecte-se ao Linux e execute:

```bash
git clone URL_DO_REPOSITORIO /tmp/nexus-erp-installer
cd /tmp/nexus-erp-installer
sudo NEXUS_REPO_URL=URL_DO_REPOSITORIO \
  ADMIN_EMAIL=seu-email@empresa.com \
  NEXUS_SERVER_NAME=_ \
  bash deploy/install-linux.sh
```

Para definir a senha inicial em vez de receber uma senha gerada na tela:

```bash
sudo NEXUS_REPO_URL=URL_DO_REPOSITORIO \
  ADMIN_EMAIL=seu-email@empresa.com \
  ADMIN_PASSWORD='UMA-SENHA-FORTE-COM-12-OU-MAIS' \
  bash deploy/install-linux.sh
```

Em repositório privado, configure antes uma deploy key somente leitura para o
usuário `nexus`, ou clone manualmente em `/opt/nexus-erp/source` como esse
usuário. O instalador é idempotente: mantém o arquivo de ambiente e o clone já
existentes quando for executado novamente.

Ao final, o terminal mostra a URL por IP e, quando gerada, a senha inicial uma
única vez. De outro computador ou tablet na mesma rede, acesse:

```text
http://IP_FIXO_DO_SERVIDOR
```

Se o firewall UFW estiver ativo:

```bash
sudo ufw allow 80/tcp
```

O acesso por domínio e HTTPS é opcional em rede local. Se o ERP for exposto à
internet, use domínio, HTTPS, firewall e uma VPN ou controle de acesso adequado.

## 2. Estrutura persistente

```text
/opt/nexus-erp/
├── source/             clone Git usado pelo atualizador
├── releases/           versões compiladas e imutáveis
├── slots/blue          link para uma versão
├── slots/green         link para outra versão
├── shared/uploads/     fotos e assinaturas persistentes
├── shared/backups/     backups PostgreSQL persistentes
└── active-slot         slot atendido pelo Nginx

/etc/nexus-erp.env      banco, sessão e credenciais externas
```

Proteja uma cópia de `/etc/nexus-erp.env`; ele não é substituído nas
atualizações. Nunca execute `npm run db:seed` no servidor: o seed de
desenvolvimento recria dados e não é o inicializador de produção. O instalador
usa `npm run admin:bootstrap`, que não apaga cadastros.

## 3. Levar os dados atuais para o Linux

Antes de liberar o servidor para uso, pare alterações no ERP antigo. Gere um
backup manual na máquina atual:

```bash
npm run backup
```

Copie para o servidor o arquivo `.dump`, seu `.sha256` e, se existir, o arquivo
de uploads correspondente. Exemplo:

```bash
scp backups/ARQUIVO.dump backups/ARQUIVO.dump.sha256 usuario@IP_DO_SERVIDOR:/tmp/
sudo mv /tmp/ARQUIVO.dump* /opt/nexus-erp/shared/backups/
sudo chown nexus:nexus /opt/nexus-erp/shared/backups/ARQUIVO.dump*
```

Verifique primeiro e só depois restaure:

```bash
cd /opt/nexus-erp/slots/$(cat /opt/nexus-erp/active-slot)
sudo -u nexus npm run backup:restore -- /opt/nexus-erp/shared/backups/ARQUIVO.dump
sudo -u nexus npm run backup:restore -- /opt/nexus-erp/shared/backups/ARQUIVO.dump --confirm
```

Para copiar uploads atuais diretamente:

```bash
rsync -av public/uploads/ usuario@IP_DO_SERVIDOR:/tmp/nexus-uploads/
sudo rsync -av /tmp/nexus-uploads/ /opt/nexus-erp/shared/uploads/
sudo chown -R nexus:nexus /opt/nexus-erp/shared/uploads
```

Faça essa migração antes do primeiro uso no servidor para evitar divergência de
dados. Após restaurar, rode a verificação descrita abaixo.

## 4. Atualizar sem interromper o servidor

Depois de publicar uma atualização no branch `main`:

```bash
cd /opt/nexus-erp/source
sudo bash deploy/update-linux.sh
```

O atualizador:

1. impede duas atualizações simultâneas;
2. bloqueia migrações potencialmente destrutivas por padrão;
3. cria e verifica um backup pré-atualização;
4. compila a nova release fora do slot ativo;
5. aplica migrações compatíveis do Prisma;
6. inicia e testa aplicação e banco na porta interna;
7. troca o Nginx e testa novamente pelo endereço público local;
8. volta automaticamente ao slot anterior se a troca falhar;
9. mantém as cinco releases mais recentes.

Use migrações de banco no padrão expand/contract. O código novo deve continuar
compatível com o banco durante o rollback; remoções de colunas e tabelas devem
ocorrer somente em uma versão posterior.

## 5. Rollback

Para voltar a aplicação ao slot anterior:

```bash
cd /opt/nexus-erp/source
sudo bash deploy/rollback-linux.sh
```

O rollback cria um backup, testa a versão anterior e só então troca o Nginx.
Ele não desfaz migrações de banco automaticamente, porque isso pode destruir
dados. Essa é a razão para manter todas as atualizações compatíveis entre si.

## 6. Backups automáticos

- horário: retenção de 48 horas;
- diário: retenção de 30 dias;
- semanal, manual e pré-atualização: retenção ampliada;
- todo dump recebe SHA-256 e é aberto por `pg_restore --list`;
- uploads são arquivados junto quando presentes;
- `BACKUP_BUCKET` permite uma segunda cópia em S3/R2.

Confira os agendamentos e force um backup:

```bash
systemctl list-timers 'nexus-erp-backup-*'
sudo systemctl start nexus-erp-backup-hourly.service
journalctl -u nexus-erp-backup-hourly.service -n 100 --no-pager
```

Uma cópia no mesmo SSD não protege contra falha física. Para produção, configure
o bucket externo no `/etc/nexus-erp.env` ou copie os backups para outro
equipamento. Para recuperação com perda próxima de zero, adicione PostgreSQL
WAL/PITR ou replicação em outro servidor.

## 7. Diagnóstico e operação

Teste a instalação completa:

```bash
cd /opt/nexus-erp/source
sudo bash deploy/check-linux.sh
```

Comandos úteis:

```bash
systemctl status nexus-erp@$(cat /opt/nexus-erp/active-slot)
journalctl -u nexus-erp@$(cat /opt/nexus-erp/active-slot) -n 200 --no-pager
journalctl -u nginx -n 100 --no-pager
curl -fsS http://127.0.0.1/api/health
nginx -t
```

Antes de liberar o ERP para a equipe, confirme login, criação de cliente,
orçamento, aprovação, geração e conclusão de OS, lançamento fiscal, upload e
restauração de um backup de teste.
