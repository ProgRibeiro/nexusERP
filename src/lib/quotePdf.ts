import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

export interface QuotePdfCompanyProfile {
  corporateName?: string;
  tradeName?: string;
  cnpj?: string;
  stateRegistration?: string;
  municipalRegistration?: string;
  email?: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
}

export interface QuotePdfData {
  code: string;
  version?: number | null;
  createdAt: Date | string;
  validUntil: Date | string;
  warrantyDays?: number | null;
  executionTerm?: string | null;
  paymentTerms?: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  notes?: string | null;
  client: {
    name: string;
    socialName?: string | null;
    cpfCnpj?: string | null;
    email?: string | null;
    phone?: string | null;
    addresses?: Array<{
      street: string;
      number: string;
      complement?: string | null;
      neighborhood: string;
      city: string;
      state: string;
      cep?: string | null;
    }>;
  };
  contact?: {
    name: string;
    email?: string | null;
    phone?: string | null;
  } | null;
  items: Array<{
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    total: number;
  }>;
}

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN = 38;
const NAVY = rgb(0.035, 0.105, 0.28);
const BLUE = rgb(0.08, 0.34, 0.76);
const LIGHT_BLUE = rgb(0.93, 0.96, 1);
const BORDER = rgb(0.84, 0.87, 0.91);
const MUTED = rgb(0.36, 0.41, 0.49);
const TEXT = rgb(0.08, 0.11, 0.17);
const GREEN = rgb(0.04, 0.58, 0.29);

function pdfText(value: unknown) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/[–—−]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/•/g, "-")
    .replace(/\u00a0/g, " ")
    .split("")
    .map((character) => character.charCodeAt(0) <= 255 ? character : "?")
    .join("");
}

function money(value: number) {
  return pdfText(new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) || 0));
}

function date(value: Date | string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleDateString("pt-BR");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = pdfText(text).replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let current = words[0];
  for (const word of words.slice(1)) {
    const candidate = `${current} ${word}`;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) current = candidate;
    else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);
  return lines;
}

function drawLines(page: PDFPage, lines: string[], options: { x: number; y: number; font: PDFFont; size: number; color?: ReturnType<typeof rgb>; lineHeight?: number; maxLines?: number }) {
  const lineHeight = options.lineHeight || options.size * 1.25;
  const visible = options.maxLines ? lines.slice(0, options.maxLines) : lines;
  visible.forEach((line, index) => page.drawText(pdfText(line), {
    x: options.x,
    y: options.y - index * lineHeight,
    size: options.size,
    font: options.font,
    color: options.color || TEXT,
  }));
  return visible.length * lineHeight;
}

function addressOf(quote: QuotePdfData) {
  const address = quote.client.addresses?.[0];
  if (!address) return "Endereco nao informado";
  return [
    `${address.street}, ${address.number}`,
    address.complement,
    address.neighborhood,
    `${address.city}/${address.state}`,
    address.cep ? `CEP ${address.cep}` : null,
  ].filter(Boolean).join(" - ");
}

export async function buildQuotePdf(quote: QuotePdfData, company: QuotePdfCompanyProfile = {}) {
  const document = await PDFDocument.create();
  const page = document.addPage([A4_WIDTH, A4_HEIGHT]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const contentWidth = A4_WIDTH - MARGIN * 2;
  let y = A4_HEIGHT - MARGIN;

  let logo: PDFImage | null = null;
  if (company.logoUrl?.startsWith("data:image/")) {
    try {
      const match = company.logoUrl.match(/^data:image\/(png|jpe?g);base64,(.+)$/i);
      if (match) {
        const bytes = Buffer.from(match[2], "base64");
        logo = match[1].toLowerCase() === "png"
          ? await document.embedPng(bytes)
          : await document.embedJpg(bytes);
      }
    } catch {
      // Um logo inválido nunca deve impedir o envio da proposta.
      logo = null;
    }
  }

  // Cabeçalho empresarial e identificação da proposta.
  page.drawRectangle({ x: MARGIN, y: y - 82, width: contentWidth, height: 82, color: NAVY });
  const companyTextX = MARGIN + 18 + (logo ? 56 : 0);
  if (logo) {
    const dimensions = logo.scaleToFit(45, 45);
    page.drawImage(logo, {
      x: MARGIN + 16 + (45 - dimensions.width) / 2,
      y: y - 64 + (45 - dimensions.height) / 2,
      width: dimensions.width,
      height: dimensions.height,
    });
  }
  page.drawText(pdfText((company.tradeName || company.corporateName || "NEXUS CLIMATIZACAO").toUpperCase()), { x: companyTextX, y: y - 25, font: bold, size: logo ? 12 : 15, color: rgb(1, 1, 1) });
  page.drawText(pdfText(company.corporateName || "Solucoes em climatizacao, eletrica e manutencao"), { x: companyTextX, y: y - 43, font: regular, size: 7.5, color: rgb(0.75, 0.84, 1) });
  page.drawText(pdfText([company.cnpj && `CNPJ ${company.cnpj}`, company.phone, company.email].filter(Boolean).join("  |  ")), { x: companyTextX, y: y - 60, font: regular, size: 6.8, color: rgb(0.75, 0.84, 1) });
  page.drawRectangle({ x: A4_WIDTH - MARGIN - 181, y: y - 65, width: 164, height: 48, color: rgb(0.08, 0.18, 0.43), borderColor: rgb(0.25, 0.45, 0.86), borderWidth: 0.8 });
  page.drawText("PROPOSTA COMERCIAL", { x: A4_WIDTH - MARGIN - 163, y: y - 32, font: bold, size: 7, color: rgb(0.73, 0.83, 1) });
  page.drawText(pdfText(quote.code), { x: A4_WIDTH - MARGIN - 163, y: y - 49, font: bold, size: 14, color: rgb(1, 1, 1) });
  page.drawText(pdfText(`Versao ${quote.version || 1}  |  ${date(quote.createdAt)}`), { x: A4_WIDTH - MARGIN - 163, y: y - 60, font: regular, size: 6.5, color: rgb(0.73, 0.83, 1) });
  y -= 100;

  const boxGap = 10;
  const boxWidth = (contentWidth - boxGap) / 2;
  page.drawRectangle({ x: MARGIN, y: y - 88, width: boxWidth, height: 88, color: rgb(0.985, 0.99, 1), borderColor: BORDER, borderWidth: 0.8 });
  page.drawRectangle({ x: MARGIN + boxWidth + boxGap, y: y - 88, width: boxWidth, height: 88, color: rgb(0.985, 0.99, 1), borderColor: BORDER, borderWidth: 0.8 });
  page.drawCircle({ x: MARGIN + 14, y: y - 15, size: 3.2, color: BLUE });
  page.drawText("DADOS DO CLIENTE", { x: MARGIN + 23, y: y - 18, font: bold, size: 7, color: NAVY });
  page.drawText(pdfText(quote.client.socialName || quote.client.name), { x: MARGIN + 14, y: y - 34, font: bold, size: 8.4, color: TEXT });
  page.drawText(pdfText(`CPF/CNPJ: ${quote.client.cpfCnpj || "Nao informado"}`), { x: MARGIN + 14, y: y - 48, font: regular, size: 6.6, color: MUTED });
  drawLines(page, wrap(addressOf(quote), regular, 6.3, boxWidth - 28), { x: MARGIN + 14, y: y - 61, font: regular, size: 6.3, color: MUTED, lineHeight: 8, maxLines: 2 });
  if (quote.contact) {
    page.drawText(pdfText(`Contato: ${quote.contact.name}${quote.contact.email ? ` - ${quote.contact.email}` : ""}`), { x: MARGIN + 14, y: y - 82, font: regular, size: 5.8, color: MUTED });
  }

  const rightX = MARGIN + boxWidth + boxGap;
  page.drawCircle({ x: rightX + 14, y: y - 15, size: 3.2, color: BLUE });
  page.drawText("DADOS DA PROPOSTA", { x: rightX + 23, y: y - 18, font: bold, size: 7, color: NAVY });
  page.drawText(pdfText(`Validade: ${date(quote.validUntil)}`), { x: rightX + 14, y: y - 35, font: bold, size: 7, color: TEXT });
  page.drawText(pdfText(`Pagamento: ${quote.paymentTerms || "A combinar"}`), { x: rightX + 14, y: y - 49, font: regular, size: 6.4, color: MUTED });
  page.drawText(pdfText(`Execucao: ${quote.executionTerm || "A combinar"}`), { x: rightX + 14, y: y - 62, font: regular, size: 6.4, color: MUTED });
  page.drawText(pdfText(`Garantia: ${quote.warrantyDays || 90} dias`), { x: rightX + 14, y: y - 74, font: regular, size: 6.4, color: MUTED });
  y -= 106;

  page.drawText("OBJETO DA PROPOSTA", { x: MARGIN, y, font: bold, size: 7.2, color: NAVY });
  y -= 12;
  drawLines(page, wrap(quote.notes || "Fornecimento de materiais e execucao dos servicos descritos abaixo, conforme condicoes desta proposta.", regular, 6.8, contentWidth), { x: MARGIN, y, font: regular, size: 6.8, color: MUTED, lineHeight: 8.5, maxLines: 3 });
  y -= 29;

  const tableTop = y;
  const footerReserve = 170;
  const availableRowsHeight = Math.max(180, tableTop - footerReserve);
  const descriptionWidth = 260;
  let itemFontSize = 7;
  let itemLineHeight = 8.4;
  let rowLayouts = quote.items.map((item) => ({ item, lines: wrap(item.description, regular, itemFontSize, descriptionWidth) }));
  const neededHeight = () => rowLayouts.reduce((total, row) => total + Math.max(24, row.lines.length * itemLineHeight + 10), 0);
  while (neededHeight() > availableRowsHeight && itemFontSize > 3.4) {
    itemFontSize -= 0.35;
    itemLineHeight = itemFontSize * 1.18;
    rowLayouts = quote.items.map((item) => ({ item, lines: wrap(item.description, regular, itemFontSize, descriptionWidth) }));
  }

  const headerHeight = 24;
  page.drawRectangle({ x: MARGIN, y: y - headerHeight, width: contentWidth, height: headerHeight, color: NAVY });
  const columns = [MARGIN + 10, MARGIN + 40, MARGIN + 310, MARGIN + 360, MARGIN + 405, MARGIN + 468];
  ["ITEM", "DESCRICAO DOS SERVICOS / MATERIAIS", "QTDE", "UNID", "VALOR UNIT.", "VALOR TOTAL"].forEach((label, index) => {
    page.drawText(label, { x: columns[index], y: y - 15, font: bold, size: index === 1 ? 6.2 : 5.7, color: rgb(1, 1, 1) });
  });
  y -= headerHeight;

  const forceCompactRows = rowLayouts.length > 0 && neededHeight() > availableRowsHeight;
  const compactRowHeight = forceCompactRows ? availableRowsHeight / rowLayouts.length : null;

  rowLayouts.forEach((row, index) => {
    const rowHeight = compactRowHeight || Math.max(23, row.lines.length * itemLineHeight + 9);
    const effectiveFontSize = compactRowHeight
      ? Math.max(2.7, Math.min(itemFontSize, compactRowHeight * 0.42))
      : itemFontSize;
    const effectiveLineHeight = Math.max(3.2, effectiveFontSize * 1.15);
    const wrappedLines = wrap(row.item.description, regular, effectiveFontSize, descriptionWidth);
    const maxLines = compactRowHeight
      ? Math.max(1, Math.floor((rowHeight - 4) / effectiveLineHeight))
      : wrappedLines.length;
    const visibleLines = wrappedLines.slice(0, maxLines);
    if (wrappedLines.length > visibleLines.length && visibleLines.length) {
      const lastIndex = visibleLines.length - 1;
      visibleLines[lastIndex] = `${visibleLines[lastIndex].slice(0, Math.max(1, visibleLines[lastIndex].length - 3))}...`;
    }
    page.drawRectangle({ x: MARGIN, y: y - rowHeight, width: contentWidth, height: rowHeight, color: index % 2 ? rgb(0.985, 0.988, 0.995) : rgb(1, 1, 1), borderColor: BORDER, borderWidth: 0.45 });
    const textY = y - Math.max(5, Math.min(14, rowHeight * 0.62));
    page.drawText(String(index + 1), { x: columns[0] + 4, y: textY, font: regular, size: effectiveFontSize, color: MUTED });
    drawLines(page, visibleLines, { x: columns[1], y: textY, font: regular, size: effectiveFontSize, color: TEXT, lineHeight: effectiveLineHeight });
    page.drawText(pdfText(row.item.quantity), { x: columns[2] + 5, y: textY, font: regular, size: effectiveFontSize, color: TEXT });
    page.drawText(pdfText(row.item.unit), { x: columns[3] + 4, y: textY, font: regular, size: effectiveFontSize, color: TEXT });
    page.drawText(money(row.item.unitPrice), { x: columns[4], y: textY, font: regular, size: Math.max(2.7, effectiveFontSize - 0.35), color: TEXT });
    page.drawText(money(row.item.total), { x: columns[5], y: textY, font: bold, size: Math.max(2.7, effectiveFontSize - 0.35), color: TEXT });
    y -= rowHeight;
  });

  y -= 12;
  const totalBoxWidth = 210;
  const totalBoxX = A4_WIDTH - MARGIN - totalBoxWidth;
  page.drawRectangle({ x: totalBoxX, y: y - 76, width: totalBoxWidth, height: 76, color: LIGHT_BLUE, borderColor: rgb(0.68, 0.79, 0.96), borderWidth: 0.8 });
  const totalRows: Array<[string, string, boolean]> = [
    ["Subtotal", money(quote.subtotal), false],
    ["Desconto", `- ${money(quote.discount)}`, false],
    ["Impostos / acrescimos", money(quote.tax), false],
    ["TOTAL DA PROPOSTA", money(quote.total), true],
  ];
  totalRows.forEach(([label, value, strong], index) => {
    const lineY = y - 15 - index * 16;
    page.drawText(label, { x: totalBoxX + 12, y: lineY, font: strong ? bold : regular, size: strong ? 8 : 6.5, color: strong ? NAVY : MUTED });
    const valueFont = strong ? bold : regular;
    const valueSize = strong ? 10 : 6.5;
    page.drawText(value, { x: totalBoxX + totalBoxWidth - 12 - valueFont.widthOfTextAtSize(value, valueSize), y: lineY, font: valueFont, size: valueSize, color: strong ? GREEN : TEXT });
  });

  page.drawText("ACEITE DA PROPOSTA", { x: MARGIN, y: y - 14, font: bold, size: 7, color: NAVY });
  page.drawText("Nome: __________________________________________", { x: MARGIN, y: y - 34, font: regular, size: 6.4, color: MUTED });
  page.drawText("Data: ____/____/________    Assinatura: ____________________", { x: MARGIN, y: y - 51, font: regular, size: 6.4, color: MUTED });
  y -= 92;

  page.drawRectangle({ x: MARGIN, y: 28, width: contentWidth, height: 28, color: NAVY });
  page.drawText(pdfText(company.tradeName || "NEXUS ERP"), { x: MARGIN + 12, y: 39, font: bold, size: 6.5, color: rgb(1, 1, 1) });
  const footer = pdfText(`${quote.code} - Documento gerado pelo O Prestador`);
  page.drawText(footer, { x: A4_WIDTH - MARGIN - 12 - regular.widthOfTextAtSize(footer, 6.2), y: 39, font: regular, size: 6.2, color: rgb(0.72, 0.82, 1) });

  return document.save({ useObjectStreams: false });
}
