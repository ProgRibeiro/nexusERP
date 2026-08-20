import { DpsEmitenteConfig, DpsServicoInput, DpsTomadorInput, DpsValoresInput } from "./dpsTypes";

/**
 * Validador de Regras Fiscais de Negócio para NFS-e Duque de Caxias / Padrão Nacional
 */
export class FiscalValidationService {
  static validateEmitente(emitente?: Partial<DpsEmitenteConfig>): string[] {
    const errors: string[] = [];
    if (!emitente) return ["Configuração fiscal da empresa emitente não localizada."];

    const cleanCnpj = emitente.cnpj?.replace(/\D/g, "") || "";
    if (cleanCnpj.length !== 14) {
      errors.push("Emitente: CNPJ inválido ou ausente.");
    }
    if (!emitente.im?.trim()) {
      errors.push("Emitente: Inscrição Municipal não informada em Configurações Fiscais.");
    }
    if (!emitente.corporateName?.trim()) {
      errors.push("Emitente: Razão Social da empresa não cadastrada.");
    }
    if (!emitente.cLocEmi || emitente.cLocEmi !== "3301702") {
      errors.push("Emitente: O código do município emissor deve ser 3301702 (Duque de Caxias/RJ).");
    }

    return errors;
  }

  static validateTomador(tomador?: Partial<DpsTomadorInput>): string[] {
    const errors: string[] = [];
    if (!tomador) return ["Dados do Tomador (Cliente) não informados."];

    const docDigits = tomador.cpfCnpj?.replace(/\D/g, "") || "";
    if (docDigits.length !== 11 && docDigits.length !== 14) {
      errors.push("Tomador: CPF ou CNPJ inválido. Verifique o cadastro do cliente.");
    }
    if (!tomador.name?.trim()) {
      errors.push("Tomador: Nome / Razão Social do cliente é obrigatório.");
    }
    if (!tomador.address?.street?.trim()) {
      errors.push("Tomador: Logradouro/Endereço é obrigatório.");
    }
    if (!tomador.address?.city?.trim()) {
      errors.push("Tomador: Município do cliente é obrigatório.");
    }
    if (!tomador.address?.cep?.trim()) {
      errors.push("Tomador: CEP do cliente é obrigatório.");
    }

    return errors;
  }

  static validateServico(servico?: Partial<DpsServicoInput>): string[] {
    const errors: string[] = [];
    if (!servico) return ["Dados Fiscais do Serviço prestado não informados."];

    const cTribNac = servico.cTribNac?.replace(/\D/g, "");
    if (!cTribNac || cTribNac.length < 6) {
      errors.push("Serviço: Código de Tributação Nacional (cTribNac) não configurado. Exemplo: 140101.");
    }
    if (!servico.xDescServ?.trim()) {
      errors.push("Serviço: Descrição do serviço prestado é obrigatória.");
    }

    return errors;
  }

  static validateValores(valores?: Partial<DpsValoresInput>): string[] {
    const errors: string[] = [];
    if (!valores) return ["Valores da prestação de serviço não calculados."];

    if (!valores.vServPrest || valores.vServPrest <= 0) {
      errors.push("Valores: O valor bruto do serviço deve ser maior que R$ 0,00.");
    }

    return errors;
  }
}
