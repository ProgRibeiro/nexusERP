<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 🤖 ANTIGRAVITY AGENT CONTEXT & USER DIRECTIVES — NEXUS ERP

Para entender instantaneamente 100% da arquitetura, regras de negócio, layout intuitivo, importador universal, estorno financeiro e divisão de Estoque Presente vs. Futuro em qualquer computador, leia o arquivo:
👉 **[docs/ANTIGRAVITY_CONTEXT.md](./docs/ANTIGRAVITY_CONTEXT.md)**

### Principais Diretrizes do Projeto:
1. **Divisão de Estoque:** `stockQuantity` (Presente/Físico) vs. `futureStock` (Futuro/A Comprar) com conversão em 1 clique (`convertFutureStockToPresentAction`).
2. **Importador Universal NEXUS ONE:** Suporta arquivos `.csv`, `.tsv`, `.txt` via upload do computador, colar texto ou link do Google Sheets com suporte ao modelo de colunas (`nome`, `preco custo`, `preco venda`, `quantidade estoque`, `estoque minimo`, `unidade`, `Estoque` [futuro/presente]).
3. **Módulo Financeiro:** Suporte a baixa rápida integrada com faturamento e botão de estorno seguro (`[ ↩️ Estornar para Não Recebido ]`).
4. **Layout:** Sem gaveta sanfona "Mais ferramentas"; menu lateral com seções diretas; auditoria e console técnico isolados na rota `/dev`.
5. **Software Desktop Nativo:** Suíte multi-linguagem em `desktop_app/` com API `/api/desktop-app/download` e botões no site (`/site`) e ERP.
6. **Tutorial Interativo:** Componente `<ERPInteractiveTutorialModal>` acessível via Header e Sidebar.

