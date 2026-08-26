# 🤖 Contexto Mestre Antigravity — NEXUS ERP

Este arquivo serve como o **Guia Central de Contexto para a Antigravity AI** em qualquer computador. Ao abrir este projeto em um novo ambiente ou computador, a Antigravity lerá estas diretrizes e entenderá 100% das regras de negócio, inovações implementadas e preferências do usuário.

---

## 🎯 1. Visão Geral do Sistema
O **NEXUS ERP** é uma plataforma completa de gestão de serviços e engenharia (climatização, elétrica, civil, facilities). O núcleo central é a **Ordem de Serviço (OS)**, conectando vendas, CRM, campo, estoque e faturamento financeiro.

---

## 📌 2. Regras de Negócio e Preferências do Usuário

### A. Almoxarifado: Divisão de Estoque Presente vs. Estoque Futuro
* **Estoque Presente (Físico):** Peças disponíveis no almoxarifado para pronta entrega (`product.stockQuantity`).
* **Estoque Futuro (A Comprar):** Peças previstas em orçamentos, OPs ou compras para obras futuras (`product.futureStock`).
* **Entrada em 1 Clique:** Na tela de estoque (`/estoque`), o botão **`[ ⚡ Dar Entrada (Físico) ]`** converte instantaneamente o *Estoque Futuro* em *Estoque Presente*, registrando o histórico de movimentação (`StockMovement`).

### B. Importador Universal NEXUS ONE
* Aceita arquivos **.CSV, .TSV, .TXT** via seleção de arquivo no computador (Drag & Drop), colar texto ou Link Público do Google Sheets.
* Mapeia nativamente o modelo de planilha com as colunas:
  * `NOME` / `nome`
  * `PRECO_CUSTO` / `preco custo`
  * `PRECO_VENDA` / `preco venda`
  * `QUANTIDADE_ESTOQUE` / `quantidade estoque`
  * `ESTOQUE_MINIMO` / `estoque minimo`
  * `UNIDADE` / `unidade`
  * `ESTOQUE` / `Estoque` (*Estoque futuro* ou *Estoque presente*)
  * `CODIGO_PRODUTO`, `CLIENTE`, `CODIGO_OS`, `STATUS_PAGAMENTO`

### C. Módulo Financeiro & Estorno Seguro
* Baixa rápida de OS gera lançamento financeiro automático.
* **Recurso de Estorno:** Qualquer título ou recebimento baixado possui a opção **`[ ↩️ Estornar para Não Recebido ]`**, permitindo retornar ao estado anterior sem perda de histórico de auditoria.

### D. Interface do Usuário e Foto de Perfil
* O perfil do usuário (ex: Lucas Ribeiro) fica localizado no **canto superior direito do Header**, permitindo alterar o nome e enviar a URL da foto de perfil.

### E. Suíte de Software Desktop Nativo
* Suíte desktop nativa multi-linguagem em `desktop_app/`:
  * `nexus_erp_desktop.py` (Python GUI + Webview + Medidor de Latência VPS)
  * `nexus_desktop_launcher.c` (Launcher Nativo C)
  * `NexusERPLauncher.java` (Launcher Java Enterprise)
* Endpoint `/api/desktop-app/download` gera o pacote para download.
* Botões de download em destaque no site institucional (`/site`) e no topo do ERP.

### F. Layout Intuitivo Sem "Mais Ferramentas"
* A barra lateral (`Sidebar.tsx`) expõe todas as seções diretamente (Dia a Dia, Vendas, Operação, Fiscal, Suporte e Dev/Auditoria), sem gaveta sanfona "Mais Ferramentas".
* Recursos técnicos e logs estão organizados na rota `/dev`.

### G. Tutorial Interativo Integrado
* Botão **`[ 📖 Guia & Tutorial ]`** no Header e Sidebar aciona a modal `<ERPInteractiveTutorialModal>` com treinamento em 5 etapas para novos colaboradores.

### H. Ordem de Serviço (OS): Modo Rápido (Serviço Comum) vs. Modo Elaborado (Preventiva de Loja)
* **OS de Serviço Comum (Sem Burocracia):** Inicia automaticamente no **Modo Rápido / Simplificado**, concentrado nos 3 blocos essenciais:
  1. 📅 **Agendamento & Técnico** (Data, Horário, Técnico Responsável, Local de Execução).
  2. 🏢 **Pedido de Compra (PO) & Fiscal do Cliente** (Cliente, CNPJ/CPF, Campo para Salvar PO do Cliente, Valor).
  3. 📋 **Relatório & Fotos Rápido** (Descrição da Execução, Fotos Antes/Depois e Conclusão Rápida em 1 Clique).
* **OS de Preventiva de Contrato (Loja):** Quando a OS é vinculada a um contrato de loja (`contractId` / `operationKind === "VISITA_PREVENTIVA"`), ela ativa o **Modo Elaborado Completo**, com o checklist técnico de inspeção da loja, medições de PMOC, ativos da loja e rotinas de auditoria.
* **Alternância em 1 Clique:** O botão no topo da OS permite alternar entre `[ ⚡ Modo Rápido ]` e `[ 📋 Modo Elaborado ]` a qualquer momento.

---

## 🛠️ 3. Principais Arquivos do Código

* **Prisma Schema:** `prisma/schema.prisma` (Model `Product` possui `stockQuantity` e `futureStock`).
* **Ações de Estoque:** `src/app/actions/inventoryActions.ts` (`convertFutureStockToPresentAction`, `getProducts`, `createProduct`).
* **Ações de Importação:** `src/app/actions/nexusOneImportActions.ts` (`parseTsvAndImportNexusOne`, `importGoogleSpreadsheetAction`).
* **Componente de Estoque:** `src/components/tabs/EstoqueTab.tsx`.
* **Modal Importador:** `src/components/modals/NexusOneImporterModal.tsx`.
* **Modal Tutorial:** `src/components/modals/ERPInteractiveTutorialModal.tsx`.
* **Modal App Desktop:** `src/components/modals/DesktopAppLauncherModal.tsx`.
* **Layout Navegação:** `src/components/Sidebar.tsx` e `src/components/Header.tsx`.

---

## 🚀 4. Comandos Importantes

```bash
# Executar servidor local de dev:
npm run dev

# Gerar Prisma Client:
npx prisma generate

# Compilar projeto para produção:
npm run build

# Atualizar servidor VPS Hostinger:
cd /opt/nexus-erp/source && sudo REQUIRE_OFFSITE_BACKUP=false bash deploy/update-linux.sh
```
