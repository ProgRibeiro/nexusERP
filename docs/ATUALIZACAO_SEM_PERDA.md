# Atualização do NX ERP sem perda de dados

O servidor usa publicação **blue/green**. Há sempre uma versão atendendo os
usuários e outra porta interna reservada para compilar e testar a atualização.

```text
Usuários ── HTTP/HTTPS ── Nginx ── versão ativa
                                  ├─ blue  127.0.0.1:3001
                                  └─ green 127.0.0.1:3002
```

As portas `3001` e `3002` não devem ser abertas no roteador nem no firewall.
Elas existem somente no próprio Linux. Os usuários continuam acessando as
portas `80` e `443` pelo Nginx.

## O que permanece fora da atualização

- PostgreSQL com clientes, propostas, ordens, financeiro e demais cadastros;
- `/opt/nexus-erp/shared/uploads`, com fotos e assinaturas;
- `/opt/nexus-erp/shared/backups`;
- `/var/cache/nexus-erp/static`, com os arquivos versionados das telas abertas;
- `/etc/nexus-erp.env`, com segredos e configurações;
- armazenamento S3/R2/MinIO, quando configurado.

Uma release troca somente o código compilado. O instalador de produção nunca
executa o `db:seed`, portanto uma publicação não recria nem limpa cadastros.

## Publicação pelo terminal do Linux

Depois de enviar o código para o repositório remoto, entre no servidor e rode:

```bash
cd /opt/nexus-erp/source
sudo bash deploy/update-linux.sh
```

Não é necessário executar `git pull`: o atualizador faz `git fetch`, identifica
o commit do branch remoto configurado e cria uma release imutável a partir
dele. Se preferir visualizar o código novo no clone antes da publicação, use:

```bash
sudo -u nexus git -C /opt/nexus-erp/source pull --ff-only
sudo bash /opt/nexus-erp/source/deploy/update-linux.sh
```

Não execute `npm install`, `prisma migrate` nem reinicie o processo ativo
manualmente. O atualizador realiza essas operações no slot inativo e, se
existir um novo commit:

1. obtém um bloqueio exclusivo;
2. bloqueia migrações destrutivas;
3. cria e verifica um backup PostgreSQL e dos uploads;
4. monta uma release imutável na porta inativa;
5. compila e aplica migrações aditivas;
6. testa aplicação, versão e banco diretamente na porta de upgrade;
7. direciona novas conexões do Nginx para a versão aprovada;
8. testa novamente pela porta pública;
9. mantém a versão antiga viva durante a drenagem das requisições;
10. retorna automaticamente ao slot anterior se o teste público falhar.

Os arquivos JavaScript e CSS usam nomes com hash e são acumulados no cache
compartilhado do Nginx. Portanto, uma pessoa que deixou uma tela aberta antes
da atualização continua conseguindo carregar módulos daquela versão enquanto
finaliza o trabalho; na recarga seguinte, recebe a interface nova.

Cada compilação também recebe um identificador de publicação próprio. O Next.js
usa esse identificador para detectar uma tela antiga antes de misturar ações de
servidor incompatíveis. Nos formulários críticos, como o cadastro de clientes,
o rascunho fica preservado na sessão do navegador e reaparece preenchido após
uma recarga de atualização.

Se não existir atualização, o comando termina sem reiniciar o ERP.

## Operação

Ver o estado atual, as portas e a última publicação:

```bash
cd /opt/nexus-erp/source
sudo bash deploy/update-status.sh
```

Executar por meio do serviço e acompanhar o log:

```bash
sudo systemctl start nexus-erp-update.service
sudo journalctl -u nexus-erp-update.service -f
```

## Atualização automática opcional

O modo automático fica desabilitado por padrão, pois a publicação será feita
pelo terminal. Para habilitar uma consulta ao Git a cada cinco minutos:

```bash
sudo systemctl enable --now nexus-erp-update.timer
systemctl list-timers nexus-erp-update.timer
```

Para desabilitar novamente:

```bash
sudo systemctl disable --now nexus-erp-update.timer
```

O branch e o período de drenagem ficam em `/etc/nexus-erp-update.env`:

```ini
DEPLOY_BRANCH=main
DRAIN_SECONDS=30
```

Depois de alterar esse arquivo, não é necessário reiniciar a aplicação.

## Retorno à versão anterior

```bash
cd /opt/nexus-erp/source
sudo bash deploy/rollback-linux.sh
```

O rollback também cria backup e testa a versão anterior antes da troca. As
migrações não são desfeitas automaticamente, pois apagar colunas ou tabelas
poderia destruir dados. Toda mudança de banco deve usar o padrão
**expand/contract**: primeiro adicionar, depois migrar e somente em uma versão
futura remover estruturas antigas.

## Conferência após instalar no Linux

```bash
sudo bash /opt/nexus-erp/source/deploy/check-linux.sh
sudo bash /opt/nexus-erp/source/deploy/update-status.sh
curl -fsS http://127.0.0.1/api/health
```

Também deve ser realizado periodicamente um teste real de restauração. Um
arquivo de backup que nunca foi restaurado não deve ser considerado uma
garantia suficiente de recuperação.
