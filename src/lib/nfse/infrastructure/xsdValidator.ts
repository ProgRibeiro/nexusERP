export interface XsdValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validador Estrutural XSD pré-transmissão para NFS-e Padrão Nacional v1.00 / v1.01
 */
export function validateNfseXmlStructure(xmlContent: string): XsdValidationResult {
  const errors: string[] = [];

  // Checagens fundamentais do Schema Oficial v1.01 (Duque de Caxias)
  if (!xmlContent.includes('<DPS') || !xmlContent.includes('</DPS>')) {
    errors.push("XML de DPS inválido: elemento raiz <DPS> não encontrado.");
  }
  if (!xmlContent.includes('<infDPS') || !xmlContent.includes('</infDPS>')) {
    errors.push("XML de DPS inválido: elemento <infDPS> ausente.");
  }
  if (!xmlContent.includes('<tpAmb>')) {
    errors.push("XML de DPS inválido: indicador de ambiente <tpAmb> ausente.");
  }
  if (!xmlContent.includes('<dhEmi>')) {
    errors.push("XML de DPS inválido: data de emissão <dhEmi> ausente.");
  }
  if (!xmlContent.includes('<serie>')) {
    errors.push("XML de DPS inválido: série da DPS <serie> ausente.");
  }
  if (!xmlContent.includes('<nDPS>')) {
    errors.push("XML de DPS inválido: número da DPS <nDPS> ausente.");
  }
  if (!xmlContent.includes('<prest>') || !xmlContent.includes('<CNPJ>')) {
    errors.push("XML de DPS inválido: dados do prestador ou CNPJ ausentes.");
  }
  if (!xmlContent.includes('<toma>')) {
    errors.push("XML de DPS inválido: dados do tomador <toma> ausentes.");
  }
  if (!xmlContent.includes('<cTribNac>')) {
    errors.push("XML de DPS inválido: Código de Tributação Nacional <cTribNac> é obrigatório.");
  }
  if (!xmlContent.includes('<vServPrest>')) {
    errors.push("XML de DPS inválido: valor do serviço <vServPrest> ausente.");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
