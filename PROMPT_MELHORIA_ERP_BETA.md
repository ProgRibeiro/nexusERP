# Prompt de Melhoria — ERP Antigravity Climatização (rumo ao Beta Comercial)

## Diagnóstico atual

O sistema já tem uma base muito acima da média para o estágio atual. O modelo de dados (Prisma) cobre o ciclo completo de uma prestadora de serviços com mais de 30 entidades bem relacionadas: CRM com funil e atividades, orçamentos com versionamento e aprovação com auditoria de margem, Ordem de Serviço com histórico de status, técnicos alocados, checklist, fotos antes/depois e assinatura eletrônica, faturamento, financeiro completo (contas a pagar/receber, conciliação bancária, DRE), estoque com movimentações rastreadas, contratos recorrentes, log de auditoria e exportação LGPD. O fluxo de negócio ponta a ponta (Lead → Orçamento → OS → Execução → Relatório → Faturamento → Financeiro) está implementado nas telas, não é só maquete, e existe até uma suíte de testes de integração (`src/tests/testAll.ts`) cobrindo os principais fluxos — algo raro em projetos nesse estágio.

Dito isso, o sistema está em nível de **protótipo funcional avançado**, não de **produto vendável com dados reais de clientes**. Os gaps abaixo não são polimento — são bloqueadores reais para colocar dinheiro e dados de terceiros nesse sistema:

1. **Não há autenticação de verdade.** O login guarda a sessão em `localStorage` no navegador (`AuthContext.tsx`) e nenhuma Server Action (`src/app/actions/*.ts`) valida permissão no servidor. O `hasPermission()` só existe no cliente — é cosmético. Qualquer pessoa que descubra a URL de uma action consegue ler/editar/apagar dados de qualquer cliente, orçamento, OS ou lançamento financeiro, sem estar logada.
2. **Banco de dados é SQLite mesmo em "produção".** `schema.prisma` usa `provider = "sqlite"` e o `docker-compose.prod.yml` aponta para um arquivo `dev.db` num volume. Isso não aguenta acesso concorrente real, não escala além de uma única instância e tem risco de corrupção. As dependências de Postgres (`pg`, `@prisma/adapter-pg`) já estão instaladas mas não estão em uso.
3. **Simulações que parecem reais mas não são.** A emissão de NFS-e é só uma troca de status interno — não há integração com nenhum provedor fiscal (Focus NFe, PlugNotas, NFE.io etc.), então nenhuma nota é realmente emitida. Fotos de execução técnica em alguns pontos usam URLs mock (`/mock/photos/...`) e tanto fotos quanto assinatura ficam como base64 dentro do banco, o que não escala.
4. **Duas rotas do menu são páginas mortas.** `/agenda` e `/servicos` retornam `null` — links quebrados visíveis para qualquer usuário logado.
5. **Nenhuma comunicação real com o cliente.** Não há integração de e-mail, WhatsApp ou SMS. "Enviar orçamento" ou "enviar relatório" muda apenas um status no banco; o cliente não recebe nada de fato.
6. **Sem isolamento multi-empresa (multi-tenant) nem modelo de assinatura.** Se a intenção é vender para várias empresas de serviço (não só a Antigravity), hoje o sistema é single-tenant.
7. **Qualidade/robustez de código:** 162 usos de `any`, ~159 `console.log`/`console.error` diretos sem logger estruturado, `zod` está instalado mas não é usado em nenhuma Server Action — ou seja, dados vindos do cliente não são validados contra um schema antes de tocar o banco.
8. **Campos financeiros usam `Float`, não `Decimal`.** O próprio README já registra isso como dívida técnica: risco real de erro de arredondamento em relatórios financeiros de um ERP cujo produto principal é dinheiro.
9. **Sem CI.** A suíte `testAll.ts` existe mas roda só manualmente; não há GitHub Actions rodando testes/lint/build a cada mudança.
10. **Backup é uma ação manual**, sem agendamento automático nem cópia fora da máquina local.

Nenhum desses pontos invalida o trabalho feito — pelo contrário, a arquitetura de domínio é sólida o bastante para suportar tudo isso sem redesenho. O que falta é a camada de "produto de verdade": segurança de servidor, persistência de produção, integrações reais e disciplina de engenharia.

---

## Como usar este documento

Este arquivo foi escrito para ser colado diretamente como prompt de trabalho para um desenvolvedor ou para um agente de codificação (Claude Code, Cursor etc.) executar o sistema por fases. As fases estão em ordem de prioridade: **não pule a Fase 0** — ela é o que impede que o beta vaze dados de clientes reais.

---

## PROMPT DE MELHORIA

Você vai evoluir um ERP de prestação de serviços (Next.js 16 App Router, React 19, TypeScript, Prisma, Tailwind v4) do estágio atual de protótipo funcional para um produto pronto para um **beta fechado com clientes reais**. O domínio de negócio (schema Prisma, fluxo CRM → Orçamento → OS → Execução → Faturamento → Financeiro) está correto e não deve ser redesenhado — o trabalho é de robustez, segurança e integrações reais. Execute na ordem abaixo.

### Fase 0 — Bloqueadores de segurança (obrigatório antes de qualquer beta com dados reais)

1. Implementar autenticação real de servidor: sessão via cookie `httpOnly` assinado (ex: `next-auth`/`Auth.js`, `lucia-auth`, ou JWT próprio validado em middleware). Remover a dependência de `localStorage` como fonte de verdade de sessão em `AuthContext.tsx`.
2. Criar `middleware.ts` protegendo todas as rotas de `(admin)` e `execucao`, redirecionando usuários não autenticados para o login.
3. Adicionar uma função `requireAuth()`/`requirePermission(code)` centralizada em `src/lib/auth.ts` e chamá-la no início de **toda** Server Action em `src/app/actions/*.ts` antes de tocar o Prisma. Hoje nenhuma action valida quem está chamando.
4. Auditar `AuditLog` para garantir que o `userId` gravado vem da sessão de servidor, não de um parâmetro enviado pelo cliente (hoje é possível forjar quem fez a ação).
5. Adicionar rate limiting no endpoint de login e travar conta após N tentativas falhas.
6. Revisar `hashPassword` (PBKDF2 com salt fixo `"nx_erp_salt_key_2026"`) — trocar para salt único por usuário (armazenado no registro) e migrar para `bcrypt`/`argon2` via biblioteca mantida.

### Fase 1 — Fundação de produção

7. Migrar o `datasource` do Prisma de SQLite para PostgreSQL de verdade (as dependências `pg` e `@prisma/adapter-pg` já existem). Atualizar `docker-compose.prod.yml` para subir um serviço Postgres gerenciado ou apontar para um Postgres gerenciado (Neon, Supabase, RDS). Rodar as migrations de dados existentes.
8. Converter todos os campos monetários de `Float` para `Decimal` (`Numeric(10,2)`) no schema, e usar `decimal.js` (ou o tipo `Decimal` do Prisma) em todos os cálculos financeiros — orçamentos, OS, faturamento, DRE, conciliação.
9. Substituir armazenamento de fotos/assinatura em base64 no banco por upload para object storage (S3, Cloudflare R2 ou similar), guardando apenas a URL no banco. Aplica-se a `ServiceOrderPhoto`, `signatureBase64` e `Attachment`.
10. Implementar backup automático agendado (cron job ou serviço gerenciado do Postgres) com retenção e teste de restore — não deixar como ação manual.
11. Adicionar `zod` (já está no `package.json`) para validar o payload de entrada de toda Server Action antes de qualquer escrita no banco.
12. Configurar logger estruturado (`pino` ou similar) substituindo os ~159 `console.log`/`console.error` espalhados pelo código, com níveis e correlação por request.
13. Reduzir os 162 usos de `any` no código para tipos reais, priorizando as Server Actions que tocam dinheiro (`financialActions.ts`, `billingActions.ts`, `quoteActions.ts`, `osActions.ts`).

### Fase 2 — Completar funcionalidades que hoje são simulação

14. Implementar emissão real de NFS-e via um provedor (Focus NFe, PlugNotas ou NFE.io são as opções mais usadas no Brasil para prestadores de serviço) substituindo a troca de status simulada em `billingActions.ts`.
15. Implementar envio real de orçamento/relatório de conclusão ao cliente por e-mail (Resend/SendGrid) e, se fizer sentido para o público-alvo, WhatsApp Business API — hoje "enviar" é só uma mudança de status.
16. Implementar geração de PDF real para orçamento, OS e relatório de conclusão (ex: `@react-pdf/renderer` ou Puppeteer server-side), não depender só do "imprimir" do navegador.
17. Completar ou remover as páginas mortas `/agenda` (`src/app/(admin)/agenda/page.tsx`) e `/servicos` (`src/app/(admin)/servicos/page.tsx`), que hoje retornam `null` e aparecem como links quebrados no menu.
18. Revisar o upload de fotos da execução técnica em `src/app/execucao/page.tsx` — remover a URL mock `/mock/photos/...` e conectar ao fluxo real de upload da Fase 1 (item 9).

### Fase 3 — Preparar para vender como SaaS (se a meta é múltiplos clientes, não só a Antigravity)

19. Introduzir isolamento multi-tenant: adicionar `companyId`/`tenantId` nas entidades principais (Client, Lead, Quote, ServiceOrder, Invoice, financeiro, estoque) e filtrar por tenant em toda query. Alternativa mais rápida para o beta: um banco por cliente — mais simples de implementar agora, migra para multi-tenant depois.
20. Criar fluxo de onboarding self-service: cadastro de nova empresa, convite de usuários, configuração inicial (dados da empresa, perfis, catálogo de serviços/produtos).
21. Definir modelo de planos/cobrança (mesmo que simples: trial de N dias + um plano único) e integrar um gateway (Stripe, Pagar.me) se o beta já for cobrado.
22. Criar uma landing page comercial simples fora do app (proposta de valor, prints do produto, formulário de lista de espera/CTA para agendar demo) — hoje o projeto não tem nenhuma face pública.

### Fase 4 — Qualidade e confiabilidade contínua

23. Formalizar a suíte `src/tests/testAll.ts` em testes automatizados de verdade (Vitest ou Jest), rodando contra um banco de teste isolado.
24. Criar workflow de CI (GitHub Actions) rodando lint, build e testes em cada push/PR — hoje não existe nenhum.
25. Adicionar monitoramento de erros em produção (Sentry ou similar) e um health-check endpoint para uptime monitoring.
26. Escrever um runbook de incidente/rollback simples para o beta (o que fazer se o banco cair, como restaurar backup, como reverter um deploy).

### Critério de pronto para o beta

O beta pode ser liberado para usuários reais somente quando a Fase 0 e a Fase 1 estiverem 100% concluídas — são elas que protegem dados reais de clientes. As Fases 2–4 podem ser priorizadas com base no feedback dos primeiros usuários do beta, mas os itens 14 (NFS-e) e 15 (envio real) são difíceis de vender como "beta" sem eles, já que são funcionalidades centrais de um ERP de prestação de serviços anunciadas no próprio fluxo do produto.

---

*Documento gerado a partir de uma auditoria direta do código-fonte em `/Users/lucasribeiro/ERP NOVO v23` (schema Prisma, Server Actions, contexto de autenticação, configuração de deploy e busca por simulações/mocks no código).*
