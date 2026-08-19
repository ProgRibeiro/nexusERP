/**
 * Gerador de Relatórios Técnicos de Execução A4 Executivos em Papel Branco Nítido.
 * Suporta múltiplos modelos selecionáveis:
 * 1. SEM_VALORES: Relatório operacional de campo sem exibição de preços R$.
 * 2. FOTOGRAFICO_EXPRESS: Relatório focado em fotos e evidências de campo.
 * 3. COMERCIAL_COMPLETO: Dossiê técnico e comercial completo com valores R$.
 */

export type ReportModelType = "SEM_VALORES" | "FOTOGRAFICO_EXPRESS" | "COMERCIAL_COMPLETO";

export interface PrintReportParams {
  modelType?: ReportModelType;
  company: {
    corporateName: string;
    cnpj: string;
    stateRegistration?: string | null;
    municipalRegistration?: string | null;
    email: string;
    phone: string;
    logoUrl?: string | null;
  };
  details: any;
  reportForm: {
    executedServices: string;
    technicalObservations: string;
    operationalResult: string;
    warrantyTerms?: string;
    clientRepresentative?: string;
    approvedByClient?: boolean;
  };
  checklist?: Array<{ id?: string; label: string; group?: string; checked: boolean; modality?: string }>;
}

export function printExecutiveReport({
  modelType = "SEM_VALORES",
  company,
  details,
  reportForm,
  checklist = [],
}: PrintReportParams): Promise<void> {
  return new Promise((resolve) => {
    const codeStr = details.code || details.id.slice(-6);
    const clientName = details.client?.socialName || details.client?.name || "Cliente não informado";
    const clientDoc = details.client?.cpfCnpj || "Não informado";
    const addressStr = details.address
      ? `${details.address.street}, ${details.address.number}${
          details.address.complement ? ` - ${details.address.complement}` : ""
        } · ${details.address.neighborhood || ""} · ${details.address.city}/${details.address.state} (CEP: ${details.address.cep})`
      : "Endereço principal da empresa";

    const resultLabels: Record<string, string> = {
      OPERACIONAL: "OPERACIONAL / CONCLUÍDO",
      OPERACIONAL_COM_RESSALVAS: "OPERACIONAL COM RESSALVAS",
      PENDENTE: "SERVIÇO PENDENTE",
      NAO_TESTADO: "NÃO TESTADO",
    };
    const resultText = resultLabels[reportForm.operationalResult] || "OPERACIONAL";

    const techNames = details.technicians
      ?.map((t: any) => t.user?.name || t.name || t.technician?.name)
      .filter(Boolean)
      .join(", ") || "Técnico Responsável";

    const dateFormatted = new Date().toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const items = details.items || [];
    const materials = (details.materials || []).filter((m: any) => m.status === "UTILIZADO" || m.usedQuantity > 0);
    const photos = details.photos || [];
    const completedChecklist = checklist.filter((item) => item.checked);

    const isShowValues = modelType === "COMERCIAL_COMPLETO";
    const isPhotoExpress = modelType === "FOTOGRAFICO_EXPRESS";

    const documentSubTitle =
      modelType === "FOTOGRAFICO_EXPRESS"
        ? "Relatório Fotográfico de Evidências de Atendimento Operacional"
        : modelType === "SEM_VALORES"
        ? "Relatório Técnico de Execução de Serviços de Campo (Sem Valores Comercial)"
        : "Dossiê Técnico e Comercial Completo de Atendimento";

    const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Relatório OS #${codeStr} (${modelType})</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm 10mm 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #ffffff !important;
      color: #09090b !important;
      margin: 0;
      padding: 0;
      font-size: 11px;
      line-height: 1.45;
      color-scheme: light !important;
    }
    
    /* Header Executivo */
    .header-box {
      border: 2px solid #18181b;
      background: #18181b;
      color: #ffffff;
      padding: 16px 20px;
      border-radius: 10px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 14px;
    }
    .header-left {
      max-width: 65%;
    }
    .header-tag {
      font-size: 8px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      color: #38bdf8;
    }
    .header-company {
      font-size: 17px;
      font-weight: 900;
      text-transform: uppercase;
      margin: 3px 0 3px 0;
      letter-spacing: -0.01em;
    }
    .header-meta {
      font-size: 9px;
      color: #d4d4d8;
      line-height: 1.35;
    }
    .header-right {
      text-align: right;
    }
    .os-code {
      font-size: 20px;
      font-weight: 900;
      color: #ffffff;
      display: block;
    }
    .os-badge {
      display: inline-block;
      background: #d4af37;
      color: #000000;
      font-weight: 900;
      font-size: 9px;
      padding: 4px 10px;
      border-radius: 5px;
      text-transform: uppercase;
      margin-top: 6px;
    }
    
    /* Titulo */
    .doc-title {
      text-align: center;
      background: #f4f4f5;
      border: 1px solid #e4e4e7;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #18181b;
      margin-bottom: 14px;
    }
    
    /* Titulos de Secao */
    .section-header {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #18181b;
      border-bottom: 2px solid #18181b;
      padding-bottom: 4px;
      margin: 16px 0 8px 0;
    }
    
    /* Tabelas */
    .grid-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    .grid-table th, .grid-table td {
      border: 1px solid #e4e4e7;
      padding: 6px 10px;
      font-size: 10px;
      text-align: left;
    }
    .grid-table th {
      background: #f4f4f5;
      font-weight: 800;
      color: #27272a;
      text-transform: uppercase;
      font-size: 8.5px;
      letter-spacing: 0.05em;
    }
    
    /* Blocos Informativos */
    .text-block {
      background: #fafafa;
      border: 1px solid #e4e4e7;
      border-radius: 6px;
      padding: 10px 12px;
      font-size: 10.5px;
      color: #18181b;
      white-space: pre-line;
      margin-bottom: 12px;
    }
    
    /* Grade de Fotos */
    .photo-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-top: 8px;
    }
    .photo-card {
      border: 1px solid #e4e4e7;
      border-radius: 8px;
      padding: 8px;
      background: #ffffff;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .photo-img {
      width: 100%;
      height: ${isPhotoExpress ? "210px" : "160px"};
      object-fit: cover;
      border-radius: 6px;
      background: #f4f4f5;
      display: block;
    }
    .photo-tag {
      display: inline-block;
      background: #18181b;
      color: #ffffff;
      font-size: 8px;
      font-weight: 800;
      text-transform: uppercase;
      padding: 2px 6px;
      border-radius: 4px;
      margin-top: 6px;
    }
    .photo-caption {
      font-size: 9.5px;
      color: #3f3f46;
      margin-top: 4px;
      font-weight: 600;
    }
    
    /* Assinaturas */
    .sig-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      margin-top: 32px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .sig-box {
      text-align: center;
    }
    .sig-line {
      border-bottom: 1px solid #71717a;
      margin-bottom: 6px;
      width: 85%;
      margin-left: auto;
      margin-right: auto;
    }
    .sig-img {
      max-height: 48px;
      margin-bottom: 4px;
      object-fit: contain;
    }
    .sig-name {
      font-weight: 800;
      font-size: 10.5px;
      color: #18181b;
    }
    .sig-role {
      font-size: 9px;
      color: #71717a;
    }
  </style>
</head>
<body>
  <!-- Header Executivo -->
  <div class="header-box">
    <div class="header-left">
      <div class="header-tag">Relatório Técnico de Execução</div>
      <div class="header-company">${company.corporateName}</div>
      <div class="header-meta">
        CNPJ: ${company.cnpj} | IE: ${company.stateRegistration || "ISENTO"}<br>
        E-mail: ${company.email} | Telefone: ${company.phone}
      </div>
    </div>
    <div class="header-right">
      <span class="os-code">OS #${codeStr}</span>
      <span class="os-badge">${resultText}</span>
    </div>
  </div>

  <!-- Titulo do Modelo -->
  <div class="doc-title">
    ${documentSubTitle}
  </div>

  <!-- Identificacao do Cliente e Local -->
  <div class="section-header">1. Identificação do Cliente e Local de Atendimento</div>
  <table class="grid-table">
    <tbody>
      <tr>
        <th style="width: 20%;">Razão Social / Cliente:</th>
        <td style="width: 40%;"><strong>${clientName}</strong></td>
        <th style="width: 15%;">CPF / CNPJ:</th>
        <td style="width: 25%;">${clientDoc}</td>
      </tr>
      <tr>
        <th>Local de Execução:</th>
        <td colspan="3">${addressStr}</td>
      </tr>
      <tr>
        <th>Data da Emissão:</th>
        <td>${dateFormatted}</td>
        <th>Técnico(s):</th>
        <td>${techNames}</td>
      </tr>
    </tbody>
  </table>

  <!-- Detalhamento dos Servicos Executados -->
  ${
    !isPhotoExpress
      ? `
  <div class="section-header">2. Resumo dos Serviços Executados e Diagnóstico Técnico</div>
  <div class="text-block">
<strong>Serviços Realizados:</strong>
${reportForm.executedServices || "Serviço executado conforme especificação e escopo aprovado."}

<strong>Parecer e Observações Técnicas:</strong>
${reportForm.technicalObservations || "Equipamento testado e entregue em perfeitas condições operacionais."}
  </div>
  `
      : `
  <div class="section-header">2. Síntese do Atendimento</div>
  <div class="text-block">
<strong>Relatório Fotográfico de Evidências:</strong>
${reportForm.executedServices || "Fotos e evidências de atendimento operacional registradas em campo."}
  </div>
  `
  }

  <!-- Itens e Pecas Faturadas/Utilizadas -->
  ${
    !isPhotoExpress && (items.length > 0 || materials.length > 0)
      ? `
  <div class="section-header">3. Relação de Itens e Materiais Utilizados ${
    isShowValues ? "(Com Valores)" : "(Sem Valores Comercial)"
  }</div>
  <table class="grid-table">
    <thead>
      <tr>
        <th style="width: ${isShowValues ? "45%" : "65%"};">Descrição do Item / Componente</th>
        <th style="width: 15%;">Tipo</th>
        <th style="width: 20%; text-align: center;">Quantidade</th>
        ${isShowValues ? '<th style="width: 20%; text-align: right;">Total (R$)</th>' : ""}
      </tr>
    </thead>
    <tbody>
      ${items
        .map(
          (item: any) => `
        <tr>
          <td>${item.description}</td>
          <td>SERVIÇO</td>
          <td style="text-align: center;">${item.quantity} ${item.unit || "un"}</td>
          ${
            isShowValues
              ? `<td style="text-align: right;">R$ ${(Number(item.total) || 0).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}</td>`
              : ""
          }
        </tr>
      `,
        )
        .join("")}
      ${materials
        .map(
          (mat: any) => `
        <tr>
          <td>${mat.product?.name || "Material de aplicação"}</td>
          <td>MATERIAL</td>
          <td style="text-align: center;">${mat.usedQuantity} un</td>
          ${
            isShowValues
              ? `<td style="text-align: right;">R$ ${(mat.usedQuantity * Number(mat.salePrice || 0)).toLocaleString(
                  "pt-BR",
                  { minimumFractionDigits: 2 },
                )}</td>`
              : ""
          }
        </tr>
      `,
        )
        .join("")}
    </tbody>
  </table>
  `
      : ""
  }

  <!-- Checklist de Inspecao se houver -->
  ${
    !isPhotoExpress && completedChecklist.length > 0
      ? `
  <div class="section-header">4. Itens de Inspeção e Checklist Concluído</div>
  <table class="grid-table">
    <thead>
      <tr>
        <th style="width: 70%;">Item de Verificação / Checklist</th>
        <th style="width: 30%; text-align: center;">Resultado</th>
      </tr>
    </thead>
    <tbody>
      ${completedChecklist
        .map(
          (chk) => `
        <tr>
          <td>${chk.group ? `[${chk.group}] ` : ""}${chk.label}</td>
          <td style="text-align: center; font-weight: bold; color: #16a34a;">✔ CONFORME</td>
        </tr>
      `,
        )
        .join("")}
    </tbody>
  </table>
  `
      : ""
  }

  <!-- Registro Fotografico -->
  ${
    photos.length > 0
      ? `
  ${!isPhotoExpress ? '<div style="page-break-before: always;"></div>' : ""}
  <div class="section-header">${isPhotoExpress ? "3" : "5"}. Registro Fotográfico de Evidências no Local</div>
  <div class="photo-grid">
    ${photos
      .map(
        (photo: any) => `
      <div class="photo-card">
        <img src="${photo.url}" alt="${photo.caption || "Evidência"}" class="photo-img" />
        <div>
          <span class="photo-tag">${photo.step || "EVIDÊNCIA"}</span>
          <div class="photo-caption">${photo.caption || "Sem observações detalhadas."}</div>
        </div>
      </div>
    `,
      )
      .join("")}
  </div>
  `
      : ""
  }

  <!-- Termos de Aceite e Assinaturas -->
  <div class="sig-container">
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-name">Assinatura do Técnico Responsável</div>
      <div class="sig-role">${techNames}</div>
    </div>
    <div class="sig-box">
      ${
        details.signatureBase64
          ? `<img src="${details.signatureBase64}" alt="Assinatura" class="sig-img" /><br>`
          : `<div style="height: 36px;"></div>`
      }
      <div class="sig-line"></div>
      <div class="sig-name">Assinatura do Cliente / Aceite de Serviço</div>
      <div class="sig-role">${
        reportForm.clientRepresentative || details.signatureName || clientName
      }</div>
    </div>
  </div>
</body>
</html>`;

    // Cria iframe invisivel e executa a impressao
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      resolve();
      return;
    }

    doc.open();
    doc.write(htmlContent);
    doc.close();

    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.error("Erro ao imprimir via iframe:", e);
        } finally {
          setTimeout(() => {
            document.body.removeChild(iframe);
            resolve();
          }, 1000);
        }
      }, 300);
    };
  });
}
