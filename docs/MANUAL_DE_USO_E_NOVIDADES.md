# 📖 Manual de Uso Completo & Novidades - NEXUS ERP

Este documento reúne a descrição detalhada de todas as inovações, recursos operacionais e financeiros implementados no **NEXUS ERP**, para que qualquer membro da equipe ou novo computador conectado tenha visão 100% clara do funcionamento do sistema.

---

## 🖥️ 1. Suíte de Software Desktop Nativo (Windows, Mac & Linux)

O sistema possui uma suíte desktop nativa que pode ser baixada diretamente do ERP ou do site institucional (`/site`).

### Recursos do Software Desktop:
* **Execução Nativa em Janela Isolada:** Funciona sem a barra de navegação do navegador.
* **Teste de Latência VPS em Tempo Real:** Medição de ping em milissegundos para os servidores VPS (ex: Hostinger).
* **Multi-Linguagens Disponíveis:**
  * **Python GUI (`desktop_app/nexus_erp_desktop.py`):** Interface nativa em Tkinter/PyQt com Webview acelerada.
  * **Launcher C Nativo (`desktop_app/nexus_desktop_launcher.c`):** Binário ultrarrápido para Windows/Linux.
  * **Launcher Java Enterprise (`desktop_app/NexusERPLauncher.java`):** Aplicação de alta compatibilidade em JVM.
* **Como Baixar:** Acesse a barra superior ou lateral e clique no botão **`[ 🖥️ App Desktop & VPS ]`** ou acesse a rota `/api/desktop-app/download`.

---

## 📦 2. Divisão de Estoque Presente (Físico) vs. Estoque Futuro (A Comprar)

No módulo de **Almoxarifado & Estoque (`/estoque`)**, os materiais agora possuem classificação dupla:

1. **📦 Estoque Presente (Físico):** Peças e materiais disponíveis fisicamente no almoxarifado para pronta entrega.
2. **⏳ Estoque Futuro (A Comprar / Encomendado):** Materiais previstos em orçamentos, OPs ou compras futuras para novas obras.

### Funcionalidade de Conversão em 1 Clique (`⚡ Dar Entrada (Físico)`):
* Quando a compra de peças chega no almoxarifado, o operador não precisa recadastrar o produto.
* Basta clicar no botão **`[ ⚡ Dar Entrada (Físico) ]`** na tabela de estoque.
* O sistema reduz automaticamente a quantidade do *Estoque Futuro* e transfere para o *Estoque Presente (Físico)*, gerando a movimentação de estoque (`StockMovement`) e log de auditoria.

---

## 📊 3. Importador Universal NEXUS ONE com Planilha Modelo Padrão

O importador inteligente **NEXUS ONE** ([`/src/components/modals/NexusOneImporterModal.tsx`](file:///Users/lucasribeiro/ERP%20NOVO%20v23/src/components/modals/NexusOneImporterModal.tsx)) permite subir planilhas em CSV, Excel ou TSV.

### Colunas Padrão da Planilha:
| Coluna | Descrição | Exemplo |
| :--- | :--- | :--- |
| `NOME` | Nome do produto / equipamento / insumo | *Ar-condicionado 9.000 BTU/h TCL* |
| `PRECO_CUSTO` | Valor de compra / custo unitário | *1775,55* |
| `PRECO_VENDA` | Valor de venda para orçamentos e OS | *1775,55* |
| `QUANTIDADE_ESTOQUE` | Quantidade do item | *0* ou *10* |
| `ESTOQUE_MINIMO` | Alerta de estoque crítico | *1* |
| `UNIDADE` | Unidade de medida | *UN*, *M*, *KIT*, *CX* |
| `ESTOQUE` | Classificação do estoque | *Estoque futuro* ou *Estoque presente* |
| `CODIGO_PRODUTO` | SKU / Código de referência | *AC-TCL-9K* |
| `CLIENTE` | Razão social ou nome do cliente | *Espaço Hering Salvador* |
| `CODIGO_OS` | Código da Ordem de Serviço | *NX-1001* |
| `STATUS_PAGAMENTO` | Situação financeira | *PAGO* ou *ABERTO* |

### Como baixar a planilha modelo em 1 clique:
Acesse o menu ou qualquer modal do importador e clique em **`[ 📥 Baixar Planilha Modelo (Excel/CSV) ]`**.

---

## 💰 4. Módulo Financeiro & Estorno Rastreável em 1 Clique

No módulo **Financeiro (`/financeiro`)** e na **Baixa Rápida**:
* Ao dar baixa em uma conta ou receita, o valor entra imediatamente no caixa/faturamento.
* **Opção de Estorno Seguro:** Caso haja algum engano ou digitação incorreta, o usuário pode clicar no botão **`[ ↩️ Estornar para Não Recebido ]`**.
* O lançamento retorna ao estado anterior de "Pendente/Não Recebido", mantendo o extrato e os logs de auditoria devidamente registrados sem perda de histórico.

---

## 📖 5. Guia & Tutorial Interativo (`<ERPInteractiveTutorialModal>`)

Na barra superior do sistema (Header) e no menu lateral (Sidebar), há o botão em destaque:
👉 **`[ 📖 Guia & Tutorial ]`**

O tutorial é dividido em 5 módulos com ilustrações e dicas práticas:
1. **Visão Geral e Navegação por Abas**
2. **Abertura e Baixa Rápida de OS com Fotos**
3. **Financeiro, Baixa com Caixa Geral e Estorno**
4. **Importador NEXUS ONE e Planilha Modelo**
5. **Software Desktop Nativo & VPS**

---

## 🎨 6. Layout Simplificado e Intuitivo

* **Fim da sanfona "Mais Ferramentas":** Todos os módulos (Vendas, Operação, Fiscal, Suporte, Dev) estão acessíveis diretamente no menu vertical.
* **Área Dev e Auditoria Isolada:** Logs de sistema, backups, controle de subdomínios e feature flags foram organizados na rota `/dev` para manter a experiência limpa para os usuários operacionais.

---

## ⚙️ 7. Atualização de Servidores VPS Hostinger

Para puxar todas as descrições, modelos de dados e atualizações no servidor de produção:

```bash
cd /opt/nexus-erp/source
git pull origin main
sudo REQUIRE_OFFSITE_BACKUP=false bash deploy/update-linux.sh
```
