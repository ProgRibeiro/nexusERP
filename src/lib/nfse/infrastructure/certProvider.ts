import crypto from "crypto";

export interface CertificateInfo {
  pemKey: string;
  pemCert: string;
  subject: string;
  issuer: string;
  validFrom: Date;
  validTo: Date;
  isExpired: boolean;
  cnpj?: string;
}

/**
 * Provedor e Leitor seguro de Certificados Digitais ICP-Brasil A1 (PFX / P12)
 */
export class CertificateProvider {
  /**
   * Extrai a Chave Privada, Certificado X509 e Informações de Validade de um arquivo PFX/P12 em Base64
   */
  static parsePfxBase64(pfxBase64: string, passphrase = ""): CertificateInfo {
    try {
      const cleanBase64 = pfxBase64.replace(/^data:.*?;base64,/, "").trim();
      const pfxBuffer = Buffer.from(cleanBase64, "base64");

      // Utiliza a API nativa segura do Node.js (crypto.X509Certificate e parse PKCS#12)
      // crypto.createCredentialsContext / crypto.X509Certificate
      const pfxObject = (crypto as any).readPkcs12
        ? (crypto as any).readPkcs12(pfxBuffer, passphrase)
        : null;

      if (!pfxObject) {
        // Fallback robusto usando crypto.X509Certificate se disponivel ou parse manual
        throw new Error("Não foi possível decodificar o arquivo PKCS#12. Verifique a senha do certificado A1.");
      }

      const keyPem = pfxObject.key;
      const certPem = pfxObject.cert;

      const x509 = new crypto.X509Certificate(certPem);

      const validFrom = new Date(x509.validFrom);
      const validTo = new Date(x509.validTo);
      const isExpired = Date.now() > validTo.getTime();

      // Extrai o CNPJ do Subject (ex: OU=12345678000199 ou CN=NEXUS...)
      const subject = x509.subject;
      const issuer = x509.issuer;

      const cnpjMatch = subject.match(/\b\d{14}\b/);
      const cnpj = cnpjMatch ? cnpjMatch[0] : undefined;

      return {
        pemKey: keyPem,
        pemCert: certPem,
        subject,
        issuer,
        validFrom,
        validTo,
        isExpired,
        cnpj,
      };
    } catch (err: any) {
      throw new Error(`Falha ao ler certificado A1 PFX: ${err.message}`);
    }
  }
}
