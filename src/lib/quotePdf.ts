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
  proposalType?: string | null;
  storeName?: string | null;
  procurementNumber?: string | null;
  contractingAgency?: string | null;
  biddingNumber?: string | null;
  referenceBase?: string | null;
  referenceMonth?: string | null;
  publicBudgetSource?: string | null;
  deliveryTerm?: string | null;
  finalValueOverride?: number | null;
  address?: {
    street: string;
    number: string;
    complement?: string | null;
    neighborhood: string;
    city: string;
    state: string;
    cep?: string | null;
  } | null;
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
  const address = quote.address || quote.client.addresses?.[0];
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
  cover.drawText(brand.toUpperCase(), { x: brandX, y: 792, font: bold, size: 14, color: rgb(1, 1, 1) });
  cover.drawText("ENGENHARIA, MANUTENÇÃO E GESTÃO TÉCNICA", { x: brandX, y: 775, font: regular, size: 7.2, color: rgb(0.67, 0.79, 1) });

  cover.drawRectangle({ x: MARGIN, y: 706, width: 153, height: 23, color: BLUE });
  cover.drawText("PROPOSTA TÉCNICA E COMERCIAL", { x: MARGIN + 10, y: 714, font: bold, size: 7.3, color: rgb(1, 1, 1) });
  const titleLines = wrap(coverTitle, bold, 25, 455).slice(0, 3);
  drawLines(cover, titleLines, { x: MARGIN, y: 674, font: bold, size: 25, color: rgb(1, 1, 1), lineHeight: 29 });
  const afterTitleY = 674 - titleLines.length * 29 - 8;
  const packageLabel = disciplines.length > 1 ? `PACOTE INTEGRADO - ${disciplines.length} DISCIPLINAS` : disciplines[0] || "PLANO PERSONALIZADO";
  cover.drawText(pdfText(packageLabel), { x: MARGIN, y: afterTitleY, font: bold, size: 7.8, color: rgb(0.42, 0.77, 1) });
  const disciplineLines = wrap(disciplines.join("  |  ") || "Escopo técnico personalizado", regular, 7.6, 465);
  drawLines(cover, disciplineLines, { x: MARGIN, y: afterTitleY - 18, font: regular, size: 7.6, color: rgb(0.78, 0.86, 1), lineHeight: 10.5, maxLines: 2 });

  cover.drawText("PREPARADO ESPECIALMENTE PARA", { x: MARGIN, y: 377, font: bold, size: 7.4, color: BLUE });
  const clientLines = wrap(clientName, bold, 17, 500).slice(0, 2);
  drawLines(cover, clientLines, { x: MARGIN, y: 349, font: bold, size: 17, color: NAVY, lineHeight: 20 });
  const clientBottomY = 349 - clientLines.length * 20;
  drawLines(cover, wrap(addressOf(quote), regular, 7.6, 500), { x: MARGIN, y: clientBottomY - 2, font: regular, size: 7.6, color: MUTED, lineHeight: 9.5, maxLines: 2 });

  cover.drawRectangle({ x: MARGIN, y: 159, width: 330, height: 112, color: rgb(1, 1, 1), borderColor: BORDER, borderWidth: 0.8 });
  cover.drawText("INVESTIMENTO DO PLANO", { x: MARGIN + 18, y: 245, font: bold, size: 7.2, color: BLUE });
  cover.drawText(money(quote.total), { x: MARGIN + 18, y: 211, font: bold, size: 23, color: NAVY });
  cover.drawText(pdfText(`Equivalente mensal de ${money(monthlyEquivalent)}`), { x: MARGIN + 18, y: 190, font: regular, size: 8, color: MUTED });
  cover.drawText(pdfText(`${plan.visitsPerYear || 0} visita(s) programada(s) por ano - tributos inclusos no total`), { x: MARGIN + 18, y: 174, font: regular, size: 6.8, color: MUTED });

  cover.drawRectangle({ x: MARGIN + 344, y: 159, width: 175, height: 112, color: LIGHT_BLUE, borderColor: rgb(0.68, 0.79, 0.96), borderWidth: 0.8 });
  const metaRows = [
    ["PROPOSTA", quote.code],
    ["EMISSÃO", date(quote.createdAt)],
    ["VALIDADE", date(quote.validUntil)],
    ["PERIODICIDADE", frequencyLabel(plan.frequency)],
  ];
  metaRows.forEach(([label, value], index) => {
    const rowY = 244 - index * 22;
    cover.drawText(label, { x: MARGIN + 358, y: rowY, font: bold, size: 6.3, color: BLUE });
    const valueText = pdfText(value);
    cover.drawText(valueText, { x: A4_WIDTH - MARGIN - 14 - regular.widthOfTextAtSize(valueText, 7.2), y: rowY, font: regular, size: 7.2, color: TEXT });
  });

  cover.drawText("DOCUMENTO CONFIDENCIAL", { x: MARGIN, y: 91, font: bold, size: 6.8, color: NAVY });
  cover.drawText("Esta proposta foi preparada conforme as necessidades e condições informadas pelo cliente.", { x: MARGIN, y: 75, font: regular, size: 7, color: MUTED });
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
  page.drawText("Uma manutenção previsível, documentada e orientada por criticidade", { x: MARGIN, y: A4_HEIGHT - 58, font: bold, size: 15, color: rgb(1, 1, 1) });
  const brand = pdfText(company.tradeName || company.corporateName || "O PRESTADOR");
  page.drawText(brand, { x: A4_WIDTH - MARGIN - bold.widthOfTextAtSize(brand, 7.5), y: A4_HEIGHT - 34, font: bold, size: 7.5, color: rgb(1, 1, 1) });

  let y = A4_HEIGHT - 112;
  page.drawText("OBJETIVO E ENTENDIMENTO", { x: MARGIN, y, font: bold, size: 8, color: BLUE });
  y -= 18;
  const objective = quote.notes?.trim() || `Implantar um programa de manutenção preventiva para ${quote.client.socialName || quote.client.name}, com rotinas técnicas programadas, evidências por ativo e acompanhamento das pendências. O plano busca reduzir falhas inesperadas, aumentar a vida útil dos equipamentos e dar previsibilidade à operação.`;
  const objectiveLines = wrap(objective, regular, 9, contentWidth);
  drawLines(page, objectiveLines, { x: MARGIN, y, font: regular, size: 9, color: TEXT, lineHeight: 12.5, maxLines: 6 });
  y -= Math.min(6, objectiveLines.length) * 12.5 + 20;

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
    page.drawText(label, { x: x + 12, y: y - 44, font: bold, size: 6.4, color: index === 0 ? rgb(0.67, 0.8, 1) : BLUE });
  });
  y -= 82;

  page.drawText("COMO O PLANO SERÁ EXECUTADO", { x: MARGIN, y, font: bold, size: 8, color: BLUE });
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
    page.drawText(title, { x: x + 39, y: cardY - 16, font: bold, size: 7.3, color: NAVY });
    drawLines(page, wrap(description, regular, 7, phaseWidth - 52), { x: x + 39, y: cardY - 31, font: regular, size: 7, color: MUTED, lineHeight: 8.8, maxLines: 3 });
  });
  y -= 172;

  page.drawText("COBERTURA TÉCNICA CONTRATADA", { x: MARGIN, y, font: bold, size: 8, color: BLUE });
  y -= 19;
  disciplines.forEach((id, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = MARGIN + col * (phaseWidth + 10);
    const lineY = y - row * 42;
    page.drawRectangle({ x, y: lineY - 34, width: phaseWidth, height: 34, color: rgb(0.97, 0.98, 1) });
    page.drawCircle({ x: x + 10, y: lineY - 10, size: 2.6, color: GREEN });
    page.drawText(pdfText(preventiveDisciplineLabels[id] || id), { x: x + 19, y: lineY - 9, font: bold, size: 7.3, color: TEXT });
    const description = preventiveDisciplineDescriptions[id] || "Rotina técnica conforme escopo detalhado.";
    drawLines(page, wrap(description, regular, 6.1, phaseWidth - 29), { x: x + 19, y: lineY - 21, font: regular, size: 6.1, color: MUTED, lineHeight: 7, maxLines: 2 });
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
    page.drawText(pdfText(label), { x, y: y - 42, font: bold, size: index === 2 ? 6.5 : 6.2, color: rgb(0.68, 0.8, 1) });
    page.drawText(pdfText(value), { x, y: y - 66, font: bold, size: index === 2 ? 15 : 12, color: index === 2 ? rgb(0.31, 0.88, 0.59) : rgb(1, 1, 1) });
  });
  page.drawText("Os tributos são calculados sobre a base após desconto. Retenções legais do tomador, quando aplicáveis, seguem a legislação e o documento fiscal.", { x: MARGIN + 16, y: y - 82, font: regular, size: 6, color: rgb(0.69, 0.79, 0.94) });

  page.drawRectangle({ x: MARGIN, y: 28, width: contentWidth, height: 25, color: NAVY });
  page.drawText(pdfText(`${quote.code} - Visão executiva integrante da proposta`), { x: MARGIN + 10, y: 37, font: regular, size: 6.2, color: rgb(0.78, 0.85, 1) });
}

function addPreventivePageNumbers(document: PDFDocument, regular: PDFFont) {
  const pages = document.getPages();
  pages.forEach((page, index) => {
    const value = pdfText(`Página ${index + 1} de ${pages.length}`);
    page.drawText(value, {
      x: A4_WIDTH / 2 - regular.widthOfTextAtSize(value, 6.2) / 2,
      y: index === 0 ? 15 : 37,
      font: regular,
      size: 6.2,
      color: index < 3 ? rgb(0.72, 0.82, 1) : MUTED,
    });
  });
}

function drawPreventiveTechnicalAppendix(options: {
  document: PDFDocument;
  quote: QuotePdfData;
  company: QuotePdfCompanyProfile;
  plan: PreventivePlanPdf;
  regular: PDFFont;
  bold: PDFFont;
}) {
  const { document, quote, company, plan, regular, bold } = options;
  const firstTechnicalPageIndex = document.getPageCount();
  const contentWidth = A4_WIDTH - MARGIN * 2;
  const columnGap = 18;
  const columnWidth = (contentWidth - columnGap) / 2;
  const brand = pdfText(company.tradeName || company.corporateName || "O PRESTADOR");
  let page: PDFPage = document.getPage(document.getPageCount() - 1);
  let column = 0;
  let columnTop = 730;
  let y = columnTop;

  const xForColumn = () => MARGIN + column * (columnWidth + columnGap);

  const addPage = (label = "Caderno técnico") => {
    page = document.addPage([A4_WIDTH, A4_HEIGHT]);
    page.drawText(pdfText(label.toUpperCase()), { x: MARGIN, y: 796, font: bold, size: 7.2, color: BLUE });
    page.drawText(pdfText(quote.code), { x: MARGIN, y: 773, font: bold, size: 15, color: NAVY });
    page.drawText(brand, { x: A4_WIDTH - MARGIN - bold.widthOfTextAtSize(brand, 8.5), y: 779, font: bold, size: 8.5, color: NAVY });
    page.drawRectangle({ x: MARGIN, y: 755, width: contentWidth, height: 2, color: BLUE });
    page.drawRectangle({ x: MARGIN, y: 53, width: contentWidth, height: 1, color: BORDER });
    page.drawText(pdfText(`${quote.code} - Anexo técnico integrante da proposta comercial`), { x: MARGIN, y: 37, font: regular, size: 6.4, color: MUTED });
    column = 0;
    columnTop = 730;
    y = columnTop;
  };

  const nextColumn = (label = "Caderno técnico") => {
    if (column === 0) {
      column = 1;
      y = columnTop;
      return;
    }
    addPage(label);
  };

  const ensureColumnSpace = (height: number, label?: string) => {
    if (y - height < 72) nextColumn(label);
  };

  const bulletLayout = (text: string, width = columnWidth - 25) => {
    const lines = wrap(text, regular, 8.1, width);
    return { lines, height: Math.max(15, lines.length * 10.4 + 4) };
  };

  const drawBullet = (text: string, color = TEXT, sectionLabel?: string) => {
    const layout = bulletLayout(text);
    ensureColumnSpace(layout.height, sectionLabel);
    const x = xForColumn();
    page.drawCircle({ x: x + 5, y: y - 6, size: 1.8, color: color === TEXT ? BLUE : color });
    drawLines(page, layout.lines, { x: x + 14, y: y - 9, font: regular, size: 8.1, color, lineHeight: 10.4 });
    y -= layout.height;
  };

  const groupHeightOf = (items: string[]) => 24 + items.reduce((sum, item) => sum + bulletLayout(item).height, 0) + 9;

  const drawGroup = (title: string, items: string[]) => {
    const itemLayouts = items.map((item) => bulletLayout(item));
    const groupHeight = 24 + itemLayouts.reduce((sum, item) => sum + item.height, 0) + 9;
    ensureColumnSpace(Math.min(groupHeight, 610), "Escopo técnico detalhado");
    const x = xForColumn();
    page.drawRectangle({ x, y: y - 19, width: columnWidth, height: 19, color: LIGHT_BLUE });
    page.drawText(pdfText(title.toUpperCase()), { x: x + 9, y: y - 12.5, font: bold, size: 7.6, color: BLUE });
    y -= 27;
    items.forEach((item) => drawBullet(item, TEXT, "Escopo técnico detalhado"));
    y -= 8;
  };

  const drawListSection = (title: string, items: string[], color: ReturnType<typeof rgb>) => {
    if (!items.length) return;
    const sectionLabel = "Composição do pacote";
    const drawTitle = (continuation = false) => {
      ensureColumnSpace(34, sectionLabel);
      const x = xForColumn();
      page.drawRectangle({ x, y: y - 23, width: columnWidth, height: 23, color: LIGHT_BLUE, borderColor: rgb(0.68, 0.79, 0.96), borderWidth: 0.5 });
      page.drawText(pdfText(`${title}${continuation ? " - CONTINUAÇÃO" : ""}`.toUpperCase()), { x: x + 9, y: y - 15, font: bold, size: 7.6, color: NAVY });
      y -= 33;
    };
    drawTitle();
    items.forEach((item) => {
      const layout = bulletLayout(item);
      if (y - layout.height < 72) {
        nextColumn(sectionLabel);
        drawTitle(true);
      }
      drawBullet(item, color, sectionLabel);
    });
    y -= 10;
  };

  addPage("Plano técnico de manutenção preventiva");
  const planTitle = plan.title || "Plano de manutenção preventiva";
  const titleLines = wrap(planTitle, bold, 17, contentWidth);
  drawLines(page, titleLines, { x: MARGIN, y: y, font: bold, size: 17, color: NAVY, lineHeight: 20 });
  y -= titleLines.length * 20 + 14;

  const disciplines = (plan.disciplineIds || []).map((id) => preventiveDisciplineLabels[id] || id);
  const summaryCards = [
    ["COBERTURA", disciplines.length ? `${disciplines.length} disciplina(s)` : "Plano personalizado"],
    ["PERIODICIDADE", `${frequencyLabel(plan.frequency)} - ${plan.visitsPerYear || 0} visita(s)/ano`],
    ["MOBILIZAÇÃO", `${plan.durationHours || 0}h por visita - ${plan.technicians || 0} técnico(s)`],
    ["ATENDIMENTO", `SLA de ${plan.slaHours || 0}h - início ${plan.startDate ? date(`${plan.startDate}T12:00:00`) : "a definir"}`],
  ];
  const cardGap = 8;
  const cardWidth = (contentWidth - cardGap * 3) / 4;
  summaryCards.forEach(([label, value], index) => {
    const x = MARGIN + index * (cardWidth + cardGap);
    page.drawRectangle({ x, y: y - 52, width: cardWidth, height: 52, color: index === 0 ? NAVY : rgb(0.97, 0.98, 1), borderColor: index === 0 ? NAVY : BORDER, borderWidth: 0.6 });
    page.drawText(label, { x: x + 9, y: y - 16, font: bold, size: 6.2, color: index === 0 ? rgb(0.62, 0.79, 1) : BLUE });
    drawLines(page, wrap(value, index === 0 ? bold : regular, 7.4, cardWidth - 18), { x: x + 9, y: y - 33, font: index === 0 ? bold : regular, size: 7.4, color: index === 0 ? rgb(1, 1, 1) : TEXT, lineHeight: 9, maxLines: 2 });
  });
  y -= 70;
  page.drawText(pdfText(`ESCOPO TÉCNICO DETALHADO - ${plan.scope?.length || 0} ATIVIDADES`), { x: MARGIN, y, font: bold, size: 9, color: BLUE });
  y -= 18;
  page.drawRectangle({ x: MARGIN, y, width: contentWidth, height: 1, color: BORDER });
  y -= 15;
  columnTop = y;

  const scopeGroups = (plan.scope || []).reduce<Record<string, string[]>>((groups, item) => {
    const label = item.label?.trim();
    if (!label) return groups;
    const group = item.group?.trim() || "Escopo geral";
    groups[group] = [...(groups[group] || []), label];
    return groups;
  }, {});
  const scopeEntries = Object.entries(scopeGroups);
  let finalPageBalanceTarget: number | null = null;
  scopeEntries.forEach(([group, items], index) => {
    const groupHeight = groupHeightOf(items);
    const remainingHeight = scopeEntries.slice(index).reduce((sum, [, groupItems]) => sum + groupHeightOf(groupItems), 0);
    if (column === 1 && y - Math.min(groupHeight, 610) < 72 && remainingHeight <= (730 - 72) * 2) {
      addPage("Escopo técnico detalhado");
      finalPageBalanceTarget = remainingHeight / 2;
    }
    if (
      finalPageBalanceTarget
      && column === 0
      && y < columnTop
      && columnTop - y + groupHeight > finalPageBalanceTarget
    ) {
      nextColumn("Escopo técnico detalhado");
    }
    drawGroup(group, items);
  });

  addPage("Composição do pacote");
  page.drawText("ENTREGAS, LIMITES E RESPONSABILIDADES", { x: MARGIN, y, font: bold, size: 15, color: NAVY });
  y -= 19;
  page.drawText("Leitura objetiva do que será entregue, do que está incluído e do que depende de contratação complementar.", { x: MARGIN, y, font: regular, size: 8.5, color: MUTED });
  y -= 25;
  page.drawRectangle({ x: MARGIN, y, width: contentWidth, height: 1, color: BORDER });
  y -= 16;
  columnTop = y;
  drawListSection("Entregas ao cliente", plan.deliverables || [], TEXT);
  drawListSection("Incluso no pacote", plan.inclusions || [], GREEN);
  drawListSection("Não incluso / contratação à parte", plan.exclusions || [], rgb(0.72, 0.2, 0.14));
  if (plan.equipments?.length) {
    drawListSection(
      `Ativos inicialmente vinculados - ${plan.equipments.length}`,
      plan.equipments.map((equipment) => [equipment.tag || equipment.type, equipment.brand, equipment.model, equipment.location].filter(Boolean).join(" - ")),
      TEXT,
    );
  }

  document.getPages().slice(firstTechnicalPageIndex).forEach((technicalPage) => {
    technicalPage.drawRectangle({ x: 0, y: 753, width: A4_WIDTH, height: A4_HEIGHT - 753, color: rgb(1, 1, 1) });
    technicalPage.drawText("CADERNO TÉCNICO", { x: MARGIN, y: 796, font: bold, size: 7.2, color: BLUE });
    technicalPage.drawText(pdfText(quote.code), { x: MARGIN, y: 773, font: bold, size: 15, color: NAVY });
    technicalPage.drawText(brand, { x: A4_WIDTH - MARGIN - bold.widthOfTextAtSize(brand, 8.5), y: 779, font: bold, size: 8.5, color: NAVY });
    technicalPage.drawRectangle({ x: MARGIN, y: 755, width: contentWidth, height: 2, color: BLUE });
    technicalPage.drawRectangle({ x: 0, y: 0, width: A4_WIDTH, height: 60, color: rgb(1, 1, 1) });
    technicalPage.drawRectangle({ x: MARGIN, y: 53, width: contentWidth, height: 1, color: BORDER });
    technicalPage.drawText(pdfText(`${quote.code} - Anexo técnico integrante da proposta comercial`), { x: MARGIN, y: 37, font: regular, size: 6.4, color: MUTED });
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

  const standardPages: PDFPage[] = [];
  let currentPage = document.addPage([A4_WIDTH, A4_HEIGHT]);
  standardPages.push(currentPage);

  // Cabeçalho empresarial e identificação da proposta.
  const proposalHeaderHeight = 98;
  currentPage.drawRectangle({ x: MARGIN, y: y - proposalHeaderHeight, width: contentWidth, height: proposalHeaderHeight, color: NAVY });
  currentPage.drawRectangle({ x: MARGIN, y: y - 5, width: contentWidth, height: 5, color: BLUE });
  const logoCardX = MARGIN + 16;
  const logoCardY = y - 79;
  const logoCardSize = 58;
  const companyTextX = MARGIN + (logo ? 88 : 18);
  if (logo) {
    currentPage.drawRectangle({
      x: logoCardX,
      y: logoCardY,
      width: logoCardSize,
      height: logoCardSize,
      color: rgb(1, 1, 1),
      borderColor: rgb(0.72, 0.82, 1),
      borderWidth: 0.8,
    });
    const dimensions = logo.scaleToFit(46, 46);
    currentPage.drawImage(logo, {
      x: logoCardX + (logoCardSize - dimensions.width) / 2,
      y: logoCardY + (logoCardSize - dimensions.height) / 2,
      width: dimensions.width,
      height: dimensions.height,
    });
  }
  const proposalPanelWidth = 156;
  const proposalPanelX = A4_WIDTH - MARGIN - proposalPanelWidth - 16;
  const companyTextWidth = proposalPanelX - companyTextX - 18;
  const brand = pdfText((company.tradeName || company.corporateName || "EMPRESA CONTRATANTE").toUpperCase());
  const brandLines = wrap(brand, bold, logo ? 11.5 : 14, companyTextWidth).slice(0, 2);
  drawLines(currentPage, brandLines, {
    x: companyTextX,
    y: y - 25,
    font: bold,
    size: logo ? 11.5 : 14,
    color: rgb(1, 1, 1),
    lineHeight: logo ? 13 : 15,
    maxLines: 2,
  });
  const legalNameY = y - 29 - brandLines.length * (logo ? 13 : 15);
  drawLines(currentPage, wrap(company.corporateName || "Serviços técnicos e manutenção empresarial", regular, 7.1, companyTextWidth), {
    x: companyTextX,
    y: legalNameY,
    font: regular,
    size: 7.1,
    color: rgb(0.78, 0.86, 1),
    lineHeight: 8.5,
    maxLines: 2,
  });
  drawLines(currentPage, wrap([company.cnpj && `CNPJ ${company.cnpj}`, company.phone, company.email].filter(Boolean).join("  |  "), regular, 6.4, companyTextWidth), {
    x: companyTextX,
    y: y - 78,
    font: regular,
    size: 6.4,
    color: rgb(0.72, 0.82, 1),
    lineHeight: 7.8,
    maxLines: 2,
  });
  currentPage.drawRectangle({ x: proposalPanelX, y: y - 78, width: proposalPanelWidth, height: 58, color: rgb(0.08, 0.18, 0.43), borderColor: rgb(0.25, 0.45, 0.86), borderWidth: 0.8 });
  currentPage.drawText("PROPOSTA COMERCIAL", { x: proposalPanelX + 14, y: y - 36, font: bold, size: 6.8, color: rgb(0.73, 0.83, 1) });
  currentPage.drawText(pdfText(quote.code), { x: proposalPanelX + 14, y: y - 54, font: bold, size: 14, color: rgb(1, 1, 1) });
  currentPage.drawText(pdfText(`Versao ${quote.version || 1}  |  Emissao ${date(quote.createdAt)}`), { x: proposalPanelX + 14, y: y - 69, font: regular, size: 6.2, color: rgb(0.73, 0.83, 1) });
  y -= 116;

  const boxGap = 10;
  const boxWidth = (contentWidth - boxGap) / 2;
  const detailsBoxHeight = 118;
  currentPage.drawRectangle({ x: MARGIN, y: y - detailsBoxHeight, width: boxWidth, height: detailsBoxHeight, color: rgb(0.985, 0.99, 1), borderColor: BORDER, borderWidth: 0.8 });
  currentPage.drawRectangle({ x: MARGIN + boxWidth + boxGap, y: y - detailsBoxHeight, width: boxWidth, height: detailsBoxHeight, color: rgb(0.985, 0.99, 1), borderColor: BORDER, borderWidth: 0.8 });
  currentPage.drawCircle({ x: MARGIN + 14, y: y - 15, size: 3.2, color: BLUE });
  currentPage.drawText("DADOS DO CLIENTE", { x: MARGIN + 23, y: y - 18, font: bold, size: 7, color: NAVY });
  const clientNameLines = wrap(quote.client.socialName || quote.client.name, bold, 8.5, boxWidth - 28).slice(0, 2);
  drawLines(currentPage, clientNameLines, { x: MARGIN + 14, y: y - 34, font: bold, size: 8.5, color: TEXT, lineHeight: 10.5, maxLines: 2 });
  const clientDetailsOffset = (clientNameLines.length - 1) * 10.5;
  currentPage.drawText(pdfText(`CPF/CNPJ: ${quote.client.cpfCnpj || "Nao informado"}`), { x: MARGIN + 14, y: y - 49 - clientDetailsOffset, font: regular, size: 7, color: MUTED });
  drawLines(currentPage, wrap(addressOf(quote), regular, 6.8, boxWidth - 28), { x: MARGIN + 14, y: y - 63 - clientDetailsOffset, font: regular, size: 6.8, color: MUTED, lineHeight: 8.4, maxLines: 2 });
  const clientCommunication = [quote.client.email, quote.client.phone]
    .filter(Boolean)
    .join("  |  ");
  if (clientCommunication) {
    drawLines(currentPage, wrap(clientCommunication, regular, 6.2, boxWidth - 28), {
      x: MARGIN + 14,
      y: y - 85 - clientDetailsOffset,
      font: regular,
      size: 6.2,
      color: MUTED,
      lineHeight: 7.5,
      maxLines: 1,
    });
  }
  if (quote.contact) {
    const contactText = pdfText(`Contato: ${quote.contact.name}${quote.contact.email ? ` - ${quote.contact.email}` : ""}`);
    drawLines(currentPage, wrap(contactText, regular, 6.2, boxWidth - 28), { x: MARGIN + 14, y: y - 99 - clientDetailsOffset, font: regular, size: 6.2, color: MUTED, lineHeight: 7.5, maxLines: 1 });
  }

  const rightX = MARGIN + boxWidth + boxGap;
  currentPage.drawCircle({ x: rightX + 14, y: y - 15, size: 3.2, color: BLUE });
  currentPage.drawText("DADOS DA PROPOSTA", { x: rightX + 23, y: y - 18, font: bold, size: 7.6, color: NAVY });
  currentPage.drawText(pdfText(`Validade: ${date(quote.validUntil)}`), { x: rightX + 14, y: y - 35, font: bold, size: 7.5, color: TEXT });
  currentPage.drawText(pdfText(`Pagamento: ${quote.paymentTerms || "A combinar"}`), { x: rightX + 14, y: y - 50, font: regular, size: 6.9, color: MUTED });
  currentPage.drawText(pdfText(`Execucao: ${quote.executionTerm || "A combinar"}`), { x: rightX + 14, y: y - 64, font: regular, size: 6.9, color: MUTED });
  currentPage.drawText(pdfText(`Garantia: ${quote.warrantyDays || 90} dias`), { x: rightX + 14, y: y - 78, font: regular, size: 6.9, color: MUTED });
  if (quote.storeName) {
    currentPage.drawText(pdfText(`Unidade: ${quote.storeName}`), { x: rightX + 14, y: y - 92, font: regular, size: 6.8, color: BLUE });
  }
  y -= detailsBoxHeight + 14;

  // Bloco de Licitação / Processo Se Existir
  const hasLicitation = Boolean(
    quote.proposalType === "LICITACAO" ||
    quote.biddingNumber ||
    quote.procurementNumber ||
    quote.contractingAgency ||
    quote.referenceBase
  );
  if (hasLicitation) {
    const licitationHeight = 46;
    currentPage.drawRectangle({ x: MARGIN, y: y - licitationHeight, width: contentWidth, height: licitationHeight, color: LIGHT_BLUE, borderColor: rgb(0.68, 0.79, 0.96), borderWidth: 0.8 });
    currentPage.drawText("DADOS DO EDITAL E PROCESSO LICITATÓRIO", { x: MARGIN + 12, y: y - 14, font: bold, size: 6.8, color: BLUE });
    const licitationInfo = [
      quote.biddingNumber && `Modalidade/Nº: ${quote.biddingNumber}`,
      quote.procurementNumber && `Processo: ${quote.procurementNumber}`,
      quote.contractingAgency && `Órgão: ${quote.contractingAgency}`,
      quote.referenceBase && `Base: ${quote.referenceBase} ${quote.referenceMonth ? `(${quote.referenceMonth})` : ""}`,
      quote.deliveryTerm && `Prazo Edital: ${quote.deliveryTerm}`,
    ].filter(Boolean).join("  |  ");
    drawLines(currentPage, wrap(licitationInfo, regular, 6.6, contentWidth - 24), { x: MARGIN + 12, y: y - 30, font: regular, size: 6.6, color: TEXT, lineHeight: 8.5, maxLines: 2 });
    y -= licitationHeight + 12;
  }

  currentPage.drawText("OBJETO DA PROPOSTA", { x: MARGIN, y, font: bold, size: 8, color: NAVY });
  y -= 14;
  drawLines(currentPage, wrap(quote.notes || "Fornecimento de materiais e execucao dos servicos descritos abaixo, conforme condicoes desta proposta.", regular, 7.4, contentWidth), { x: MARGIN, y, font: regular, size: 7.4, color: MUTED, lineHeight: 9.5, maxLines: 3 });
  y -= 26;

  const headerHeight = 22;
  const columns = [MARGIN + 10, MARGIN + 40, MARGIN + 310, MARGIN + 360, MARGIN + 405, MARGIN + 468];
  const descriptionWidth = 260;

  const drawTableHeader = (p: PDFPage, topY: number) => {
    p.drawRectangle({ x: MARGIN, y: topY - headerHeight, width: contentWidth, height: headerHeight, color: NAVY });
    ["ITEM", "DESCRICAO DOS SERVICOS / MATERIAIS", "QTDE", "UNID", "VALOR UNIT.", "VALOR TOTAL"].forEach((label, index) => {
      p.drawText(label, { x: columns[index], y: topY - 14, font: bold, size: index === 1 ? 6.6 : 6.1, color: rgb(1, 1, 1) });
    });
  };

  drawTableHeader(currentPage, y);
  y -= headerHeight;

  const fontItemSize = 7.5;
  const fontItemLineHeight = 9.2;

  quote.items.forEach((item, index) => {
    const wrappedLines = wrap(item.description, regular, fontItemSize, descriptionWidth);
    const rowHeight = Math.max(22, wrappedLines.length * fontItemLineHeight + 8);

    // Se o item não couber na página atual, abre nova página
    if (y - rowHeight < 75) {
      currentPage = document.addPage([A4_WIDTH, A4_HEIGHT]);
      standardPages.push(currentPage);
      y = A4_HEIGHT - MARGIN;

      // Cabeçalho de continuação
      currentPage.drawRectangle({ x: MARGIN, y: y - 24, width: contentWidth, height: 24, color: LIGHT_BLUE, borderColor: BORDER, borderWidth: 0.5 });
      currentPage.drawText(pdfText(`PROPOSTA COMERCIAL ${quote.code} - CONTINUAÇÃO`), { x: MARGIN + 12, y: y - 16, font: bold, size: 7.5, color: NAVY });
      currentPage.drawText(pdfText(company.tradeName || company.corporateName || ""), { x: A4_WIDTH - MARGIN - 12 - regular.widthOfTextAtSize(pdfText(company.tradeName || company.corporateName || ""), 7), y: y - 16, font: regular, size: 7, color: MUTED });
      y -= 34;

      drawTableHeader(currentPage, y);
      y -= headerHeight;
    }

    currentPage.drawRectangle({
      x: MARGIN,
      y: y - rowHeight,
      width: contentWidth,
      height: rowHeight,
      color: index % 2 ? rgb(0.985, 0.988, 0.995) : rgb(1, 1, 1),
      borderColor: BORDER,
      borderWidth: 0.45,
    });
    const textY = y - 13;
    currentPage.drawText(String(index + 1), { x: columns[0] + 4, y: textY, font: regular, size: fontItemSize, color: MUTED });
    drawLines(currentPage, wrappedLines, { x: columns[1], y: textY, font: regular, size: fontItemSize, color: TEXT, lineHeight: fontItemLineHeight });
    currentPage.drawText(pdfText(item.quantity), { x: columns[2] + 5, y: textY, font: regular, size: fontItemSize, color: TEXT });
    currentPage.drawText(pdfText(item.unit), { x: columns[3] + 4, y: textY, font: regular, size: fontItemSize, color: TEXT });
    currentPage.drawText(money(item.unitPrice), { x: columns[4], y: textY, font: regular, size: fontItemSize - 0.3, color: TEXT });
    currentPage.drawText(money(item.total), { x: columns[5], y: textY, font: bold, size: fontItemSize - 0.3, color: TEXT });
    y -= rowHeight;
  });

  y -= 12;

  // Verifica se o bloco de resumo financeiro e aceite cabe na página atual
  const summaryBlockHeight = 150;
  if (y - summaryBlockHeight < 65) {
    currentPage = document.addPage([A4_WIDTH, A4_HEIGHT]);
    standardPages.push(currentPage);
    y = A4_HEIGHT - MARGIN;

    currentPage.drawRectangle({ x: MARGIN, y: y - 24, width: contentWidth, height: 24, color: LIGHT_BLUE, borderColor: BORDER, borderWidth: 0.5 });
    currentPage.drawText(pdfText(`PROPOSTA COMERCIAL ${quote.code} - RESUMO E CONDIÇÕES`), { x: MARGIN + 12, y: y - 16, font: bold, size: 7.5, color: NAVY });
    y -= 38;
  }

  const totalBoxWidth = 210;
  const totalBoxX = A4_WIDTH - MARGIN - totalBoxWidth;
  const hasOverride = Boolean(quote.finalValueOverride && quote.finalValueOverride !== quote.total);
  const totalBoxHeight = preventivePlan ? 96 : (hasOverride ? 88 : 74);
  currentPage.drawRectangle({ x: totalBoxX, y: y - totalBoxHeight, width: totalBoxWidth, height: totalBoxHeight, color: LIGHT_BLUE, borderColor: rgb(0.68, 0.79, 0.96), borderWidth: 0.8 });

  const totalRows: Array<[string, string, boolean]> = [
    ["Subtotal", money(quote.subtotal), false],
    ["Desconto", `- ${money(quote.discount)}`, false],
    ...(preventivePlan ? [["Base após desconto", money(Math.max(0, quote.subtotal - quote.discount)), false] as [string, string, boolean]] : []),
    ["Impostos / acrescimos", money(quote.tax), false],
    ...(hasOverride ? [["Valor Negociado Fechado", money(quote.finalValueOverride!), true] as [string, string, boolean]] : []),
    ["TOTAL DA PROPOSTA", money(quote.total), true],
  ];
  totalRows.forEach(([label, value, strong], index) => {
    const lineY = y - 14 - index * (preventivePlan ? 14 : 14.5);
    currentPage.drawText(label, { x: totalBoxX + 10, y: lineY, font: strong ? bold : regular, size: strong ? 8.2 : 6.8, color: strong ? NAVY : MUTED });
    const valueFont = strong ? bold : regular;
    const valueSize = strong ? 10.5 : 6.8;
    currentPage.drawText(value, { x: totalBoxX + totalBoxWidth - 10 - valueFont.widthOfTextAtSize(value, valueSize), y: lineY, font: valueFont, size: valueSize, color: strong ? GREEN : TEXT });
  });

  currentPage.drawText("ACEITE DA PROPOSTA", { x: MARGIN, y: y - 14, font: bold, size: 7.6, color: NAVY });
  currentPage.drawText("Nome: __________________________________________", { x: MARGIN, y: y - 34, font: regular, size: 7, color: MUTED });
  currentPage.drawText("Data: ____/____/________    Assinatura: ____________________", { x: MARGIN, y: y - 51, font: regular, size: 7, color: MUTED });

  // Rodapé e Numeração de Páginas em todas as folhas da proposta padrão
  standardPages.forEach((p, pageIdx) => {
    p.drawRectangle({ x: MARGIN, y: 28, width: contentWidth, height: 25, color: NAVY });
    p.drawText(pdfText(company.tradeName || "O PRESTADOR"), { x: MARGIN + 12, y: 37, font: bold, size: 6.5, color: rgb(1, 1, 1) });
    const footerPageText = pdfText(`${quote.code} - Página ${pageIdx + 1} de ${standardPages.length}`);
    p.drawText(footerPageText, { x: A4_WIDTH - MARGIN - 12 - regular.widthOfTextAtSize(footerPageText, 6.2), y: 37, font: regular, size: 6.2, color: rgb(0.72, 0.82, 1) });
  });

  if (preventivePlan) {
    drawPreventiveTechnicalAppendix({ document, quote, company, plan: preventivePlan, regular, bold });
    addPreventivePageNumbers(document, regular);
  }

  return document.save({ useObjectStreams: false });
}
