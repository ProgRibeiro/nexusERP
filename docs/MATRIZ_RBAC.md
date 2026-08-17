# Matriz RBAC — Tabela de Quem Pode o Quê (Slide 4/14)

Esta matriz define a política de **Role-Based Access Control (RBAC)** do Nexus ERP. Nenhuma ação no servidor executa sem validar os códigos de permissão associados ao usuário logado na sessão de servidor (`httpOnly` cookie).

---

## 1. Legenda de Operações
- **R (Read):** Leitura e consulta de dados no módulo.
- **W (Write):** Criação, edição e alteração de cadastros/registros.
- **A (Admin/Approve):** Aprovação com trava de margem, cancelamento, alteração de configurações e auditoria.
- **E (Execute):** Check-in, preenchimento de checklist técnico, anexar fotos e assinatura digital em campo.
- **— (Nenhum):** Acesso totalmente bloqueado (redirecionado/ocultado).

---

## 2. Matriz de Níveis de Acesso por Perfil

| Módulo / Funcionalidade | Administrador | Gestor | Comercial | Operacional | Técnico | Faturamento | Financeiro | Cliente (Portal) |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Dashboard e Métricas** | R / A | R | R | R | R | R | R | — |
| **CRM e Funil de Vendas** | R / W / A | R / W | R / W | — | — | — | — | — |
| **Cadastro de Clientes** | R / W / A | R / W | R / W | R | R | R | R | — |
| **Orçamentos & Margem** | R / W / A | R / W / A | R / W | R | — | R | R | R (Somente Próprios) |
| **Ordem de Serviço & Agenda** | R / W / A | R / W / A | R | R / W | R / E | R | R | R (Somente Próprias) |
| **Execução Móvel & Fotos** | R / W / A | R / A | — | R / W | R / E | R | — | R (Relatório Concluído) |
| **Contratos Recorrentes PMOC** | R / W / A | R / W / A | R / W | R / W | R | R | R | R (Somente Próprios) |
| **Faturamento Fiscal (NFS-e)** | R / W / A | R / A | — | R | — | R / W | R | — |
| **Financeiro (Pagar/Receber)** | R / W / A | R / A | — | — | — | R | R / W | — |
| **DRE & Conciliação Bancária** | R / W / A | R / A | — | — | — | — | R / W | — |
| **Almoxarifado & Estoque** | R / W / A | R / W | R | R / W | R / E | — | R | — |
| **Gestão de Prestadores** | R / W / A | R / W / A | — | R / W | — | R | R / W | — |
| **Fila de Erros Reportados** | R / W / A | R / W | — | — | — | — | — | — |
| **Configurações & Flags** | R / W / A | — | — | — | — | — | — | — |

---

## 3. Códigos de Permissão Mapeados no Servidor (`src/lib/auth.ts`)

| Código de Permissão | Ação Protegida no Servidor |
|---|---|
| `crm.read` / `crm.write` | Acessar e alterar oportunidades de vendas no CRM |
| `quotes.read` / `quotes.write` / `quotes.approve` | Gerenciar propostas e aprovar orçamentos abaixo do piso de margem |
| `os.read` / `os.write` / `os.execute` | Criar, atribuir técnicos, agendar e executar ordens de serviço |
| `billing.read` / `billing.write` | Transmitir notas fiscais NFS-e e cancelar títulos fiscais |
| `finance.read` / `finance.write` | Liquidar baixas de contas a receber e pagar despesas bancárias |
| `inventory.read` / `inventory.write` | Ajustar saldos de estoque e efetuar requisições |
| `users.manage` | Criar usuários, alterar papéis e redefinir credenciais |
| `config.manage` | Alterar variáveis do sistema e mudar Feature Flags |

---

## 4. Mecanismo de Defesa no Banco e no Código

- **No Servidor (Server Actions):** Toda Server Action valida a sessão com `requireAuth()` e `requirePermission("codigo")`.
- **No Banco de Dados (PostgreSQL RLS):** As políticas de `Row Level Security` garantem que mesmo queries diretas no banco filtrem pelo `tenant_id` e permissão do usuário.
