import { DpsInput } from "../domain/dpsTypes";

/**
 * Utilitário de Sanitize e Escape de XML
 */
function escapeXml(unsafe: string): string {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDecimal(val?: number): string {
  if (val === undefined || val === null || isNaN(val)) return "0.00";
  return val.toFixed(2);
}

function formatPercent(val?: number): string {
  if (val === undefined || val === null || isNaN(val)) return "0.00";
  return val.toFixed(2);
}

/**
 * Constrói o XML oficial da DPS (Declaração de Prestação de Serviço)
 * e o envelope GerarNfseEnvio segundo o padrão nacional v1.00 / v1.01 (Duque de Caxias/RJ)
 */
export function buildDpsXml(dps: DpsInput): { dpsId: string; xmlContent: string; versaoDados: "1.00" | "1.01" } {
  const dpsId = `DPS${dps.emitente.cnpj.replace(/\D/g, "")}${dps.serie.padStart(5, "0")}${String(dps.nDPS).padStart(15, "0")}`;
  
  const competenceDate = dps.dCompet;
  const hasIbsCbs = Boolean(dps.ibsCbs && (competenceDate >= "2026-10-01" || dps.ibsCbs.cClassTrib));
  const versaoDados: "1.00" | "1.01" = hasIbsCbs ? "1.01" : "1.00";

  const emitenteCnpj = dps.emitente.cnpj.replace(/\D/g, "");
  const tomadorDoc = dps.tomador.cpfCnpj.replace(/\D/g, "");
  const isTomadorCnpj = tomadorDoc.length === 14;

  let xml = `<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" Id="${dpsId}">`;
  xml += `<infDPS Id="${dpsId}infDPS">`;
  xml += `<tpAmb>${dps.tpAmb}</tpAmb>`;
  xml += `<dhEmi>${dps.dhEmi}</dhEmi>`;
  xml += `<verAplic>nexus-erp-v23</verAplic>`;
  xml += `<serie>${escapeXml(dps.serie)}</serie>`;
  xml += `<nDPS>${dps.nDPS}</nDPS>`;
  xml += `<dCompet>${dps.dCompet}</dCompet>`;
  xml += `<tpEmit>1</tpEmit>`; // 1 = Prestador
  xml += `<cLocEmi>${dps.emitente.cLocEmi || "3301702"}</cLocEmi>`;

  // Prestador
  xml += `<prest>`;
  xml += `<CNPJ>${emitenteCnpj}</CNPJ>`;
  if (dps.emitente.im) {
    xml += `<im>${escapeXml(dps.emitente.im)}</im>`;
  }
  xml += `</prest>`;

  // Tomador
  xml += `<toma>`;
  if (isTomadorCnpj) {
    xml += `<CNPJ>${tomadorDoc}</CNPJ>`;
  } else {
    xml += `<CPF>${tomadorDoc}</CPF>`;
  }
  xml += `<xNome>${escapeXml(dps.tomador.name)}</xNome>`;
  if (dps.tomador.address) {
    xml += `<end>`;
    xml += `<xLgr>${escapeXml(dps.tomador.address.street)}</xLgr>`;
    xml += `<nro>${escapeXml(dps.tomador.address.number || "SN")}</nro>`;
    xml += `<xBairro>${escapeXml(dps.tomador.address.neighborhood || "Centro")}</xBairro>`;
    xml += `<cMun>3301702</cMun>`; // Duque de Caxias / RJ
    xml += `<UF>RJ</UF>`;
    xml += `<CEP>${dps.tomador.address.cep.replace(/\D/g, "")}</CEP>`;
    xml += `</end>`;
  }
  if (dps.tomador.phone) xml += `<fone>${escapeXml(dps.tomador.phone.replace(/\D/g, ""))}</fone>`;
  if (dps.tomador.email) xml += `<email>${escapeXml(dps.tomador.email)}</email>`;
  xml += `</toma>`;

  // Serviço
  xml += `<serv>`;
  xml += `<cServ>`;
  xml += `<cTribNac>${escapeXml(dps.servico.cTribNac.replace(/\D/g, ""))}</cTribNac>`;
  if (dps.servico.cTribMun) xml += `<cTribMun>${escapeXml(dps.servico.cTribMun)}</cTribMun>`;
  if (dps.servico.cNBS) xml += `<cNBS>${escapeXml(dps.servico.cNBS.replace(/\D/g, ""))}</cNBS>`;
  xml += `<xDescServ>${escapeXml(dps.servico.xDescServ)}</xDescServ>`;
  xml += `</cServ>`;
  xml += `<cLocPrest>${dps.servico.cLocPrest || "3301702"}</cLocPrest>`;
  xml += `</serv>`;

  // Valores
  xml += `<valores>`;
  xml += `<vServPrest>${formatDecimal(dps.valores.vServPrest)}</vServPrest>`;
  if (dps.valores.vDescIncond) xml += `<vDescIncond>${formatDecimal(dps.valores.vDescIncond)}</vDescIncond>`;

  // Trib / ISSQN
  xml += `<trib>`;
  xml += `<tribMun>`;
  xml += `<tribISSQN>${dps.valores.issRetido ? "2" : "1"}</tribISSQN>`; // 1 = Retido pelo Tomador, 2 = Devido no Município
  xml += `<tpRetISSQN>${dps.valores.issRetido ? "1" : "2"}</tpRetISSQN>`;
  if (dps.valores.pAliq && dps.valores.pAliq > 0) {
    xml += `<pAliq>${formatPercent(dps.valores.pAliq)}</pAliq>`;
  }
  xml += `</tribMun>`;

  // Retenções Federais (se informadas)
  if (dps.valores.vPis || dps.valores.vCofins || dps.valores.vIrrf || dps.valores.vCsll || dps.valores.vInss) {
    xml += `<tribFed>`;
    if (dps.valores.vPis) xml += `<vPis>${formatDecimal(dps.valores.vPis)}</vPis>`;
    if (dps.valores.vCofins) xml += `<vCofins>${formatDecimal(dps.valores.vCofins)}</vCofins>`;
    if (dps.valores.vInss) xml += `<vInss>${formatDecimal(dps.valores.vInss)}</vInss>`;
    if (dps.valores.vIrrf) xml += `<vIrrf>${formatDecimal(dps.valores.vIrrf)}</vIrrf>`;
    if (dps.valores.vCsll) xml += `<vCsll>${formatDecimal(dps.valores.vCsll)}</vCsll>`;
    xml += `</tribFed>`;
  }

  xml += `</trib>`;
  xml += `</valores>`;

  // Grupo IBS/CBS (Reforma Tributária - v1.01)
  if (hasIbsCbs && dps.ibsCbs) {
    xml += `<IBSCBS>`;
    xml += `<finNFSe>0</finNFSe>`; // 0 = Emissão Normal
    xml += `<cIndOp>${escapeXml(dps.ibsCbs.cIndOp || "050101")}</cIndOp>`;
    xml += `<gIBSCBS>`;
    xml += `<CST>${escapeXml(dps.ibsCbs.cstIbsCbs || "01")}</CST>`;
    xml += `<cClassTrib>${escapeXml(dps.ibsCbs.cClassTrib || "000000")}</cClassTrib>`;
    xml += `</gIBSCBS>`;
    xml += `</IBSCBS>`;
  }

  if (dps.infCompl) {
    xml += `<infCompl>${escapeXml(dps.infCompl)}</infCompl>`;
  }

  xml += `</infDPS>`;
  xml += `</DPS>`;

  return { dpsId, xmlContent: xml, versaoDados };
}

/**
 * Constrói o envelope SOAP oficial GerarNfseEnvio
 */
export function buildGerarNfseEnvioEnvelope(dpsSignedXml: string, versaoDados: "1.00" | "1.01"): string {
  let xml = `<?xml version="1.0" encoding="utf-8"?>`;
  xml += `<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">`;
  xml += `<soap:Header>`;
  xml += `<cabecalho versao="${versaoDados}" xmlns="http://www.sped.fazenda.gov.br/nfse">`;
  xml += `<versaoDados>${versaoDados}</versaoDados>`;
  xml += `</cabecalho>`;
  xml += `</soap:Header>`;
  xml += `<soap:Body>`;
  xml += `<GerarNfseEnvio xmlns="http://www.sped.fazenda.gov.br/nfse">`;
  xml += dpsSignedXml;
  xml += `</GerarNfseEnvio>`;
  xml += `</soap:Body>`;
  xml += `</soap:Envelope>`;
  return xml;
}
