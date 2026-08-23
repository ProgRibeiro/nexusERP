import { prisma } from "@/lib/db";
import { FiscalValidationService } from "../domain/fiscalValidator";
import { peekCurrentDpsNumber } from "../domain/dpsSequence";
import { DpsEmitenteConfig, DpsServicoInput, DpsTomadorInput, DpsValoresInput, NfsePreview } from "../domain/dpsTypes";

/**
 * Prepara a Prévia de Conferência Fiscal para a Ordem de Serviço.
 * É EXPRESSAMENTE PROIBIDA qualquer transmissão fiscal neste método.
 */
export async function prepareNfsePreview(serviceOrderId: string): Promise<NfsePreview> {
  // 1. Busca a Ordem de Serviço com o Cliente e itens
  const os = await prisma.serviceOrder.findUnique({
    where: { id: serviceOrderId },
    include: {
      client: {
        include: {
          addresses: true,
        },
      },
      quote: {
        include: {
          items: true,
        },
      },
      items: true,
      materials: true,
      invoices: true,
      nfseRecords: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!os) {
    throw new Error(`Ordem de Serviço ${serviceOrderId} não encontrada.`);
  }

  // 2. Busca a Configuração Fiscal da Empresa no Setting
  const fiscalSetting = await prisma.setting.findUnique({
    where: { key: "company.fiscal.config" },
  });
  const fiscalConfig = fiscalSetting ? JSON.parse(fiscalSetting.value) : {};

  // Configurações Padrão da Empresa Emitente em Duque de Caxias/RJ
  const emitente: DpsEmitenteConfig = {
    cnpj: fiscalConfig.cnpj || "12.345.678/0001-99",
    im: fiscalConfig.im || "123456",
    corporateName: fiscalConfig.corporateName || "NEXUS CLIMATIZACAO E SERVICOS LTDA",
    tradeName: fiscalConfig.tradeName || "Nexus Ar Condicionado",
    crt: fiscalConfig.crt || "SIMPLES_NACIONAL",
    cLocEmi: "3301702", // Duque de Caxias / RJ
    email: fiscalConfig.email || "contato@oprestador.tech",
    phone: fiscalConfig.phone || "(21) 3999-8888",
  };

  // 3. Monta os dados do Tomador (Cliente)
  const mainAddress = os.client.addresses?.[0] || {
    street: "Avenida Presidente Vargas",
    number: "100",
    neighborhood: "Centro",
    city: "Duque de Caxias",
    state: "RJ",
    cep: "25000-000",
  };

  const tomador: DpsTomadorInput = {
    cpfCnpj: os.client.cpfCnpj || "00.000.000/0001-00",
    name: os.client.name,
    email: os.client.email,
    phone: os.client.phone,
    address: {
      street: mainAddress.street,
      number: mainAddress.number || "SN",
      neighborhood: mainAddress.neighborhood || "Centro",
      city: mainAddress.city || "Duque de Caxias",
      state: mainAddress.state || "RJ",
      cep: mainAddress.cep || "25000-000",
    },
  };

  // 4. Monta a Descrição do Serviço e Códigos Fiscais
  const descItems = os.items.map((it) => it.description).join(" + ") || "Prestação de serviços de manutenção em sistema de climatização e ar condicionado.";
  const serviceDescription = `Serviços executados ref. OS #${os.code || os.id.slice(-4)}: ${descItems}`;

  const servico: DpsServicoInput = {
    cTribNac: fiscalConfig.defaultCTribNac || "140101", // Código Nacional Exemplo: 14.01 - Lubrificação, limpeza, revisão...
    cTribMun: fiscalConfig.defaultCTribMun || "1401",
    itemLc116: "14.01",
    cNBS: fiscalConfig.defaultNbs || "104011000",
    xDescServ: serviceDescription,
    cLocPrest: "3301702", // Duque de Caxias / RJ
  };

  // 5. Monta os Valores Monetários
  const totalVal = Number(os.quote?.total || os.items.reduce((acc, i) => acc + Number(i.total), 0) || 100);
  const issRate = Number(fiscalConfig.issRate || 5.0);
  const vIssCalculated = Number((totalVal * (issRate / 100)).toFixed(2));

  const valores: DpsValoresInput = {
    vServPrest: totalVal,
    issRetido: Boolean(fiscalConfig.issRetido),
    pAliq: issRate,
    vIss: vIssCalculated,
  };

  // 6. Proposta de Numeração e Ambiente
  const dpsSeries = fiscalConfig.dpsSeries || "1";
  const proposedNps = await peekCurrentDpsNumber(dpsSeries);
  const env = (fiscalConfig.environment || "homologation") as "homologation" | "production";

  const competenceDate = new Date().toISOString().split("T")[0];
  const hasIbsCbsGroup = competenceDate >= "2026-10-01";
  const versaoDados = hasIbsCbsGroup ? "1.01" : "1.00";

  // 7. Validação Antecipada de Erros Fiscais
  const validationErrors: string[] = [
    ...FiscalValidationService.validateEmitente(emitente),
    ...FiscalValidationService.validateTomador(tomador),
    ...FiscalValidationService.validateServico(servico),
    ...FiscalValidationService.validateValores(valores),
  ];

  return {
    serviceOrderId,
    environment: env,
    tpAmb: env === "production" ? 1 : 2,
    dpsSeries,
    proposedNps,
    competenceDate,
    emitente,
    tomador,
    servico,
    valores,
    versaoDados,
    hasIbsCbsGroup,
    validationErrors,
    isValid: validationErrors.length === 0,
  };
}
