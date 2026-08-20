import https from "node:https";
import { CertificateInfo } from "./certProvider";

export interface SoapResponse {
  httpStatus: number;
  rawResponseBody: string;
  isSuccess: boolean;
  nfseNumber?: string;
  accessKey?: string;
  visualizationUrl?: string;
  errorCode?: string;
  errorMessage?: string;
  xmlAuthorized?: string;
}

export const ENDPOINTS_DUQUE_DE_CAXIAS = {
  homologation: "https://nfse.issnetonline.com.br/wsnfsenacional/homologacao/nfse.asmx",
  production: "https://nfse.issnetonline.com.br/wsnfsenacional/duquedecaxias/nfse.asmx",
} as const;

/**
 * Cliente SOAP para comunicação oficial com o WebService da Prefeitura de Duque de Caxias/RJ (ISSNet / Padrão Nacional)
 */
export class DuqueDeCaxiasSoapClient {
  private endpointUrl: string;
  private certInfo?: CertificateInfo;

  constructor(env: "homologation" | "production" = "homologation", certInfo?: CertificateInfo) {
    this.endpointUrl = ENDPOINTS_DUQUE_DE_CAXIAS[env] || ENDPOINTS_DUQUE_DE_CAXIAS.homologation;
    this.certInfo = certInfo;
  }

  /**
   * Envia uma requisição SOAP via HTTP/mTLS apresentando o certificado A1
   */
  private async sendSoapRequest(soapAction: string, soapXml: string): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.endpointUrl);
      const postData = Buffer.from(soapXml, "utf8");

      const options: https.RequestOptions = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          "Content-Length": postData.length,
          "SOAPAction": `http://www.sped.fazenda.gov.br/nfse/${soapAction}`,
        },
        timeout: 30000, // 30 segundos
      };

      // mTLS: anexa o certificado X509 e chave privada se configurados
      if (this.certInfo?.pemKey && this.certInfo?.pemCert) {
        options.key = this.certInfo.pemKey;
        options.cert = this.certInfo.pemCert;
      }

      // IMPORTANTE: Nunca desabilita a verificação SSL em ambiente real
      options.rejectUnauthorized = process.env.NODE_ENV === "production";

      const req = https.request(options, (res) => {
        let responseText = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => { responseText += chunk; });
        res.on("end", () => {
          resolve({ status: res.statusCode || 500, body: responseText });
        });
      });

      req.on("error", (err) => {
        reject(new Error(`Erro de rede/transporte SOAP (${url.hostname}): ${err.message}`));
      });

      req.on("timeout", () => {
        req.destroy();
        reject(new Error("TIMEOUT_SOAP"));
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Transmite a DPS via método GerarNfse
   */
  async gerarNfse(envelopeXml: string): Promise<SoapResponse> {
    try {
      const res = await this.sendSoapRequest("GerarNfse", envelopeXml);
      return this.parseGerarNfseResponse(res.status, res.body);
    } catch (err: any) {
      if (err.message === "TIMEOUT_SOAP") {
        return {
          httpStatus: 408,
          rawResponseBody: "",
          isSuccess: false,
          errorCode: "RESULTADO_INCERTO",
          errorMessage: "A requisição SOAP excedeu o tempo limite (Timeout). A nota pode ter sido autorizada na Prefeitura. Execute a reconciliação por DPS.",
        };
      }
      return {
        httpStatus: 500,
        rawResponseBody: "",
        isSuccess: false,
        errorCode: "ERRO_COMUNICACAO",
        errorMessage: err.message || "Falha de conexão com a Prefeitura de Duque de Caxias.",
      };
    }
  }

  /**
   * Executa o cancelamento manual da NFS-e
   */
  async cancelarNfse(envelopeXml: string): Promise<SoapResponse> {
    try {
      const res = await this.sendSoapRequest("CancelarNfse", envelopeXml);
      return this.parseGenericResponse(res.status, res.body, "CancelarNfse");
    } catch (err: any) {
      return {
        httpStatus: 500,
        rawResponseBody: "",
        isSuccess: false,
        errorCode: "ERRO_CANCELAMENTO",
        errorMessage: err.message,
      };
    }
  }

  /**
   * Consulta o estado da NFS-e por DPS para reconciliação pós-timeout
   */
  async consultarNfsePorDps(envelopeXml: string): Promise<SoapResponse> {
    try {
      const res = await this.sendSoapRequest("ConsultarNfsePorDps", envelopeXml);
      return this.parseGerarNfseResponse(res.status, res.body);
    } catch (err: any) {
      return {
        httpStatus: 500,
        rawResponseBody: "",
        isSuccess: false,
        errorCode: "ERRO_CONSULTA",
        errorMessage: err.message,
      };
    }
  }

  /**
   * Interpreta o XML de resposta do GerarNfse
   */
  private parseGerarNfseResponse(status: number, body: string): SoapResponse {
    // 1. Extrai numero da NFS-e
    const nNfseMatch = body.match(/<nNFSe>(\d+)<\/nNFSe>/) || body.match(/<nNfse>(\d+)<\/nNfse>/) || body.match(/<numero>(\d+)<\/numero>/);
    const nfseNumber = nNfseMatch ? nNfseMatch[1] : undefined;

    // 2. Extrai Chave de Acesso Nacional (50 dígitos)
    const chNfseMatch = body.match(/<chNFSe>([A-Za-z0-9]{50})<\/chNFSe>/) || body.match(/<chaveAcesso>([A-Za-z0-9]{50})<\/chaveAcesso>/);
    const accessKey = chNfseMatch ? chNfseMatch[1] : undefined;

    // 3. Extrai URL de visualização
    const urlMatch = body.match(/<urlVisualizacao>(.*?)<\/urlVisualizacao>/) || body.match(/<urlPrefeitura>(.*?)<\/urlPrefeitura>/);
    const visualizationUrl = urlMatch ? urlMatch[1] : undefined;

    // 4. Extrai Erros / Rejeições Fiscais
    const errCodeMatch = body.match(/<cCode>(.*?)<\/cCode>/) || body.match(/<Codigo>(.*?)<\/Codigo>/);
    const errDescMatch = body.match(/<xDesc>(.*?)<\/xDesc>/) || body.match(/<Descricao>(.*?)<\/Descricao>/);

    const isSuccess = Boolean(nfseNumber || accessKey || (status === 200 && !errCodeMatch));

    return {
      httpStatus: status,
      rawResponseBody: body,
      isSuccess,
      nfseNumber: nfseNumber || (isSuccess ? "EMITIDA-OK" : undefined),
      accessKey,
      visualizationUrl,
      errorCode: errCodeMatch ? errCodeMatch[1] : undefined,
      errorMessage: errDescMatch ? errDescMatch[1] : undefined,
      xmlAuthorized: isSuccess ? body : undefined,
    };
  }

  private parseGenericResponse(status: number, body: string, action: string): SoapResponse {
    const isSuccess = status === 200 && !body.includes("<erros>") && !body.includes("<cCode>");
    return {
      httpStatus: status,
      rawResponseBody: body,
      isSuccess,
      xmlAuthorized: isSuccess ? body : undefined,
    };
  }
}
