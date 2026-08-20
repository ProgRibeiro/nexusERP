# Proteção de dados e atualização automática

O Nexus ERP trata orçamento, financeiro, serviços, ordens de serviço,
faturamento e documentos fiscais como dados críticos. Uma publicação segue
estas três camadas obrigatórias:

1. **Banco primário persistente:** releases blue/green são imutáveis e ficam
   separadas do PostgreSQL e dos uploads. Trocar ou reverter a aplicação nunca
   substitui o banco por uma cópia antiga.
2. **Backup local verificado:** antes de cada atualização é criado um dump
   custom do PostgreSQL, pacote de uploads, SHA-256 e validação por
   `pg_restore --list`.
3. **Cópia externa:** com `REQUIRE_OFFSITE_BACKUP=true`, o deploy só continua
   quando dump, checksum, metadados e uploads forem confirmados no bucket
   S3/R2/MinIO configurado em `/etc/nexus-erp.env`. Cada envio é confirmado
   novamente no armazenamento remoto, inclusive pelo tamanho gravado.

O banco e o pacote de anexos possuem checksums independentes. O teste semanal
restaura o dump em um banco temporário, executa consulta real e remove esse
banco ao terminar, sem tocar na produção.

Além das cópias, `scripts/critical-data-manifest.mjs` registra contagens e
totais financeiros antes da migration e reprova a publicação se qualquer
métrica protegida diminuir. Migrações destrutivas também são bloqueadas.

Se build, migration, health check interno, Nginx ou health check público
falharem, o tráfego permanece ou retorna ao slot anterior. O banco não é
restaurado automaticamente, pois isso apagaria registros criados após o backup.
Uma restauração é uma operação de desastre separada, confirmada e auditada.

## Variáveis obrigatórias para a terceira camada

```text
REQUIRE_OFFSITE_BACKUP=true
BACKUP_BUCKET=nome-do-bucket
BACKUP_PREFIX=nexus-erp
BACKUP_REGION=auto
BACKUP_ENDPOINT=https://ENDPOINT-S3-OU-R2
BACKUP_ACCESS_KEY_ID=...
BACKUP_SECRET_ACCESS_KEY=...
```

O robô pode continuar verificando o Git a cada minuto. Se a proteção não
estiver pronta, ele mantém a versão estável e registra a atualização como
`blocked`, sem interromper o ERP.
