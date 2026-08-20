/**
 * Tipos e Interfaces fortemente tipados para a DPS (Declaração de Prestação de Serviço)
 * Padrão Nacional v1.00 / v1.01 (Reforma Tributária IBS/CBS)
 * Duque de Caxias / RJ - ISSNet Online
 */

export interface DpsEmitenteConfig {
  cnpj: string;
  im?: string;
  corporateName: string;
  tradeName?: string;
  crt: "SIMPLES_NACIONAL" | "MEI" | "REGIME_NORMAL";
  regimeEspecialTributacao?: string;
  cLocEmi: string; // 3301702 para Duque de Caxias/RJ
  phone?: string;
  email?: string;
  address?: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    cep: string;
  };
}

export interface DpsTomadorInput {
  cpfCnpj: string;
  name: string;
  im?: string;
  email?: string;
  phone?: string;
  address: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    cep: string;
  };
}

export interface DpsServicoInput {
  cTribNac: string; // Ex: 140101
  cTribMun?: string; // Ex: 1401
  itemLc116?: string; // Ex: 14.01
  cNBS?: string; // Ex: 1.0401.10.00
  xDescServ: string;
  cLocPrest: string; // Município da prestação (3301702)
}

export interface DpsValoresInput {
  vServPrest: number;
  vDescIncond?: number;
  vDescCond?: number;
  vDed?: number;
  // Retenções Federais
  vPis?: number;
  vCofins?: number;
  vInss?: number;
  vIrrf?: number;
  vCsll?: number;
  // ISSQN
  issRetido: boolean;
  pAliq?: number;
  vIss?: number;
}

export interface DpsIbsCbsInput {
  cIndOp?: string;
  cClassTrib?: string;
  cstIbsCbs?: string;
  pAliqIbs?: number;
  vIbs?: number;
  pAliqCbs?: number;
  vCbs?: number;
}

export interface DpsInput {
  id?: string;
  tpAmb: 1 | 2; // 1 = Produção, 2 = Homologação
  dhEmi: string; // AAAA-MM-DDThh:mm:ssTZD
  dCompet: string; // AAAA-MM-DD
  serie: string; // Ex: "1"
  nDPS: number;
  emitente: DpsEmitenteConfig;
  tomador: DpsTomadorInput;
  servico: DpsServicoInput;
  valores: DpsValoresInput;
  ibsCbs?: DpsIbsCbsInput;
  infCompl?: string;
}

export interface NfsePreview {
  serviceOrderId?: string;
  environment: "homologation" | "production";
  tpAmb: 1 | 2;
  dpsSeries: string;
  proposedNps: number;
  competenceDate: string;
  emitente: DpsEmitenteConfig;
  tomador: DpsTomadorInput;
  servico: DpsServicoInput;
  valores: DpsValoresInput;
  ibsCbs?: DpsIbsCbsInput;
  versaoDados: "1.00" | "1.01";
  hasIbsCbsGroup: boolean;
  validationErrors: string[];
  isValid: boolean;
}
