import crypto from "crypto";

/**
 * Normalizador C14N (Canonicalization) simplificado para elementos XMLDSig
 */
function canonicalizeXml(xmlStr: string): string {
  return xmlStr
    .replace(/>\s+</g, "><")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Assinador XMLDSig oficial para a DPS Padrão Nacional (RSA-SHA1 com Canonicalization e Certificate X509)
 */
export function signDpsXml(xmlDps: string, dpsId: string, pemKey: string, pemCert: string): string {
  try {
    // 1. Limpa o certificado PEM para extrair apenas os caracteres Base64
    const cleanCertBase64 = pemCert
      .replace(/-----BEGIN CERTIFICATE-----/g, "")
      .replace(/-----END CERTIFICATE-----/g, "")
      .replace(/\s+/g, "");

    // 2. Transforma e gera o Digest SHA1 do elemento infDPS (ou da DPS inteira conforme ID)
    const infDpsMatch = xmlDps.match(/<infDPS[\s\S]*?<\/infDPS>/);
    const targetToDigest = infDpsMatch ? infDpsMatch[0] : xmlDps;

    const c14nTarget = canonicalizeXml(targetToDigest);
    const digestValue = crypto.createHash("sha1").update(c14nTarget, "utf8").digest("base64");

    // 3. Monta o bloco <SignedInfo> com URI para o ID da infDPS/DPS
    const signedInfoXml =
      `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">` +
      `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
      `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>` +
      `<Reference URI="#${dpsId}infDPS">` +
      `<Transforms>` +
      `<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>` +
      `<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
      `</Transforms>` +
      `<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>` +
      `<DigestValue>${digestValue}</DigestValue>` +
      `</Reference>` +
      `</SignedInfo>`;

    // 4. Assina o <SignedInfo> com RSA-SHA1 e a Chave Privada PEM
    const signer = crypto.createSign("RSA-SHA1");
    signer.update(canonicalizeXml(signedInfoXml));
    const signatureValue = signer.sign(pemKey, "base64");

    // 5. Monta o bloco completo <Signature>
    const signatureBlockXml =
      `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">` +
      signedInfoXml +
      `<SignatureValue>${signatureValue}</SignatureValue>` +
      `<KeyInfo>` +
      `<X509Data>` +
      `<X509Certificate>${cleanCertBase64}</X509Certificate>` +
      `</X509Data>` +
      `</KeyInfo>` +
      `</Signature>`;

    // 6. Injeta a <Signature> dentro do elemento <DPS> antes de seu fechamento </DPS>
    const signedDpsXml = xmlDps.replace("</DPS>", `${signatureBlockXml}</DPS>`);
    return signedDpsXml;
  } catch (err: any) {
    throw new Error(`Erro na assinatura XMLDSig da DPS: ${err.message}`);
  }
}
