export const MODULE_CATALOG = [
  { id:"crm", name:"CRM e Funil", description:"Leads, oportunidades e atividades" },
  { id:"preventivas", name:"Preventivas", description:"Propostas e central de manutenção preventiva" },
  { id:"marketing", name:"Marketing", description:"Calendário e produção de conteúdo" },
  { id:"prestadores", name:"Prestadores", description:"Parceiros, portal e pagamentos" },
  { id:"faturamento", name:"Painel Fiscal", description:"Fila fiscal, notas e documentos" },
  { id:"estoque", name:"Estoque", description:"Peças, materiais e movimentações" },
  { id:"servicos", name:"Catálogo de Serviços", description:"Custos e formação interna de preços" },
  { id:"contratos", name:"Contratos", description:"Recorrência e vigências" },
  { id:"relatorios", name:"Relatórios", description:"Indicadores gerenciais" },
] as const;
export type ModuleId = typeof MODULE_CATALOG[number]["id"];
