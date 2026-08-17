# Mapa do Sistema e Diagramas UML — Nexus ERP (Slide 3/14)

Este documento detalha o mapa de arquitetura, diagrama de sequências e modelo de entidade-relacionamento (ER / UML) do sistema Nexus ERP, descrevendo como os componentes conversam entre si e como as requisições navegam desde o navegador/PWA até o banco de dados.

---

## 1. Arquitetura Geral de Componentes (WAF, Middleware, RBAC e DB)

```mermaid
flowchart TD
  subgraph Cliente["Cliente / PWA / App Móvel"]
    UI["React 19 / Next.js Client Components"]
    ErrBtn["ErrorReporter Button (Screenshot + Logs)"]
  end

  subgraph Perimetro["Camada de Borda & Escudo"]
    TLS["TLS/SSL HSTS Full Strict (HTTPS)"]
    WAF["WAF & Bot Fight Mode (Filter Suspicious User-Agents)"]
    RL["Rate Limiter (120 req/10s por IP)"]
  end

  subgraph Aplicacao["Aplicação Next.js App Router"]
    MW["Middleware (Cookie HttpOnly + RateLimit Headers)"]
    SA["Server Actions (requireAuth + requirePermission)"]
    FF["Feature Flags Manager (Módulos Ativos)"]
  end

  subgraph BancoDados["Banco de Dados & Isolamento"]
    PG[(PostgreSQL Database)]
    RLS["Row Level Security (app.tenant_id Isolation)"]
    Audit["AuditLog Engine (Trilha Auditada)"]
    ErrQueue["ErrorReport Table (Fila de Erros)"]
  end

  subgraph ServicosExternos["Integrações & Storage"]
    S3["Object Storage (S3 / R2 - Fotos & PDFs)"]
    Mail["Gmail OAuth2 / SMTP Email"]
    NFSe["Focus NFe / PlugNotas API (NFS-e)"]
  end

  UI --> TLS
  TLS --> WAF
  WAF --> RL
  RL --> MW
  MW --> SA
  SA --> FF
  SA --> RBAC["RBAC Permission Guard (src/lib/auth.ts)"]
  RBAC --> RLS
  RLS --> PG
  SA --> Audit
  ErrBtn --> SA
  SA --> ErrQueue
  SA --> S3
  SA --> Mail
  SA --> NFSe
```

---

## 2. Diagrama de Sequência — Ciclo de Vida do Negócio (Lead → Orçamento → OS → Execução → Faturamento → Financeiro)

```mermaid
sequenceDiagram
  autonumber
  actor User as Usuario / Tecnico
  participant UI as Next.js Interface
  participant MW as Middleware (WAF/RateLimit)
  participant Action as Server Action (src/app/actions)
  participant RBAC as Auth Guard (requirePermission)
  participant DB as PostgreSQL (RLS Tenant)
  participant Audit as AuditLog

  User->>UI: 1. Cadastra Lead / Orçamento
  UI->>MW: 2. Requisição HTTP / Server Action
  MW->>Action: 3. Repassa chamada com cabeçalhos de segurança
  Action->>RBAC: 4. Valida Token de Sessão & Código de Permissão
  RBAC-->>Action: 5. Permissão Confirmada
  Action->>DB: 6. Grava Lead / Orçamento (Tenant Scoped)
  Action->>Audit: 7. Registra Log de Auditoria
  DB-->>UI: 8. Retorna Orçamento Criado

  User->>UI: 9. Aprova Orçamento
  UI->>Action: 10. Converte Orçamento em Ordem de Serviço (OS)
  Action->>DB: 11. Gera OS e Agenda Técnico
  DB-->>UI: 12. Notificação de Agendamento Enviada

  User->>UI: 13. Técnico faz Check-in & Upload de Foto/Assinatura
  UI->>Action: 14. Submete Execução Técnica
  Action->>DB: 15. Salva Evidências e Finaliza OS
  Action->>DB: 16. Libera OS para Faturamento

  User->>UI: 17. Faturamento emite Nota Fiscal
  UI->>Action: 18. Emite NFS-e e Registra Contas a Receber
  Action->>DB: 19. Atualiza Status Fiscal e Financeiro
```

---

## 3. Diagrama de Sequência — Reporte Global de Erros (Slide 9/14)

```mermaid
sequenceDiagram
  autonumber
  actor User as Usuário / Cliente
  participant Component as Componente UI / React Boundary
  participant ErrorBtn as Botão Reportar Erro
  participant Action as createErrorReport Action
  participant DB as Tabela ErrorReport
  participant AdminUI as Fila de Erros (Configurações)

  User->>Component: Ocorre um erro não tratado ou dúvida visual
  Component->>ErrorBtn: Registra exceção no buffer de logs
  User->>ErrorBtn: Clica no botão "Reportar Erro"
  ErrorBtn->>ErrorBtn: Captura URL, UserAgent, Logs do Console e Canvas da Tela
  User->>ErrorBtn: Digita descrição e clica "Enviar relato"
  ErrorBtn->>Action: Invoca createErrorReport() com payload e screenshot
  Action->>DB: Grava registro com status "ABERTO" e protocolo
  DB-->>User: Exibe toast "Erro reportado com sucesso. Protocolo #XXXX"
  AdminUI->>DB: Equipe acessa Fila de Erros e visualiza o chamado com print
```

---

## 4. Diagrama de Entidades & Relacionamentos (UML / ERD)

```mermaid
erDiagram
  USER {
    string id PK
    string name
    string email
    string roleId FK
    string permissions
    string salt
  }

  ROLE {
    string id PK
    string name
    string description
  }

  CLIENT {
    string id PK
    string name
    string cpfCnpj
    string email
    string phone
    string status
  }

  QUOTE {
    string id PK
    string clientId FK
    string status
    float totalValue
    int version
  }

  SERVICE_ORDER {
    string id PK
    string quoteId FK
    string clientId FK
    string status
    string priority
    datetime scheduledAt
  }

  EVIDENCE {
    string id PK
    string serviceOrderId FK
    string photoUrl
    string step
  }

  INVOICE {
    string id PK
    string serviceOrderId FK
    string number
    string status
    float amount
  }

  ACCOUNTS_RECEIVABLE {
    string id PK
    string invoiceId FK
    string clientId FK
    float amount
    string status
  }

  AUDIT_LOG {
    string id PK
    string userId FK
    string action
    string entity
    string entityId
  }

  ERROR_REPORT {
    string id PK
    string userId FK
    string pageUrl
    string errorMessage
    string screenshotData
    string status
  }

  USER }|--|| ROLE : possui
  CLIENT ||--o{ QUOTE : solicita
  QUOTE ||--o| SERVICE_ORDER : gera
  SERVICE_ORDER ||--o{ EVIDENCE : registra
  SERVICE_ORDER ||--o| INVOICE : gera
  INVOICE ||--o{ ACCOUNTS_RECEIVABLE : contabiliza
  USER ||--o{ AUDIT_LOG : gera
  USER ||--o{ ERROR_REPORT : reporta
```
