# PRD — Nexus ERP

**Produto:** Nexus ERP para empresas prestadoras de serviços  
**Versão do documento:** 1.1  
**Data:** 17 de agosto de 2026  
**Status:** Documento-base para evolução do produto  
**Responsável pelo produto:** Nexus Manutenção

## 1. Resumo executivo

O Nexus ERP é um sistema web integrado para empresas de manutenção e prestação de serviços. O produto conecta o ciclo comercial, operacional, fiscal, financeiro e de relacionamento com prestadores, usando a Ordem de Serviço (OS) como registro central da operação.

O principal objetivo do produto é substituir processos espalhados em planilhas, mensagens e sistemas isolados por um fluxo simples, rastreável e persistente. A experiência deve exigir poucos cliques, evitar trocas de página e permitir que cadastros e lançamentos sejam realizados em janelas flutuantes sem perder o contexto de trabalho.

## 2. Problema

Empresas prestadoras de serviços normalmente enfrentam:

- retrabalho entre orçamento, OS, faturamento e financeiro;
- perda de informações de clientes, prestadores, fotos e documentos;
- dificuldade para conhecer o custo real e a margem dos serviços;
- excesso de telas e navegação para operações simples;
- baixa rastreabilidade de alterações e aprovações;
- dificuldade para acompanhar agenda, execução em campo e evidências;
- falta de visão consolidada do caixa, tributos e evolução no Simples Nacional;
- marketing diário sem calendário, responsáveis ou histórico centralizado.

## 3. Visão do produto

Ser o ambiente único de trabalho da empresa, do primeiro contato com o cliente ao recebimento financeiro, com operação simples o suficiente para uso diário e controles robustos o suficiente para proteger os dados do negócio.

### Princípios de experiência

1. **Poucos cliques:** ações frequentes devem estar visíveis e próximas do contexto.
2. **Uma área de trabalho:** detalhes e cadastros abrem em janelas flutuantes.
3. **Sem perda de contexto:** fechar uma janela retorna ao ponto exato do fluxo.
4. **Cadastro único:** clientes, serviços, materiais e prestadores são reutilizados em todos os módulos.
5. **Automação com revisão humana:** o sistema calcula e sugere, mas permite conferência autorizada.
6. **Persistência real:** dados operacionais devem ser armazenados no PostgreSQL, com validação e auditoria.
7. **Separação entre informação interna e externa:** custos, encargos e margens não aparecem nos documentos do cliente.

## 4. Objetivos

- reduzir o tempo necessário para criar orçamento e OS;
- eliminar redigitação entre comercial, operação, faturamento e financeiro;
- proteger cadastros e evidências contra perda acidental;
- tornar visível o custo e a rentabilidade de cada serviço;
- permitir operação de campo pelo celular;
- centralizar contas a pagar, receber, caixa, DRE e acompanhamento fiscal;
- organizar prestadores e seus pagamentos;
- manter um calendário operacional de marketing.

### Resultados esperados para a primeira versão estável

| Resultado | Meta inicial |
|---|---:|
| Criar uma proposta completa | até 5 minutos, sem contar a negociação |
| Converter proposta aprovada em OS | até 2 cliques |
| Abrir e atualizar a ficha de uma OS | sem sair da tela de origem |
| Realizar um lançamento financeiro | até 3 cliques após abrir o Financeiro |
| Persistência de cadastros válidos | 100% dos testes críticos aprovados |
| Duplicidade em baixa financeira | 0 ocorrências nos testes automatizados |
| Recuperação de backup | restauração homologada periodicamente |

## 5. Fora do escopo inicial

- escrituração contábil oficial;
- substituição do PGDAS-D ou de sistemas governamentais;
- cálculo trabalhista ou tributário com garantia jurídica automática;
- folha de pagamento completa;
- emissão bancária homologada sem integração específica;
- marketplace público de prestadores.

## 6. Usuários e perfis

| Perfil | Necessidade principal |
|---|---|
| Administrador | Configurar empresa, usuários, permissões e integrações |
| Gestor | Acompanhar indicadores, aprovar propostas e controlar operação |
| Comercial | Gerenciar leads, clientes, orçamentos e follow-ups |
| Operacional | Planejar agenda, OS, equipe, materiais e visitas |
| Técnico | Executar serviço, registrar tempo, medições, fotos e aceite |
| Faturamento | Conferir documentação, emitir e arquivar notas fiscais |
| Financeiro | Controlar contas, baixas, caixa, DRE e tributos |
| Marketing | Planejar, produzir, aprovar e acompanhar publicações |
| Prestador | Receber atividades, enviar evidências e acompanhar serviço |

### Jornadas prioritárias

1. **Comercial:** cadastrar cliente durante a proposta, compor preço, enviar e acompanhar a decisão.
2. **Operação:** converter proposta, planejar a OS, designar responsável e acompanhar a execução.
3. **Campo:** abrir atividade no celular, registrar evidências, concluir e coletar aceite.
4. **Financeiro:** faturar a OS, gerar parcelas, receber ou pagar e acompanhar caixa e tributos.
5. **Gestor:** consultar margem, prazos, inadimplência, capacidade operacional e evolução fiscal.
6. **Marketing:** planejar o calendário, produzir, aprovar e registrar a publicação diária.

## 7. Arquitetura da informação

O menu principal deve ser reduzido e organizado em grupos:

1. **Início:** painel e agenda.
2. **Comercial:** CRM, clientes e orçamentos.
3. **Operação:** OS, execução, preventivas e contratos.
4. **Financeiro:** faturamento, contas, caixa, DRE e fiscal no mesmo ambiente.
5. **Cadastros:** serviços, materiais, prestadores e empresa.
6. **Marketing:** calendário e produção de conteúdo.
7. **Gestão:** relatórios, configurações e auditoria.

Cadastros iniciados dentro de um fluxo devem abrir como modal ou aba flutuante. Uma nova página só deve ser usada quando a atividade exigir espaço integral ou acesso direto por URL.

## 8. Requisitos funcionais

### RF-01 — Área de trabalho e janelas flutuantes

- abrir cadastro, edição e detalhes sem abandonar a tela principal;
- permitir múltiplas abas internas abertas;
- preservar rascunhos durante navegação e falhas recuperáveis;
- permitir minimizar, restaurar e fechar janelas;
- alertar antes de fechar formulário com alterações não salvas;
- atualizar listas automaticamente após salvar um cadastro flutuante.

**Critério de aceite:** cadastrar um cliente, serviço ou prestador durante um orçamento e continuar a proposta sem recarregar ou voltar de página.

### RF-02 — CRM e clientes

- pipeline visual de leads e oportunidades;
- atividades, responsáveis, prazos e histórico;
- cadastro de pessoa física ou jurídica;
- múltiplos contatos, endereços, equipamentos e unidades;
- consulta de CNPJ quando integração estiver configurada;
- visão integrada de propostas, OS, contratos e financeiro do cliente.

### RF-03 — Catálogo e formação do preço de serviços

- cadastrar serviço próprio ou terceirizado;
- classificar mão de obra como CLT, profissional/pró-labore ou autônomo;
- vincular obrigatoriamente o prestador no serviço terceirizado;
- registrar materiais, mão de obra, equipamentos e outros custos diretos;
- configurar encargos de pessoal, administração, risco, margem e tributação;
- calcular preço sugerido internamente;
- manter código de referência, unidade, produtividade e tempo estimado;
- permitir o mesmo cadastro completo dentro da elaboração do orçamento.

**Regra:** encargos de pessoal incidem sobre a mão de obra. Custos, encargos, risco e margem são confidenciais e não integram a proposta apresentada ao cliente.

### RF-04 — Orçamentos e propostas

- criar proposta em poucos passos;
- selecionar ou cadastrar cliente sem sair da proposta;
- selecionar ou cadastrar serviço e material em janela flutuante;
- adicionar serviço terceirizado com prestador, custo e valor comercial;
- calcular quantidade, desconto, tributo da proposta e valor final;
- permitir valor final comercial personalizado mediante permissão;
- versionar alterações e registrar aprovação/reprovação;
- gerar documento profissional para impressão/PDF;
- enviar proposta por Gmail OAuth quando configurado;
- converter proposta aprovada em OS sem duplicidade.

**Informação do cliente:** descrição, quantidade, unidade, preço, desconto, tributo destinado ao governo, condições e total.  
**Informação interna:** custo, encargos, prestador, margem e memória de formação do preço.

### RF-05 — Ordem de Serviço

- criação manual ou automática a partir da proposta;
- fluxo simplificado de status;
- ficha da OS em janela flutuante;
- alteração de dados, responsáveis e status no mesmo contexto;
- agenda de visitas e técnicos;
- materiais previstos e utilizados;
- checklist por tipo de serviço;
- histórico imutável de mudanças importantes;
- geração de relatório final e liberação para faturamento.

### RF-06 — Execução em campo

- interface responsiva/PWA;
- check-in e check-out com data, hora e localização;
- cronômetro e apontamento de horas;
- checklists versionados;
- medições técnicas;
- fotos antes, durante e depois;
- assinatura e aceite do cliente;
- operação tolerante a instabilidade de conexão, quando aplicável.

### RF-07 — Prestadores

- cadastro persistente com CNPJ, contatos e dados de acesso;
- prevenção de duplicidade e validação antes de salvar;
- portal com autenticação própria;
- recebimento de atividades vinculadas à OS;
- envio de evidências e conclusão;
- criação rastreável de conta a pagar após aceite;
- vínculo entre prestador, serviço, orçamento, OS e pagamento.

### RF-08 — Faturamento

- fila única de OS liberadas;
- conferência de tomador, pedido, valores e descrição;
- registro de NFS-e e situação;
- armazenamento de PDF e XML;
- criação automática das parcelas a receber;
- tratamento de rejeições e pendências;
- trilha entre OS, nota e recebimento.

### RF-09 — Financeiro unificado

- apresentar caixa, contas a receber, contas a pagar, extrato e DRE em uma única área contínua;
- realizar novos lançamentos e edições em janelas flutuantes;
- baixar recebimentos totais ou parciais;
- pagar despesas e gerar transações vinculadas;
- impedir duplicidade de baixa;
- permitir estorno rastreável conforme permissão;
- exibir vencidos e compromissos futuros;
- consolidar categorias e centros de custo;
- preservar a relação com cliente, OS, nota, prestador e banco.

### RF-10 — Simples Nacional

- calcular Receita Bruta acumulada nos 12 meses anteriores (RBT12);
- permitir selecionar Anexos III, IV e V;
- identificar faixa, alíquota nominal e parcela a deduzir;
- calcular alíquota efetiva: `(RBT12 × alíquota nominal − parcela a deduzir) ÷ RBT12`;
- estimar o DAS do mês sobre a receita registrada;
- mostrar evolução visual até a próxima faixa;
- calcular Fator R com folha/encargos e receita dos últimos 12 meses;
- alertar sobre Fator R de 28%, quando aplicável;
- alertar ao se aproximar ou ultrapassar o limite do regime;
- permitir atualização versionada das tabelas tributárias;
- informar que o resultado é gerencial e exige validação contábil.

**Regra:** o enquadramento depende de atividade, CNAE, natureza do serviço, retenções, segregação de receitas e legislação vigente. O ERP não deve escolher definitivamente o Anexo sem configuração fiscal validada.

### RF-11 — Estoque

- cadastro de produtos, peças, materiais e equipamentos;
- custo, preço, unidade, saldo e estoque mínimo;
- entradas, saídas, ajustes, perdas e devoluções;
- baixa vinculada à OS;
- histórico de movimentações sem sobrescrita destrutiva.

### RF-12 — Contratos e preventivas

- contratos por cliente, unidade e equipamentos;
- periodicidade, itens, valores e vigência;
- geração programada de visitas e cobranças;
- alerta de renovação e pendências;
- propostas preventivas com escopo recorrente.

### RF-13 — Marketing

- calendário diário de publicações;
- canal, formato, pauta, legenda, responsável e prazo;
- status: ideia, produção, revisão, aprovado, agendado e publicado;
- anexos, links e observações;
- filtros por canal, responsável e período;
- persistência no banco e histórico de mudanças;
- indicadores de volume planejado, atrasado e publicado.

### RF-14 — Relatórios e gestão

- painel de operação e alertas;
- conversão comercial e carteira de propostas;
- produtividade e tempo de execução;
- rentabilidade por serviço, OS, cliente e contrato;
- contas vencidas, caixa e DRE;
- faturamento e impostos estimados;
- desempenho de prestadores;
- exportação quando autorizada.

### RF-15 — Administração e auditoria

- autenticação segura;
- papéis e permissões por módulo e ação;
- registro de criação, edição, aprovação, baixa e estorno;
- configurações da empresa e perfil fiscal;
- sequências únicas de códigos;
- anexos com controle de acesso;
- integrações configuráveis.

## 9. Requisitos não funcionais

### Segurança

- senhas com hash e salt;
- sessão protegida e expiração configurável;
- autorização validada no servidor;
- arquivos protegidos contra acesso indevido;
- logs sem segredos ou dados sensíveis desnecessários;
- proteção contra alterações de valores pelo cliente web.

### Integridade e proteção de dados

- PostgreSQL como fonte principal;
- transações atômicas para fluxos financeiros e operacionais críticos;
- chaves estrangeiras e restrições de unicidade;
- backups automáticos, checksum e restauração testável;
- migrations aditivas e deploy sem perda de dados;
- rascunho local apenas como proteção auxiliar, nunca como fonte definitiva.

### Desempenho e usabilidade

- primeira resposta das telas operacionais em até 2 segundos em condições normais;
- ações frequentes em até 3 cliques após entrar no módulo;
- layout responsivo a partir de 360 px;
- estados claros de carregamento, sucesso, vazio e erro;
- busca e filtros sem exigir recarregamento completo.

### Disponibilidade e operação

- health check da aplicação;
- deploy blue/green e rollback;
- logs de aplicação e erros;
- HTTPS obrigatório em produção;
- arquivos e banco fora do diretório substituído em atualizações.

## 10. Fluxos críticos

### Fluxo comercial até recebimento

`Lead → Cliente → Orçamento → Aprovação → OS → Execução → Relatório/aceite → Faturamento → Conta a receber → Recebimento`

### Fluxo terceirizado

`Serviço terceirizado → Prestador → Orçamento → OS → Atividade do prestador → Evidências → Aceite → Conta a pagar → Pagamento`

### Fluxo de cadastro contextual

`Tela de trabalho → Abrir janela flutuante → Cadastrar → Salvar no banco → Selecionar automaticamente → Continuar na mesma tela`

## 11. Métricas de sucesso

- tempo médio para criar orçamento;
- tempo médio entre aprovação e abertura da OS;
- percentual de propostas convertidas;
- percentual de OS concluídas no prazo;
- percentual de cadastros com dados completos;
- número de erros ou registros duplicados;
- contas vencidas e prazo médio de recebimento;
- margem estimada versus margem realizada;
- recuperação testada de backup;
- usuários ativos por perfil;
- publicações de marketing realizadas no prazo.

## 12. Critérios gerais de aceite

1. Informações salvas devem permanecer após sair, atualizar ou reiniciar a aplicação.
2. Uma ação financeira crítica não pode gerar lançamentos duplicados.
3. Custos e margens internos não podem aparecer em documentos destinados ao cliente.
4. Cadastros contextuais devem retornar o novo registro selecionado ao fluxo de origem.
5. Mudanças críticas devem indicar usuário, data e conteúdo alterado.
6. O sistema deve funcionar em desktop e celular nos fluxos previstos.
7. Build, validação de tipos, migrations e testes críticos devem passar antes da publicação.

## 13. Estado atual do produto

### Implementado ou existente na base

- autenticação, usuários, papéis e permissões;
- CRM, clientes, contatos, endereços e equipamentos;
- orçamentos, versões, aprovações e conversão em OS;
- catálogo de serviços com formação interna de preço;
- OS, visitas, execução, evidências, medições e relatório;
- faturamento, notas, contas a pagar/receber e transações;
- prestadores, portal e vínculo operacional/financeiro;
- contratos, preventivas, estoque e marketing;
- auditoria, anexos, backups e deploy;
- workspace com navegação contextual e modais.

### Em evolução

- simplificação visual de todos os módulos;
- padronização integral de janelas flutuantes;
- painel financeiro totalmente unificado;
- evolução do Simples Nacional por faixa e Anexo;
- ampliação dos testes automatizados e de recuperação.

## 14. Roadmap recomendado

### Fase 1 — Experiência única

- concluir financeiro em uma tela;
- padronizar cadastros flutuantes;
- eliminar navegação redundante;
- revisar nomenclaturas e ações principais.

### Fase 2 — Confiabilidade

- testes ponta a ponta dos fluxos críticos;
- proteção contra duplicidade e concorrência;
- auditoria completa e simulação periódica de restauração.

### Fase 3 — Gestão e fiscal

- histórico mensal do Simples Nacional;
- configuração fiscal versionada;
- indicadores de margem realizada, caixa projetado e rentabilidade.

### Fase 4 — Automação e integrações

- conciliação bancária;
- emissão fiscal integrada;
- notificações e aprovações;
- integrações de marketing e mensageria.

## 15. Priorização do escopo

### Obrigatório — versão estável

- autenticação, perfis, permissões e auditoria;
- clientes, serviços, prestadores, propostas e OS;
- cadastros contextuais em janelas flutuantes;
- execução, evidências, aceite e relatório técnico;
- faturamento e financeiro unificado;
- persistência, prevenção de duplicidade, backup e restauração;
- separação rigorosa entre composição interna e proposta do cliente;
- segurança, isolamento por empresa e testes dos fluxos críticos.

### Importante — evolução imediata

- Simples Nacional por RBT12, Anexo, faixa e Fator R;
- contratos, preventivas e estoque integrado à OS;
- calendário e fluxo diário de marketing;
- indicadores de margem realizada e caixa projetado;
- experiência móvel e tolerância a conexão instável.

### Posterior

- conciliação bancária automática;
- emissão de NFS-e homologada por município;
- integrações com canais de marketing e mensageria;
- automações avançadas e recomendações assistidas.

## 16. Critérios para lançamento

Uma versão somente pode ser liberada quando:

1. migrations forem aplicadas com sucesso em ambiente de teste;
2. auditoria de segurança, validação de tipos e build estiverem aprovados;
3. testes de integração cobrirem cliente, proposta, OS, prestador, faturamento e financeiro;
4. teste de isolamento impedir leitura de dados de outra empresa;
5. backup recente existir e o procedimento de restauração estiver documentado;
6. nenhum defeito crítico de perda, exposição ou duplicidade de dados permanecer aberto;
7. os responsáveis de negócio homologarem proposta, OS e financeiro.

## 17. Riscos e decisões pendentes

- validar com contador os Anexos e regras aplicáveis a cada atividade/CNAE;
- definir regime de caixa ou competência para cada relatório fiscal;
- definir integrações bancárias e de NFS-e prioritárias;
- definir política de retenção de fotos, documentos e localização;
- definir SLA, infraestrutura e estratégia de monitoramento em produção;
- homologar permissões por perfil com usuários reais.

## 18. Dependências

- PostgreSQL e migrations Prisma;
- armazenamento protegido para anexos e evidências;
- provedor SMTP/OAuth para envio de propostas;
- certificado TLS e camada de proteção de borda em produção;
- validação contábil para regras fiscais e tabelas do Simples Nacional;
- política organizacional de usuários, aprovações e retenção de dados.

## 19. Referências tributárias

As tabelas e fórmulas do Simples Nacional devem ser mantidas de forma versionada com base na Lei Complementar nº 123/2006 e nas resoluções do Comitê Gestor do Simples Nacional. Alterações legais não devem ser aplicadas automaticamente sem revisão e homologação.

---

Este PRD é a fonte de verdade funcional do Nexus ERP. Alterações relevantes de escopo devem atualizar este documento, os critérios de aceite e o roadmap.
