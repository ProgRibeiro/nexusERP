# Plano mestre de evolução do NX ERP

Este documento transforma a especificação funcional em entregas incrementais. A regra é preservar dados, manter compatibilidade com o PostgreSQL e validar cada fase antes da próxima.

## Fase 1 — Fundação operacional (concluída)

- Design global claro/escuro e responsivo consolidado.
- Componentes reutilizáveis adicionados: `Textarea`, `MoneyInput`, `EmptyState` e `Skeleton`.
- Sidebar recolhível persistente com indicadores de OS, faturamento, inadimplência e estoque.
- Busca global multi-termo para clientes, contatos, endereços, leads, equipamentos, OS, orçamentos, notas, contas, contratos, produtos e usuários.
- Command palette e busca disponíveis também no tablet/celular.
- Botão `+ Novo` contextual para cliente, OS, financeiro, estoque e contratos.
- Abas internas persistidas e restauradas entre sessões, incluindo abas fixadas e alertas.
- Dashboard alinhado ao fluxo real: relatório aprovado, liberação fiscal, emissão de NF e pagamento.
- Criação manual de OS com cliente, endereço, contato, prioridade, tipo, histórico e auditoria.
- Esteira fiscal limitada a OS realmente liberadas para faturamento.
- Teste automatizado do fluxo OS e compilação de produção aprovados.

Nenhuma migration foi necessária nesta fase.

## Fase 2 — CRM, cliente e orçamento

- Perfil 360º do cliente com resumo financeiro, equipamentos, arquivos e próximas ações.
- CRM com tarefas, follow-ups, motivo de perda, responsáveis e filtros salvos.
- Orçamentos com versões visíveis, duplicação, histórico de envio e aprovação externa.
- Modelos candidatos: `Opportunity`, `CrmNote` e ampliação segura de `QuoteVersion`.

## Fase 3 — Operação e técnico

- SLA, check-in/check-out, timesheet e geolocalização opcional.
- Checklist estruturado por tipo de serviço.
- Relatório bloqueado após aprovação, com fluxo explícito de revisão.
- Área técnica mobile-first reduzida às OS atribuídas.
- Models candidatos: `ServiceOrderChecklist`, `ServiceOrderTimesheet`, `CompletionReportPhoto` e `CompletionReportSignature`.

## Fase 4 — Financeiro gerencial

- Categorias e centros de custo normalizados.
- Pagamentos parciais também em contas a pagar.
- Anexos, renegociação, multa, juros e desconto auditáveis.
- Fluxo previsto x realizado, DRE configurável e lucro líquido por OS.
- Models candidatos: `FinancialCategory`, `CostCenter`, `PaymentReceipt`, `FinancialAttachment`, `TaxProvision`, `RecurringFinancialEntry`, `DreGroup` e `DreAccount`.

## Fase 5 — Fiscal brasileiro

- Configuração por empresa, município e regime tributário.
- Assistente de NFS-e com checklist pré-emissão e logs de rejeição.
- Arquivos XML/PDF e histórico imutável de eventos fiscais.
- Models candidatos: `FiscalConfig`, `ServiceTaxCode`, `TaxRetention`, `FiscalLog`, `InvoiceItem` e `InvoiceFile`.

## Fase 6 — Compras, contratos e automações

- Pedido de compra e fornecedor vinculados a materiais e OS.
- Recorrência idempotente de OS preventiva e cobrança.
- Reajustes contratuais com histórico.
- Models candidatos: `PurchaseOrder`, `PurchaseOrderItem` e `ContractBillingRule`.

## Critérios obrigatórios para cada fase

1. Backup válido antes de migrations.
2. Migration aditiva e reversível sempre que possível.
3. Server Actions com autenticação, permissão, validação e transação.
4. Nenhuma exclusão física de lançamentos financeiros/fiscais operacionais.
5. Teste de integração dos fluxos alterados.
6. `npm run build` aprovado antes de atualizar o servidor.

## Comandos de validação

```bash
npm install
npx prisma generate
npx prisma migrate dev
npx tsx src/tests/testOSWorkflow.ts
npm run build
npm run dev
```

Em produção Linux, migrations devem usar `npx prisma migrate deploy`, nunca `migrate dev`.
