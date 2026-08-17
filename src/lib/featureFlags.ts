/**
 * Catálogo de Funcionalidades Modulares & Feature Flags (Slide 8/14)
 *
 * Permite ativar e desativar módulos do ERP dinamicamente por Tenant/Empresa
 * sem necessidade de alterar código ou fazer redeploy da aplicação.
 */

export interface FeatureFlagDefinition {
  code: string;
  name: string;
  category: "CRM" | "OPERACOES" | "FISCAL" | "FINANCEIRO" | "ESTOQUE" | "INTEGRACOES" | "MARKETING";
  description: string;
  defaultEnabled: boolean;
}

export const SYSTEM_MODULE_CATALOG: FeatureFlagDefinition[] = [
  {
    code: "module.crm",
    name: "CRM e Gestão de Funil",
    category: "CRM",
    description: "Prospecção de leads, funil de vendas e registro de atividades de prospecção.",
    defaultEnabled: true,
  },
  {
    code: "module.orcamentos",
    name: "Orçamentos com Approver/Margem",
    category: "OPERACOES",
    description: "Criação de propostas técnicas, cálculo de margem e versão auditada.",
    defaultEnabled: true,
  },
  {
    code: "module.os_field",
    name: "Ordens de Serviço e App de Campo",
    category: "OPERACOES",
    description: "Agendamento de visitas técnicas, check-in por geolocalização e fotos de execução.",
    defaultEnabled: true,
  },
  {
    code: "module.pmoc_contratos",
    name: "Manutenção Preventiva PMOC e Contratos",
    category: "OPERACOES",
    description: "Planos de manutenção recorrente, rotinas técnicas e faturamento mensal automatizado.",
    defaultEnabled: true,
  },
  {
    code: "module.faturamento_nfse",
    name: "Faturamento Fiscal e Emissão de NFS-e",
    category: "FISCAL",
    description: "Emissão de notas fiscais de serviço integradas aos provedores nacionais.",
    defaultEnabled: true,
  },
  {
    code: "module.financeiro_dre",
    name: "Financeiro Completo e DRE Gerencial",
    category: "FINANCEIRO",
    description: "Contas a pagar/receber, conciliação bancária de extratos e relatório DRE por regime.",
    defaultEnabled: true,
  },
  {
    code: "module.estoque",
    name: "Estoque e Suprimentos",
    category: "ESTOQUE",
    description: "Controle de saldo em almoxarifados, movimentação de peças e inventários.",
    defaultEnabled: true,
  },
  {
    code: "module.gmail_integration",
    name: "Integração OAuth Gmail & E-mails",
    category: "INTEGRACOES",
    description: "Envio automático de propostas, avisos de visita e boletos via e-mail.",
    defaultEnabled: true,
  },
  {
    code: "module.marketing_hub",
    name: "Hub de Marketing e Redes Sociais",
    category: "MARKETING",
    description: "Criação de artes, gerenciamento de postagens e campanhas para redes sociais.",
    defaultEnabled: true,
  },
  {
    code: "module.teia_graph",
    name: "Teia de Relacionamentos (Data Graph)",
    category: "INTEGRACOES",
    description: "Visualização gráfica de conexões entre clientes, equipamentos, contratos e OSs.",
    defaultEnabled: true,
  },
];

// Estado local / cache de flags por tenant (pode ser sobrescrito via banco de dados)
const tenantFeatureOverrides = new Map<string, Record<string, boolean>>();

/**
 * Verifica se um determinado módulo/feature está ativo para o tenant.
 */
export function isFeatureEnabled(featureCode: string, tenantId?: string): boolean {
  const def = SYSTEM_MODULE_CATALOG.find((f) => f.code === featureCode);
  const defaultValue = def ? def.defaultEnabled : true;

  if (!tenantId) return defaultValue;

  const overrides = tenantFeatureOverrides.get(tenantId);
  if (overrides && typeof overrides[featureCode] === "boolean") {
    return overrides[featureCode];
  }

  return defaultValue;
}

/**
 * Retorna o mapa completo de status dos módulos para um tenant.
 */
export function getTenantFeatureMap(tenantId?: string): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const feat of SYSTEM_MODULE_CATALOG) {
    map[feat.code] = isFeatureEnabled(feat.code, tenantId);
  }
  return map;
}

/**
 * Atualiza o status de uma feature flag para um determinado tenant.
 */
export function setTenantFeatureOverride(tenantId: string, featureCode: string, enabled: boolean): void {
  const current = tenantFeatureOverrides.get(tenantId) || {};
  current[featureCode] = enabled;
  tenantFeatureOverrides.set(tenantId, current);
}
