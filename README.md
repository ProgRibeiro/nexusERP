# ERP de Prestação de Serviços - Antigravity Climatização

Este é um sistema ERP web completo para gestão operacional e financeira de empresas prestadoras de serviços (climatização, elétrica, civil, etc.). O sistema é estruturado em torno da **Ordem de Serviço (OS)** como núcleo centralizador, integrando o fluxo de vendas comercial com a execução técnica de campo e o faturamento financeiro.

---

## 🚀 Tecnologias Utilizadas

* **Framework:** Next.js 16 (App Router / React 19)
* **Linguagem:** TypeScript
* **Estilização:** Tailwind CSS v4
* **Gráficos:** Recharts
* **ORM:** Prisma ORM (v7.8.0)
* **Banco de Dados:** PostgreSQL nativo
* **Execução:** Node.js nativo com PostgreSQL
* **Produção:** Linux/Cloudex com systemd, Nginx e HTTPS

---

## 🛠️ Como Iniciar o Projeto Localmente

### 1. Requisitos Pró-Requisitos
* Node.js v20+ instalado
* PostgreSQL instalado e rodando localmente

### 2. Configurar Variáveis de Ambiente
Copie o arquivo de exemplo de ambiente `.env.example` para `.env`:
```bash
cp .env.example .env
```
O arquivo `.env` deve conter a conexão do PostgreSQL local na porta padrão:
```env
DATABASE_URL="postgresql://seu_usuario@localhost:5432/erp_prestacao_servicos?schema=public"
SESSION_SECRET="uma-string-aleatoria-com-pelo-menos-32-caracteres"
```

### 3. Criar o banco PostgreSQL local

```bash
createdb erp_prestacao_servicos
```

### 4. Rodar as Migrations do Prisma
Gere o Prisma Client e aplique a estrutura do banco:
```bash
npm run prisma:generate
npm run prisma:deploy
```

### 5. Popular o Banco com Dados de Teste (Seed)
Carregue os dados realistas de simulação (usuários, clientes, leads de CRM, orçamentos e Ordens de Serviço antigas):
```bash
npm run db:seed
```

### 6. Executar o Servidor de Desenvolvimento
Inicie o servidor local do Next.js:
```bash
npm run dev
```
O site estará no ar em: **[http://localhost:3000](http://localhost:3000)**

---

## 🔄 Fluxo de Negócio Operacional

O ERP conecta todos os departamentos da empresa de ponta a ponta:

1. **CRM & Funil comercial:** Captura de leads e agendamento de follow-ups em Kanban.
2. **Orçamento e Margem:** Elaboração de propostas com auditoria interna de margem de contribuição (alvos em vermelho se abaixo da meta).
3. **Ordem de Serviço (OS):** Criação automática pós-aprovação do orçamento, com escala de equipe técnica e controle de peças.
4. **Execução de Campo (Técnico):** Interface mobile-friendly para check-in por GPS, checklist de qualidade, inserção de medições, fotos antes/depois e **Assinatura Eletrônica** do cliente.
5. **Relatório de Conclusão:** Emissão visual para aprovação do cliente com layout otimizado para impressão (PDF).
6. **Faturamento & NFS-e:** Emissão simulada de NFS-e com imposto retido e parcelamento financeiro.
7. **Controle Financeiro:** Gestão de Contas a Receber (baixas totais/parciais), Contas a Pagar (despesas operacionais), Extrato com **Estorno Rastreável** e relatório **DRE** de competência de caixa.

---

## 🔒 Simulação de Perfis de Usuário
No topo direito do painel de administração, há um seletor rápido para alternar o perfil de usuário logado. Isto permite testar o controle de permissão por perfil (Role-Based Access Control) nas telas:
* **Administrador:** Acesso completo.
* **Gestor:** Visualização ampla, aprovações comerciais e agendamento.
* **Comercial:** CRM e propostas de orçamento.
* **Operacional:** Agendamentos e controle técnico.
* **Técnico:** Interface de campo ([/execucao](http://localhost:3000/execucao)).
* **Faturamento:** Fila de faturamento e Notas Fiscais.
* **Financeiro:** Contas, baixas, estornos e DRE.

---

## Produção Linux / Cloudex

A implantação não usa Docker. O processo completo com PostgreSQL nativo,
deploy blue/green, atualizações atômicas, backups automáticos, systemd, Nginx e
certificado HTTPS está em [DEPLOYMENT.md](./DEPLOYMENT.md).

Os campos monetários críticos usam `Decimal(10,2)` no PostgreSQL para evitar
erros de arredondamento de ponto flutuante.

## Backups locais

```bash
npm run backup                 # backup manual verificado
npm run backup:audit           # auditoria de integridade dos backups recentes
npm run backup:install-local   # instala backup automático de hora em hora no macOS
```

Os arquivos ficam em `backups/`, possuem checksum SHA-256 e podem ser
verificados com `npm run backup:restore -- backups/ARQUIVO.dump`.

O endpoint `/api/health` também expõe a saúde da proteção de dados
(`backup.status`: `ok`, `warning` ou `critical`) com base no SLA definido em
`BACKUP_MAX_AGE_HOURS`.

## Envio de propostas pelo Gmail

O ERP envia propostas com PDF A4 anexado usando OAuth 2.0, sem armazenar a
senha da conta Google. A configuração pode ser acompanhada em
**Configurações > Gmail & Integrações**.

O passo a passo completo está em
[docs/INTEGRACAO_GMAIL.md](./docs/INTEGRACAO_GMAIL.md).

## Aplicativo para Android e Apple

O NX ERP pode ser instalado como PWA no Android, iPhone, iPad e computadores,
com ícone próprio, execução em tela cheia e atualização automática. O servidor
precisa estar acessível por HTTPS.

As instruções estão em
[docs/INSTALACAO_ANDROID_IOS.md](./docs/INSTALACAO_ANDROID_IOS.md).

## Atualização sem perda de dados

No Linux, o comando de atualização busca a versão no Git e publica pelo modelo
blue/green. A versão candidata é testada internamente nas portas
`3001/3002`; clientes acessam apenas o Nginx em `80/443`. Banco, fotos, backups
e configurações não ficam dentro das releases substituídas.

O fluxo e os comandos de diagnóstico estão em
[docs/ATUALIZACAO_SEM_PERDA.md](./docs/ATUALIZACAO_SEM_PERDA.md).
