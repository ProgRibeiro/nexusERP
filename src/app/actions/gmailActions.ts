"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { requireAuth, requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createProposalMimeMessage,
  gmailOAuthConfig,
  revokeGoogleToken,
  sendGmailRawMessage,
} from "@/lib/gmail";
import { logger } from "@/lib/logger";
import { buildQuotePdf, type QuotePdfCompanyProfile } from "@/lib/quotePdf";

const SIMPLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function parseCc(value?: string | null) {
  if (!value?.trim()) return [];
  const emails = [...new Set(value.split(/[;,]/).map(normalizeEmail).filter(Boolean))];
  if (emails.length > 10) throw new Error("Informe no máximo 10 endereços em cópia.");
  if (emails.some((email) => !SIMPLE_EMAIL.test(email))) throw new Error("Existe um endereço de cópia inválido.");
  return emails;
}

function errorMessage(error: unknown) {
  return (error instanceof Error ? error.message : "Falha desconhecida no envio.").slice(0, 500);
}

export async function getGmailIntegrationSettings() {
  try {
    await requirePermission("admin.all");
    const [integration, sentCount] = await Promise.all([
      prisma.emailIntegration.findUnique({
        where: { provider: "GMAIL" },
        select: {
          id: true,
          email: true,
          displayName: true,
          active: true,
          lastError: true,
          updatedAt: true,
          tokenExpiresAt: true,
        },
      }),
      prisma.proposalEmail.count({ where: { status: "ENVIADO" } }),
    ]);
    const oauth = gmailOAuthConfig();
    return {
      success: true as const,
      configured: oauth.configured,
      connected: Boolean(integration?.active),
      redirectUri: oauth.redirectUri,
      integration,
      sentCount,
      requiredVariables: [
        "APP_BASE_URL",
        "INTEGRATION_ENCRYPTION_KEY",
        "GOOGLE_GMAIL_CLIENT_ID",
        "GOOGLE_GMAIL_CLIENT_SECRET",
      ],
    };
  } catch (error) {
    logger.error("Erro ao carregar configurações da integração Gmail:", error);
    return { success: false as const, error: errorMessage(error) };
  }
}

export async function getGmailProposalContext(quoteId: string) {
  try {
    const session = await requireAuth();
    const [quote, integration, deliveries] = await Promise.all([
      prisma.quote.findUnique({
        where: { id: quoteId },
        include: { client: true, contact: true },
      }),
      prisma.emailIntegration.findUnique({
        where: { provider: "GMAIL" },
        select: { id: true, email: true, displayName: true, active: true, lastError: true, updatedAt: true },
      }),
      prisma.proposalEmail.findMany({
        where: { quoteId },
        include: { sentBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
    ]);
    if (!quote) throw new Error("Proposta não encontrada.");
    const oauthConfig = gmailOAuthConfig();
    const recipient = quote.contact?.email || quote.client.email || "";
    const clientName = quote.client.fancyName || quote.client.name;
    return {
      success: true as const,
      configured: oauthConfig.configured,
      redirectUri: oauthConfig.redirectUri,
      connected: Boolean(integration?.active),
      integration,
      canManageConnection: session.roleName === "Administrador" || session.permissions.includes("admin.all"),
      defaults: {
        recipient,
        cc: "",
        subject: `Proposta comercial ${quote.code} - ${clientName}`,
        body: `Olá, ${clientName}.\n\nSegue em anexo a proposta comercial ${quote.code}, preparada conforme o serviço solicitado.\n\nFicamos à disposição para esclarecer qualquer dúvida e realizar os ajustes necessários.\n\nAtenciosamente,\nEquipe Nexus`,
      },
      deliveries: deliveries.map((delivery) => ({
        id: delivery.id,
        senderEmail: delivery.senderEmail,
        recipientEmail: delivery.recipientEmail,
        ccEmails: delivery.ccEmails,
        subject: delivery.subject,
        status: delivery.status,
        errorMessage: delivery.errorMessage,
        sentAt: delivery.sentAt,
        createdAt: delivery.createdAt,
        sentByName: delivery.sentBy.name,
      })),
    };
  } catch (error) {
    logger.error("Erro ao carregar contexto Gmail da proposta:", error);
    return { success: false as const, error: errorMessage(error) };
  }
}

export async function sendQuoteByGmail(input: {
  quoteId: string;
  recipient: string;
  cc?: string;
  subject: string;
  body: string;
  company?: QuotePdfCompanyProfile;
}) {
  let deliveryId: string | null = null;
  let integrationId: string | null = null;
  try {
    const session = await requirePermission("quotes.write");
    const recipient = normalizeEmail(input.recipient);
    const ccEmails = parseCc(input.cc);
    const subject = input.subject.replace(/[\r\n]+/g, " ").trim();
    const body = input.body.trim();
    if (!SIMPLE_EMAIL.test(recipient)) throw new Error("Informe um e-mail válido para o cliente.");
    if (!subject || subject.length > 180) throw new Error("O assunto deve ter entre 1 e 180 caracteres.");
    if (!body || body.length > 10_000) throw new Error("A mensagem deve ter entre 1 e 10.000 caracteres.");

    const [quote, integration] = await Promise.all([
      prisma.quote.findUnique({
        where: { id: input.quoteId },
        include: { client: { include: { addresses: true } }, contact: true, items: true },
      }),
      prisma.emailIntegration.findUnique({ where: { provider: "GMAIL" } }),
    ]);
    if (!quote) throw new Error("Proposta não encontrada.");
    if (!integration?.active) throw new Error("Conecte uma conta Gmail antes de enviar a proposta.");
    integrationId = integration.id;

    const recentDuplicate = await prisma.proposalEmail.findFirst({
      where: {
        quoteId: quote.id,
        recipientEmail: recipient,
        status: { in: ["PREPARANDO", "ENVIANDO", "ENVIADO"] },
        createdAt: { gte: new Date(Date.now() - 60_000) },
      },
    });
    if (recentDuplicate) throw new Error("Esta proposta já foi enviada ou está sendo processada. Aguarde um minuto antes de reenviar.");

    const attachmentName = `Proposta-${quote.code.replace(/[^a-zA-Z0-9_-]/g, "-")}.pdf`;
    const delivery = await prisma.proposalEmail.create({
      data: {
        quoteId: quote.id,
        integrationId: integration.id,
        senderEmail: integration.email,
        recipientEmail: recipient,
        ccEmails: ccEmails.length ? ccEmails.join(", ") : null,
        subject,
        body,
        attachmentName,
        status: "PREPARANDO",
        sentById: session.userId,
      },
    });
    deliveryId = delivery.id;

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
      preventivePlanJson: quote.preventivePlanJson,
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
      contact: quote.contact ? {
        name: quote.contact.name,
        email: quote.contact.email,
        phone: quote.contact.phone,
      } : null,
      items: quote.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
      })),
    }, input.company || {});
    const attachmentSha256 = crypto.createHash("sha256").update(pdf).digest("hex");
    const raw = createProposalMimeMessage({
      senderEmail: integration.email,
      senderName: integration.displayName || input.company?.tradeName || input.company?.corporateName,
      recipientEmail: recipient,
      ccEmails: ccEmails.length ? ccEmails.join(", ") : null,
      subject,
      body,
      attachmentName,
      attachment: pdf,
    });
    await prisma.proposalEmail.update({ where: { id: delivery.id }, data: { status: "ENVIANDO", attachmentSha256 } });
    const sent = await sendGmailRawMessage(integration, raw);
    const sentAt = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.proposalEmail.update({
        where: { id: delivery.id },
        data: {
          status: "ENVIADO",
          gmailMessageId: sent.id,
          gmailThreadId: sent.threadId,
          sentAt,
          errorMessage: null,
        },
      });
      if (["RASCUNHO", "PENDENTE"].includes(quote.status.toUpperCase())) {
        await tx.quote.update({ where: { id: quote.id }, data: { status: "ENVIADO" } });
      }
      await tx.emailIntegration.update({ where: { id: integration.id }, data: { lastError: null } });
      await tx.auditLog.create({
        data: {
          userId: session.userId,
          action: "PROPOSTA_ENVIADA_GMAIL",
          entity: "Quote",
          entityId: quote.id,
          changesJson: JSON.stringify({
            deliveryId: delivery.id,
            recipient,
            ccEmails,
            gmailMessageId: sent.id,
            attachmentName,
            attachmentSha256,
          }),
        },
      });
    });

    revalidatePath("/orcamentos");
    return { success: true as const, deliveryId: delivery.id, sentAt, messageId: sent.id };
  } catch (error) {
    const message = errorMessage(error);
    if (deliveryId) {
      await prisma.proposalEmail.update({ where: { id: deliveryId }, data: { status: "FALHA", errorMessage: message } }).catch(() => undefined);
    }
    if (integrationId) {
      await prisma.emailIntegration.update({ where: { id: integrationId }, data: { lastError: message } }).catch(() => undefined);
    }
    logger.error("Erro ao enviar proposta pelo Gmail:", error);
    return { success: false as const, error: message };
  }
}

export async function disconnectGmail() {
  try {
    const session = await requirePermission("admin.all");
    const integration = await prisma.emailIntegration.findUnique({ where: { provider: "GMAIL" } });
    if (!integration) return { success: true as const };
    await revokeGoogleToken(integration);
    await prisma.$transaction(async (tx) => {
      await tx.emailIntegration.delete({ where: { id: integration.id } });
      await tx.auditLog.create({
        data: {
          userId: session.userId,
          action: "INTEGRACAO_DESCONECTADA",
          entity: "EmailIntegration",
          entityId: integration.id,
          changesJson: JSON.stringify({ provider: "GMAIL", email: integration.email }),
        },
      });
    });
    revalidatePath("/orcamentos");
    return { success: true as const };
  } catch (error) {
    logger.error("Erro ao desconectar Gmail:", error);
    return { success: false as const, error: errorMessage(error) };
  }
}
