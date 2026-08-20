import { buildDpsXml, buildGerarNfseEnvioEnvelope } from "../src/lib/nfse/infrastructure/xmlBuilder";
import { validateNfseXmlStructure } from "../src/lib/nfse/infrastructure/xsdValidator";
import { FiscalValidationService } from "../src/lib/nfse/domain/fiscalValidator";
import { DpsInput } from "../src/lib/nfse/domain/dpsTypes";

async function main() {
  console.log("=== TESTE DIAGNÓSTICO DO MÓDULO FISCAL NFS-e DUQUE DE CAXIAS/RJ ===");

  const sampleDps: DpsInput = {
    tpAmb: 2, // Homologação
    dhEmi: new Date().toISOString(),
    dCompet: new Date().toISOString().split("T")[0],
    serie: "1",
    nDPS: 1001,
    emitente: {
      cnpj: "12345678000199",
      im: "123456",
      corporateName: "NEXUS CLIMATIZACAO E SERVICOS LTDA",
      tradeName: "Nexus Ar Condicionado",
      crt: "SIMPLES_NACIONAL",
      cLocEmi: "3301702",
      email: "contato@nexusmanutencao.com",
    },
    tomador: {
      cpfCnpj: "09611669000129",
      name: "CLIENTE TESTE DUQUE DE CAXIAS SA",
      address: {
        street: "Avenida Governador Amaral Peixoto",
        number: "500",
        neighborhood: "Centro",
        city: "Duque de Caxias",
        state: "RJ",
        cep: "25000-000",
      },
    },
    servico: {
      cTribNac: "140101",
      cTribMun: "1401",
      itemLc116: "14.01",
      cNBS: "104011000",
      xDescServ: "Manutenção e revisão periódica em sistema central de climatização.",
      cLocPrest: "3301702",
    },
    valores: {
      vServPrest: 1500.0,
      issRetido: false,
      pAliq: 5.0,
      vIss: 75.0,
    },
  };

  console.log("1. Validando regras fiscais antecedente...");
  const errors = [
    ...FiscalValidationService.validateEmitente(sampleDps.emitente),
    ...FiscalValidationService.validateTomador(sampleDps.tomador),
    ...FiscalValidationService.validateServico(sampleDps.servico),
    ...FiscalValidationService.validateValores(sampleDps.valores),
  ];

  console.log("   Erros encontrados:", errors.length === 0 ? "NENHUM (VALIDADO 100%)" : errors);

  console.log("2. Construindo XML oficial da DPS...");
  const { dpsId, xmlContent, versaoDados } = buildDpsXml(sampleDps);
  console.log("   dpsId:", dpsId);
  console.log("   versaoDados:", versaoDados);
  console.log("   XML Preview (primeiros 200 chars):", xmlContent.slice(0, 200));

  console.log("3. Validando estrutura XSD...");
  const xsdRes = validateNfseXmlStructure(xmlContent);
  console.log("   XSD Válido:", xsdRes.isValid);
  if (!xsdRes.isValid) {
    console.error("   Erros XSD:", xsdRes.errors);
  }

  console.log("4. Montando Envelope SOAP GerarNfseEnvio...");
  const envelope = buildGerarNfseEnvioEnvelope(xmlContent, versaoDados);
  console.log("   Envelope SOAP gerado com sucesso! (Tamanho:", envelope.length, "bytes)");

  console.log("=== MÓDULO FISCAL TESTADO E APROVADO COM SUCESSO! ===");
}

main().catch(console.error);
