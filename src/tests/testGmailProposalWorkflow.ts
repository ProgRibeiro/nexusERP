import crypto from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { PDFDocument } from "pdf-lib";
import { prisma } from "@/lib/db";
import { createProposalMimeMessage } from "@/lib/gmail";
import { buildQuotePdf } from "@/lib/quotePdf";
import { decryptSecret, encryptSecret } from "@/lib/secretBox";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  process.env.INTEGRATION_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
  const secret = `refresh-token-${crypto.randomUUID()}`;
  const encrypted = encryptSecret(secret);
  assert(encrypted !== secret, "O token não foi criptografado.");
  assert(decryptSecret(encrypted) === secret, "A descriptografia do token falhou.");

  const quote = await prisma.quote.findFirst({
    orderBy: { createdAt: "desc" },
    include: { client: { include: { addresses: true } }, items: true },
  });
  assert(quote, "Cadastre ao menos uma proposta para executar este teste.");

  const pdf = await buildQuotePdf({
    code: quote.code,
    version: quote.version,
    createdAt: quote.createdAt,
    validUntil: quote.validUntil,
    warrantyDays: quote.warrantyDays,
    executionTerm: quote.executionTerm,
    paymentTerms: quote.paymentTerms,
    subtotal: Number(quote.subtotal),
    discount: Number(quote.discount),
    tax: Number(quote.tax),
    total: Number(quote.total),
    notes: quote.notes,
    client: {
      name: quote.client.name,
      socialName: quote.client.socialName,
      cpfCnpj: quote.client.cpfCnpj,
      email: quote.client.email,
      phone: quote.client.phone,
      addresses: [...quote.client.addresses].sort((left, right) => {
        if (left.id === quote.addressId) return -1;
        if (right.id === quote.addressId) return 1;
        return 0;
      }),
    },
    items: quote.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: Number(item.unitPrice),
      total: Number(item.total),
    })),
  }, {
    corporateName: "NEXUS CLIMATIZACAO E ELETRICA LTDA",
    tradeName: "Nexus Climatizacao",
    cnpj: "64.198.043/0001-06",
    email: "comercial@nexus.local",
    phone: "(21) 99999-9999",
  });

  const parsedPdf = await PDFDocument.load(pdf);
  assert(parsedPdf.getPageCount() === 1, `O PDF deveria ter 1 página, mas possui ${parsedPdf.getPageCount()}.`);
  assert(pdf.byteLength > 2_000, "O PDF gerado parece estar vazio.");

  const raw = createProposalMimeMessage({
    senderEmail: "comercial@nexus.local",
    senderName: "Nexus Climatização",
    recipientEmail: quote.client.email,
    subject: `Proposta comercial ${quote.code}`,
    body: "Olá. Segue a proposta comercial em anexo.",
    attachmentName: `Proposta-${quote.code}.pdf`,
    attachment: pdf,
  });
  const mime = Buffer.from(raw, "base64url").toString("utf8");
  assert(mime.includes("Content-Type: multipart/mixed"), "A mensagem não é multipart/mixed.");
  assert(mime.includes("Content-Type: application/pdf"), "O anexo PDF não existe no MIME.");
  assert(mime.includes(`filename=\"Proposta-${quote.code}.pdf\"`), "O nome do anexo está incorreto.");

  const outputDir = path.join(process.cwd(), "tmp", "pdfs");
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, "gmail-proposal-test.pdf");
  await writeFile(outputPath, pdf);

  console.log(JSON.stringify({
    success: true,
    quote: quote.code,
    pages: parsedPdf.getPageCount(),
    bytes: pdf.byteLength,
    mimeBytes: Buffer.byteLength(mime),
    encryptedToken: encrypted.startsWith("v1:"),
    outputPath,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
