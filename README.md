# ERP de Prestação de Serviços - Antigravity Climatização

Este é um sistema ERP web completo para gestão operacional e financeira de empresas prestadoras de serviços (climatização, elétrica, civil, etc.). O sistema é estruturado em torno da **Ordem de Serviço (OS)** como núcleo centralizador, integrando o fluxo de vendas comercial com a execução técnica de campo e o faturamento financeiro.

---

## 🚀 Tecnologias Utilizadas

* **Framework:** Next.js 16 (App Router / React 19)
* **Linguagem:** TypeScript
* **Estilização:** Tailwind CSS v4
* **Gráficos:** Recharts
* **ORM:** Prisma ORM (v7.8.0)
* **Banco de Dados:** PostgreSQL 16 (Ambiente de Produção e Docker local)
* **Containerização:** Docker & Docker Compose

---

## 🛠️ Como Iniciar o Projeto Localmente

### 1. Requisitos Pró-Requisitos
* Node.js v20+ instalado
* Docker e Docker Desktop instalados e rodando

### 2. Configurar Variáveis de Ambiente
Copie o arquivo de exemplo de ambiente `.env.example` para `.env`:
```bash
cp .env.example .env
```
O arquivo `.env` deve conter a URL de conexão para a porta exposta do banco de dados (recomenda-se a porta **5433** para evitar conflitos com servidores PostgreSQL locais ativos):
```env
DATABASE_URL="postgresql://erp_user:erp_password@localhost:5433/erp_prestacao_servicos?schema=public"
```

### 3. Subir o Banco PostgreSQL via Docker
Inicie o container do banco de dados local PostgreSQL em segundo plano:
```bash
docker compose up -d
```
*Isto irá instanciar um container rodando PostgreSQL 16 exposto na porta `5433`.*

### 4. Rodar as Migrations do Prisma
Gere a estrutura de tabelas e relacionamentos no banco de dados:
```bash
npx prisma migrate dev --name init_postgres
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

## 📈 Decisões de Arquitetura de Produção: Float vs Decimal
Durante a etapa de migração para o PostgreSQL, optou-se por manter os campos financeiros mapeados como `Float` (que se traduz em `Double Precision` no PostgreSQL) para garantir a estabilidade das Server Actions, cálculos do Dashboard e tipagens do React na base de código ativa.

**Próximos Passos (Fase 2 de Refatoração):**
* Avaliar a conversão gradual de campos monetários críticos para `Decimal` (`Numeric(10,2)` no PostgreSQL) para evitar erros de arredondamento de ponto flutuante em grandes volumes financeiros.
* Implementar a biblioteca `decimal.js` ou realizar a conversão explícita com `.toNumber()` na leitura dos dados em todas as consultas Prisma nas views do Next.js.
