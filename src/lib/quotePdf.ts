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
  preventivePlanJson?: string | null;
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

interface PreventivePlanPdf {
  schemaVersion?: number;
  templateId?: string;
  title?: string;
  frequency?: string;
  visitsPerYear?: number;
  durationHours?: number;
  technicians?: number;
  slaHours?: number;
  startDate?: string;
  disciplineIds?: string[];
  scope?: Array<{ id?: string; group?: string; label?: string }>;
  deliverables?: string[];
  inclusions?: string[];
  exclusions?: string[];
  equipments?: Array<{ type?: string; brand?: string; model?: string; tag?: string; location?: string }>;
  pricing?: {
    packagePricePerVisit?: number;
    disciplinePrices?: Array<{ disciplineId?: string; pricePerVisit?: number }>;
    materialsPerVisit?: number;
    travelPerVisit?: number;
    discount?: number;
    tax?: number;
    taxRegime?: string;
    taxRate?: number;
  };
}

const preventiveDisciplineLabels: Record<string, string> = {
  CLIMATIZACAO: "Climatização e PMOC",
  REFRIGERACAO: "Refrigeração comercial",
  ELETRICA: "Elétrica e quadros",
  HIDRAULICA: "Hidráulica e sanitária",
  CIVIL: "Civil e conservação predial",
  INCENDIO: "Combate a incêndio",
};

const preventiveDisciplineDescriptions: Record<string, string> = {
  CLIMATIZACAO: "Conforto térmico, higienização, medições operacionais e registros do PMOC.",
  REFRIGERACAO: "Controle de temperatura, degelo, vedação, componentes e circuito frigorífico.",
  ELETRICA: "Quadros, circuitos, proteções, termografia, medições e identificação técnica.",
  HIDRAULICA: "Redes, bombas, reservatórios, pontos sanitários, drenagem e vazamentos aparentes.",
  CIVIL: "Coberturas, fachadas, acabamentos, infiltrações, esquadrias e conservação predial.",
  INCENDIO: "Extintores, hidrantes, alarmes, iluminação, sinalização e rotas de fuga.",
};

const taxRegimeLabels: Record<string, string> = {
  SIMPLES_NACIONAL: "Simples Nacional",
  LUCRO_PRESUMIDO: "Lucro Presumido",
  LUCRO_REAL: "Lucro Real",
};

function parsePreventivePlan(value?: string | null): PreventivePlanPdf | null {
  if (!value) return null;
  try {
    const plan = JSON.parse(value) as PreventivePlanPdf;
    return plan.scope?.length ? plan : null;
  } catch {
    return null;
  }
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
    .replace(/[•·]/g, "-")
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

function frequencyLabel(value?: string) {
  const labels: Record<string, string> = {
    MENSAL: "Mensal",
    BIMESTRAL: "Bimestral",
    TRIMESTRAL: "Trimestral",
    SEMESTRAL: "Semestral",
    ANUAL: "Anual",
  };
  return labels[value || ""] || value || "A definir";
}

function taxLabel(plan: PreventivePlanPdf) {
  const regime = plan.pricing?.taxRegime;
  const rate = Number(plan.pricing?.taxRate) || 0;
  const regimeLabel = regime ? taxRegimeLabels[regime] || regime.replaceAll("_", " ") : "Regime tributário configurado";
  return `${regimeLabel} - ${rate.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function drawPreventiveCover(options: {
  document: PDFDocument;
  quote: QuotePdfData;
  company: QuotePdfCompanyProfile;
  plan: PreventivePlanPdf;
  regular: PDFFont;
  bold: PDFFont;
  logo: PDFImage | null;
}) {
  const { document, quote, company, plan, regular, bold, logo } = options;
  const cover = document.addPage([A4_WIDTH, A4_HEIGHT]);
  const brand = pdfText(company.tradeName || company.corporateName || "O PRESTADOR");
  const disciplines = (plan.disciplineIds || []).map((id) => preventiveDisciplineLabels[id] || id);
  const coverTitle = plan.title || "Plano de manutenção preventiva";
  const clientName = quote.client.socialName || quote.client.name;
  const monthlyEquivalent = quote.total / 12;

  cover.drawRectangle({ x: 0, y: 0, width: A4_WIDTH, height: A4_HEIGHT, color: rgb(0.975, 0.982, 0.995) });
  cover.drawRectangle({ x: 0, y: 417, width: A4_WIDTH, height: A4_HEIGHT - 417, color: NAVY });
  cover.drawRectangle({ x: 0, y: 417, width: 10, height: A4_HEIGHT - 417, color: BLUE });
  cover.drawRectangle({ x: 420, y: 702, width: 230, height: 92, color: rgb(0.06, 0.22, 0.52), opacity: 0.7 });
  cover.drawRectangle({ x: 470, y: 642, width: 180, height: 38, color: BLUE, opacity: 0.45 });

  if (logo) {
    cover.drawRectangle({ x: MARGIN, y: 760, width: 52, height: 52, color: rgb(1, 1, 1), opacity: 0.98 });
    const dimensions = logo.scaleToFit(40, 40);
    cover.drawImage(logo, {
      x: MARGIN + 6 + (40 - dimensions.width) / 2,
      y: 766 + (40 - dimensions.height) / 2,
      width: dimensions.width,
      height: dimensions.height,
    });
  }
  const brandX = MARGIN + (logo ? 66 : 0);
  cover.drawText(brand.toUpperCase(), { x: brandX, y: 792, font: bold, size: 13, color: rgb(1, 1, 1) });
  cover.drawText("ENGENHARIA, MANUTENÇÃO E GESTÃO TÉCNICA", { x: brandX, y: 776, font: regular, size: 6.5, color: rgb(0.67, 0.79, 1) });

  cover.drawRectangle({ x: MARGIN, y: 706, width: 153, height: 23, color: BLUE });
  cover.drawText("PROPOSTA TÉCNICA E COMERCIAL", { x: MARGIN + 10, y: 714, font: bold, size: 6.8, color: rgb(1, 1, 1) });
  const titleLines = wrap(coverTitle, bold, 25, 455).slice(0, 3);
  drawLines(cover, titleLines, { x: MARGIN, y: 674, font: bold, size: 25, color: rgb(1, 1, 1), lineHeight: 29 });
  const afterTitleY = 674 - titleLines.length * 29 - 8;
  const packageLabel = disciplines.length > 1 ? `PACOTE INTEGRADO - ${disciplines.length} DISCIPLINAS` : disciplines[0] || "PLANO PERSONALIZADO";
  cover.drawText(pdfText(packageLabel), { x: MARGIN, y: afterTitleY, font: bold, size: 7.2, color: rgb(0.42, 0.77, 1) });
  const disciplineLines = wrap(disciplines.join("  |  ") || "Escopo técnico personalizado", regular, 7.1, 465);
  drawLines(cover, disciplineLines, { x: MARGIN, y: afterTitleY - 17, font: regular, size: 7.1, color: rgb(0.78, 0.86, 1), lineHeight: 10, maxLines: 2 });

  cover.drawText("PREPARADO ESPECIALMENTE PARA", { x: MARGIN, y: 377, font: bold, size: 6.8, color: BLUE });
  const clientLines = wrap(clientName, bold, 17, 500).slice(0, 2);
  drawLines(cover, clientLines, { x: MARGIN, y: 349, font: bold, size: 17, color: NAVY, lineHeight: 20 });
  const clientBottomY = 349 - clientLines.length * 20;
  drawLines(cover, wrap(addressOf(quote), regular, 7, 500), { x: MARGIN, y: clientBottomY - 2, font: regular, size: 7, color: MUTED, lineHeight: 9, maxLines: 2 });

  cover.drawRectangle({ x: MARGIN, y: 159, width: 330, height: 112, color: rgb(1, 1, 1), borderColor: BORDER, borderWidth: 0.8 });
  cover.drawText("INVESTIMENTO DO PLANO", { x: MARGIN + 18, y: 245, font: bold, size: 6.7, color: BLUE });
  cover.drawText(money(quote.total), { x: MARGIN + 18, y: 211, font: bold, size: 23, color: NAVY });
  cover.drawText(pdfText(`Equivalente mensal de ${money(monthlyEquivalent)}`), { x: MARGIN + 18, y: 190, font: regular, size: 7.5, color: MUTED });
  cover.drawText(pdfText(`${plan.visitsPerYear || 0} visita(s) programada(s) por ano - tributos inclusos no total`), { x: MARGIN + 18, y: 174, font: regular, size: 6.2, color: MUTED });

  cover.drawRectangle({ x: MARGIN + 344, y: 159, width: 175, height: 112, color: LIGHT_BLUE, borderColor: rgb(0.68, 0.79, 0.96), borderWidth: 0.8 });
  const metaRows = [
    ["PROPOSTA", quote.code],
    ["EMISSÃO", date(quote.createdAt)],
    ["VALIDADE", date(quote.validUntil)],
    ["PERIODICIDADE", frequencyLabel(plan.frequency)],
  ];
  metaRows.forEach(([label, value], index) => {
    const rowY = 244 - index * 22;
    cover.drawText(label, { x: MARGIN + 358, y: rowY, font: bold, size: 5.8, color: BLUE });
    const valueText = pdfText(value);
    cover.drawText(valueText, { x: A4_WIDTH - MARGIN - 14 - regular.widthOfTextAtSize(valueText, 6.5), y: rowY, font: regular, size: 6.5, color: TEXT });
  });

  cover.drawText("DOCUMENTO CONFIDENCIAL", { x: MARGIN, y: 91, font: bold, size: 6.2, color: NAVY });
  cover.drawText("Esta proposta foi preparada conforme as necessidades e condições informadas pelo cliente.", { x: MARGIN, y: 76, font: regular, size: 6.4, color: MUTED });
  cover.drawRectangle({ x: 0, y: 0, width: A4_WIDTH, height: 38, color: NAVY });
  cover.drawText(pdfText(`${brand} - ${company.cnpj ? `CNPJ ${company.cnpj}` : "Proposta comercial"}`), { x: MARGIN, y: 15, font: regular, size: 6.2, color: rgb(0.72, 0.82, 1) });
}

function drawPreventiveExecutive(options: {
  document: PDFDocument;
  quote: QuotePdfData;
  company: QuotePdfCompanyProfile;
  plan: PreventivePlanPdf;
  regular: PDFFont;
  bold: PDFFont;
}) {
  const { document, quote, company, plan, regular, bold } = options;
  const page = document.addPage([A4_WIDTH, A4_HEIGHT]);
  const contentWidth = A4_WIDTH - MARGIN * 2;
  const disciplines = plan.disciplineIds || [];
  const taxableBase = Math.max(0, quote.subtotal - quote.discount);

  page.drawRectangle({ x: 0, y: A4_HEIGHT - 82, width: A4_WIDTH, height: 82, color: NAVY });
  page.drawText("VISÃO EXECUTIVA DA PROPOSTA", { x: MARGIN, y: A4_HEIGHT - 33, font: bold, size: 8, color: rgb(0.55, 0.78, 1) });
  page.drawText("Uma manutenção previsível, documentada e orientada por criticidade", { x: MARGIN, y: A4_HEIGHT - 57, font: bold, size: 14, color: rgb(1, 1, 1) });
  const brand = pdfText(company.tradeName || company.corporateName || "O PRESTADOR");
  page.drawText(brand, { x: A4_WIDTH - MARGIN - bold.widthOfTextAtSize(brand, 7.5), y: A4_HEIGHT - 34, font: bold, size: 7.5, color: rgb(1, 1, 1) });

  let y = A4_HEIGHT - 112;
  page.drawText("OBJETIVO E ENTENDIMENTO", { x: MARGIN, y, font: bold, size: 7.2, color: BLUE });
  y -= 18;
  const objective = quote.notes?.trim() || `Implantar um programa de manutenção preventiva para ${quote.client.socialName || quote.client.name}, com rotinas técnicas programadas, evidências por ativo e acompanhamento das pendências. O plano busca reduzir falhas inesperadas, aumentar a vida útil dos equipamentos e dar previsibilidade à operação.`;
  const objectiveLines = wrap(objective, regular, 8.3, contentWidth);
  drawLines(page, objectiveLines, { x: MARGIN, y, font: regular, size: 8.3, color: TEXT, lineHeight: 12, maxLines: 6 });
  y -= Math.min(6, objectiveLines.length) * 12 + 20;

  const metricGap = 8;
  const metricWidth = (contentWidth - metricGap * 3) / 4;
  const metrics = [
    [String(plan.visitsPerYear || 0), "VISITAS / ANO"],
    [`${plan.durationHours || 0}h`, "POR VISITA"],
    [String(plan.technicians || 0), "TÉCNICOS"],
    [`${plan.slaHours || 0}h`, "SLA DE RESPOSTA"],
  ];
  metrics.forEach(([value, label], index) => {
    const x = MARGIN + index * (metricWidth + metricGap);
    page.drawRectangle({ x, y: y - 58, width: metricWidth, height: 58, color: index === 0 ? NAVY : LIGHT_BLUE, borderColor: index === 0 ? NAVY : rgb(0.68, 0.79, 0.96), borderWidth: 0.6 });
    page.drawText(pdfText(value), { x: x + 12, y: y - 27, font: bold, size: 16, color: index === 0 ? rgb(1, 1, 1) : NAVY });
    page.drawText(label, { x: x + 12, y: y - 44, font: bold, size: 5.8, color: index === 0 ? rgb(0.67, 0.8, 1) : BLUE });
  });
  y -= 82;

  page.drawText("COMO O PLANO SERÁ EXECUTADO", { x: MARGIN, y, font: bold, size: 7.2, color: BLUE });
  y -= 18;
  const phases = [
    ["01", "PLANEJAMENTO", "Cronograma, ativos, responsáveis e janela de atendimento definidos antes da mobilização."],
    ["02", "EXECUÇÃO TÉCNICA", "Checklists por disciplina, inspeções, testes e medições conforme o escopo contratado."],
    ["03", "EVIDÊNCIAS", "Fotos, resultados, anomalias e recomendações vinculados aos equipamentos e ambientes."],
    ["04", "GESTÃO", "Pendências priorizadas por criticidade, histórico das visitas e visão gerencial da operação."],
  ];
  const phaseWidth = (contentWidth - 10) / 2;
  phases.forEach(([number, title, description], index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = MARGIN + col * (phaseWidth + 10);
    const cardY = y - row * 76;
    page.drawRectangle({ x, y: cardY - 64, width: phaseWidth, height: 64, color: rgb(0.985, 0.99, 1), borderColor: BORDER, borderWidth: 0.7 });
    page.drawCircle({ x: x + 20, y: cardY - 20, size: 11, color: BLUE });
    page.drawText(number, { x: x + 14.5, y: cardY - 23, font: bold, size: 7, color: rgb(1, 1, 1) });
    page.drawText(title, { x: x + 39, y: cardY - 16, font: bold, size: 6.7, color: NAVY });
    drawLines(page, wrap(description, regular, 6.4, phaseWidth - 52), { x: x + 39, y: cardY - 31, font: regular, size: 6.4, color: MUTED, lineHeight: 8.2, maxLines: 3 });
  });
  y -= 172;

  page.drawText("COBERTURA TÉCNICA CONTRATADA", { x: MARGIN, y, font: bold, size: 7.2, color: BLUE });
  y -= 19;
  disciplines.forEach((id, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = MARGIN + col * (phaseWidth + 10);
    const lineY = y - row * 42;
    page.drawRectangle({ x, y: lineY - 34, width: phaseWidth, height: 34, color: rgb(0.97, 0.98, 1) });
    page.drawCircle({ x: x + 10, y: lineY - 10, size: 2.6, color: GREEN });
    page.drawText(pdfText(preventiveDisciplineLabels[id] || id), { x: x + 19, y: lineY - 9, font: bold, size: 6.3, color: TEXT });
    const description = preventiveDisciplineDescriptions[id] || "Rotina técnica conforme escopo detalhado.";
    drawLines(page, wrap(description, regular, 5.2, phaseWidth - 29), { x: x + 19, y: lineY - 20, font: regular, size: 5.2, color: MUTED, lineHeight: 6.3, maxLines: 2 });
  });
  y -= Math.ceil(Math.max(1, disciplines.length) / 2) * 42 + 18;

  const financeHeight = 91;
  page.drawRectangle({ x: MARGIN, y: y - financeHeight, width: contentWidth, height: financeHeight, color: NAVY });
  page.drawText("RESUMO DO INVESTIMENTO", { x: MARGIN + 16, y: y - 18, font: bold, size: 6.5, color: rgb(0.55, 0.78, 1) });
  const financeColumns = [
    ["BASE APÓS DESCONTO", money(taxableBase)],
    [`TRIBUTOS - ${taxLabel(plan)}`, money(quote.tax)],
    ["INVESTIMENTO TOTAL", money(quote.total)],
  ];
  financeColumns.forEach(([label, value], index) => {
    const x = MARGIN + 16 + index * 168;
    page.drawText(pdfText(label), { x, y: y - 42, font: bold, size: index === 2 ? 5.9 : 5.4, color: rgb(0.68, 0.8, 1) });
    page.drawText(pdfText(value), { x, y: y - 66, font: bold, size: index === 2 ? 14 : 11, color: index === 2 ? rgb(0.31, 0.88, 0.59) : rgb(1, 1, 1) });
  });
  page.drawText("Os tributos são calculados sobre a base após desconto. Retenções legais do tomador, quando aplicáveis, seguem a legislação e o documento fiscal.", { x: MARGIN + 16, y: y - 82, font: regular, size: 5.4, color: rgb(0.69, 0.79, 0.94) });

  page.drawRectangle({ x: MARGIN, y: 28, width: contentWidth, height: 25, color: NAVY });
  page.drawText(pdfText(`${quote.code} - Visão executiva integrante da proposta`), { x: MARGIN + 10, y: 37, font: regular, size: 6.2, color: rgb(0.78, 0.85, 1) });
}

function addPreventivePageNumbers(document: PDFDocument, regular: PDFFont) {
  const pages = document.getPages();
  pages.forEach((page, index) => {
    const value = pdfText(`Página ${index + 1} de ${pages.length}`);
    page.drawText(value, {
      x: A4_WIDTH / 2 - regular.widthOfTextAtSize(value, 5.8) / 2,
      y: index === 0 ? 15 : index < 3 ? 37 : 76,
      font: regular,
      size: 5.8,
      color: index < 3 ? rgb(0.72, 0.82, 1) : MUTED,
    });
  });
}

function refreshPreventiveTechnicalPageChrome(
  document: PDFDocument,
  quote: QuotePdfData,
  company: QuotePdfCompanyProfile,
  regular: PDFFont,
  bold: PDFFont,
) {
  const brand = pdfText(company.tradeName || company.corporateName || "O PRESTADOR");
  document.getPages().slice(3).forEach((page) => {
    page.drawText("PLANO TÉCNICO DE MANUTENÇÃO PREVENTIVA", { x: MARGIN, y: 738, font: bold, size: 8.5, color: BLUE });
    page.drawText(pdfText(quote.code), { x: MARGIN, y: 714, font: bold, size: 15, color: NAVY });
    page.drawText(brand, { x: A4_WIDTH - MARGIN - bold.widthOfTextAtSize(brand, 8), y: 717, font: bold, size: 8, color: NAVY });
    page.drawRectangle({ x: MARGIN, y: 692, width: A4_WIDTH - MARGIN * 2, height: 2, color: BLUE });
    page.drawRectangle({ x: MARGIN, y: 91, width: A4_WIDTH - MARGIN * 2, height: 1, color: BORDER });
    page.drawText(pdfText(`${quote.code} - Escopo técnico integrante da proposta comercial`), { x: MARGIN, y: 76, font: regular, size: 6.2, color: MUTED });
  });
}

export async function buildQuotePdf(quote: QuotePdfData, company: QuotePdfCompanyProfile = {}) {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const contentWidth = A4_WIDTH - MARGIN * 2;
  const preventivePlan = parsePreventivePlan(quote.preventivePlanJson);
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

  if (preventivePlan) {
    drawPreventiveCover({ document, quote, company, plan: preventivePlan, regular, bold, logo });
    drawPreventiveExecutive({ document, quote, company, plan: preventivePlan, regular, bold });
  }

  const page = document.addPage([A4_WIDTH, A4_HEIGHT]);

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
  const footerReserve = preventivePlan ? 194 : 170;
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
  const totalBoxHeight = preventivePlan ? 96 : 76;
  page.drawRectangle({ x: totalBoxX, y: y - totalBoxHeight, width: totalBoxWidth, height: totalBoxHeight, color: LIGHT_BLUE, borderColor: rgb(0.68, 0.79, 0.96), borderWidth: 0.8 });
  const totalRows: Array<[string, string, boolean]> = [
    ["Subtotal", money(quote.subtotal), false],
    ["Desconto", `- ${money(quote.discount)}`, false],
    ...(preventivePlan ? [["Base após desconto", money(Math.max(0, quote.subtotal - quote.discount)), false] as [string, string, boolean]] : []),
    ["Impostos / acrescimos", money(quote.tax), false],
    ["TOTAL DA PROPOSTA", money(quote.total), true],
  ];
  totalRows.forEach(([label, value, strong], index) => {
    const lineY = y - 15 - index * (preventivePlan ? 15 : 16);
    page.drawText(label, { x: totalBoxX + 12, y: lineY, font: strong ? bold : regular, size: strong ? 8 : 6.5, color: strong ? NAVY : MUTED });
    const valueFont = strong ? bold : regular;
    const valueSize = strong ? 10 : 6.5;
      page.drawText(value, { x: totalBoxX + totalBoxWidth - 12 - valueFont.widthOfTextAtSize(value, valueSize), y: lineY, font: valueFont, size: valueSize, color: strong ? GREEN : TEXT });
  });
  if (preventivePlan) {
    const taxInfo = pdfText(`Tributação estimada: ${taxLabel(preventivePlan)}`);
    page.drawText(taxInfo, { x: totalBoxX + 12, y: y - 89, font: regular, size: 5.1, color: MUTED });
  }

  page.drawText("ACEITE DA PROPOSTA", { x: MARGIN, y: y - 14, font: bold, size: 7, color: NAVY });
  page.drawText("Nome: __________________________________________", { x: MARGIN, y: y - 34, font: regular, size: 6.4, color: MUTED });
  page.drawText("Data: ____/____/________    Assinatura: ____________________", { x: MARGIN, y: y - 51, font: regular, size: 6.4, color: MUTED });
  y -= preventivePlan ? 112 : 92;

  page.drawRectangle({ x: MARGIN, y: 28, width: contentWidth, height: 28, color: NAVY });
  page.drawText(pdfText(company.tradeName || "NEXUS ERP"), { x: MARGIN + 12, y: 39, font: bold, size: 6.5, color: rgb(1, 1, 1) });
  const footer = pdfText(`${quote.code} - Documento gerado pelo O Prestador`);
  page.drawText(footer, { x: A4_WIDTH - MARGIN - 12 - regular.widthOfTextAtSize(footer, 6.2), y: 39, font: regular, size: 6.2, color: rgb(0.72, 0.82, 1) });

  if (preventivePlan) {
    let detailPage: PDFPage = page;
    let detailY = 0;
    const detailWidth = contentWidth;

    const addDetailPage = () => {
      detailPage = document.addPage([A4_WIDTH, A4_HEIGHT]);
      detailPage.drawText("PLANO TÉCNICO DE MANUTENÇÃO PREVENTIVA", { x: MARGIN, y: 738, font: bold, size: 8.5, color: BLUE });
      detailPage.drawText(pdfText(quote.code), { x: MARGIN, y: 714, font: bold, size: 15, color: NAVY });
      const brand = pdfText(company.tradeName || company.corporateName || "O PRESTADOR");
      detailPage.drawText(brand, { x: A4_WIDTH - MARGIN - bold.widthOfTextAtSize(brand, 8), y: 717, font: bold, size: 8, color: NAVY });
      detailPage.drawRectangle({ x: MARGIN, y: 692, width: detailWidth, height: 2, color: BLUE });
      detailPage.drawRectangle({ x: MARGIN, y: 91, width: detailWidth, height: 1, color: BORDER });
      detailPage.drawText(pdfText(`${quote.code} - Escopo técnico integrante da proposta comercial`), { x: MARGIN, y: 76, font: regular, size: 6.2, color: MUTED });
      detailY = 670;
    };

    const ensureDetailSpace = (height: number) => {
      if (detailY - height < 108) addDetailPage();
    };

    const detailHeading = (title: string) => {
      ensureDetailSpace(31);
      detailPage.drawRectangle({ x: MARGIN, y: detailY - 22, width: detailWidth, height: 22, color: LIGHT_BLUE, borderColor: rgb(0.68, 0.79, 0.96), borderWidth: 0.5 });
      detailPage.drawText(pdfText(title.toUpperCase()), { x: MARGIN + 10, y: detailY - 14, font: bold, size: 7.3, color: NAVY });
      detailY -= 31;
    };

    const detailBullet = (text: string, color = TEXT) => {
      const bulletLines = wrap(text, regular, 7, detailWidth - 26);
      const height = Math.max(14, bulletLines.length * 9 + 4);
      ensureDetailSpace(height);
      detailPage.drawCircle({ x: MARGIN + 5, y: detailY - 5, size: 2, color: BLUE });
      drawLines(detailPage, bulletLines, { x: MARGIN + 14, y: detailY - 8, font: regular, size: 7, color, lineHeight: 9 });
      detailY -= height;
    };

    addDetailPage();
    const planTitle = preventivePlan.title || "Plano de manutenção preventiva";
    const titleLines = wrap(planTitle, bold, 15, detailWidth);
    drawLines(detailPage, titleLines, { x: MARGIN, y: detailY, font: bold, size: 15, color: NAVY, lineHeight: 18 });
    detailY -= titleLines.length * 18 + 12;

    const disciplines = (preventivePlan.disciplineIds || []).map((id) => preventiveDisciplineLabels[id] || id);
    const summaryRows = [
      ["PACOTE CONTRATADO", disciplines.length ? disciplines.join(" + ") : "Plano preventivo personalizado"],
      ["PERIODICIDADE", `${preventivePlan.frequency || "A definir"} · ${preventivePlan.visitsPerYear || 0} visita(s) por ano`],
      ["MOBILIZAÇÃO", `${preventivePlan.durationHours || 0} hora(s) por visita · ${preventivePlan.technicians || 0} técnico(s)`],
      ["ATENDIMENTO", `SLA de ${preventivePlan.slaHours || 0} hora(s) · início previsto ${preventivePlan.startDate ? date(`${preventivePlan.startDate}T12:00:00`) : "a definir"}`],
    ];
    summaryRows.forEach(([label, value], index) => {
      const rowY = detailY - index * 28;
      detailPage.drawRectangle({ x: MARGIN, y: rowY - 22, width: detailWidth, height: 24, color: index % 2 ? rgb(0.985, 0.988, 0.995) : rgb(0.96, 0.975, 1) });
      detailPage.drawText(label, { x: MARGIN + 10, y: rowY - 13, font: bold, size: 6.4, color: BLUE });
      const valueLines = wrap(value, regular, 6.8, detailWidth - 135);
      drawLines(detailPage, valueLines, { x: MARGIN + 126, y: rowY - 13, font: regular, size: 6.8, color: TEXT, lineHeight: 8, maxLines: 2 });
    });
    detailY -= summaryRows.length * 28 + 12;

    const scopeGroups = (preventivePlan.scope || []).reduce<Record<string, string[]>>((groups, item) => {
      const label = item.label?.trim();
      if (!label) return groups;
      const group = item.group?.trim() || "Escopo geral";
      groups[group] = [...(groups[group] || []), label];
      return groups;
    }, {});
    detailHeading(`Escopo técnico detalhado · ${preventivePlan.scope?.length || 0} atividades`);
    Object.entries(scopeGroups).forEach(([group, items]) => {
      ensureDetailSpace(25);
      detailPage.drawText(pdfText(group.toUpperCase()), { x: MARGIN, y: detailY - 7, font: bold, size: 7, color: BLUE });
      detailY -= 17;
      items.forEach((item) => detailBullet(item));
      detailY -= 4;
    });

    const detailSections: Array<[string, string[] | undefined, ReturnType<typeof rgb>]> = [
      ["Entregas ao cliente", preventivePlan.deliverables, TEXT],
      ["Incluso no pacote", preventivePlan.inclusions, GREEN],
      ["Não incluso / contratação à parte", preventivePlan.exclusions, rgb(0.72, 0.2, 0.14)],
    ];
    detailSections.forEach(([sectionTitle, items, color]) => {
      if (!items?.length) return;
      const estimatedHeight = 31 + items.reduce((sum, item) => sum + Math.max(14, wrap(item, regular, 7, detailWidth - 26).length * 9 + 4), 0);
      if (estimatedHeight < 680 && detailY - estimatedHeight < 72) addDetailPage();
      detailHeading(sectionTitle);
      items.forEach((item) => detailBullet(item, color));
      detailY -= 4;
    });

    if (preventivePlan.equipments?.length) {
      detailHeading(`Ativos inicialmente vinculados · ${preventivePlan.equipments.length}`);
      preventivePlan.equipments.forEach((equipment) => {
        detailBullet([equipment.tag || equipment.type, equipment.brand, equipment.model, equipment.location].filter(Boolean).join(" · "));
      });
    }

    refreshPreventiveTechnicalPageChrome(document, quote, company, regular, bold);
    addPreventivePageNumbers(document, regular);
  }

  return document.save({ useObjectStreams: false });
}
