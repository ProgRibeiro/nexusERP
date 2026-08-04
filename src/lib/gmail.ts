import crypto from "crypto";
import type { EmailIntegration } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/secretBox";

export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
export const GMAIL_OAUTH_SCOPES = ["openid", "email", GMAIL_SEND_SCOPE];

export function gmailOAuthConfig(requestOrigin?: string) {
  const clientId = process.env.GOOGLE_GMAIL_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_GMAIL_CLIENT_SECRET?.trim();
  const baseUrl = (process.env.APP_BASE_URL?.trim() || requestOrigin || "http://localhost:3000").replace(/\/$/, "");
  return {
    clientId,
    clientSecret,
    baseUrl,
    redirectUri: `${baseUrl}/api/integrations/gmail/callback`,
    configured: Boolean(clientId && clientSecret),
  };
}

export function buildGmailAuthorizationUrl(input: { state: string; requestOrigin?: string; loginHint?: string }) {
  const config = gmailOAuthConfig(input.requestOrigin);
  if (!config.configured || !config.clientId) throw new Error("Credenciais OAuth do Gmail ainda não foram configuradas.");
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: GMAIL_OAUTH_SCOPES.join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state: input.state,
  });
  if (input.loginHint) params.set("login_hint", input.loginHint);
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

async function tokenRequest(params: URLSearchParams) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
    cache: "no-store",
  });
  const payload = await response.json() as GoogleTokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || "O Google não devolveu um token de acesso.");
  }
  return payload;
}

export async function exchangeGmailAuthorizationCode(code: string, requestOrigin?: string) {
  const config = gmailOAuthConfig(requestOrigin);
  if (!config.clientId || !config.clientSecret) throw new Error("Credenciais OAuth do Gmail ainda não foram configuradas.");
  return tokenRequest(new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
  }));
}

export async function getGoogleUserInfo(accessToken: string) {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const payload = await response.json() as { email?: string; name?: string; error?: string };
  if (!response.ok || !payload.email) throw new Error(payload.error || "Não foi possível identificar a conta Google conectada.");
  return { email: payload.email, name: payload.name || null };
}

async function refreshGmailAccessToken(integration: EmailIntegration) {
  if (!integration.refreshTokenEncrypted) throw new Error("A conexão Gmail não possui token de renovação. Reconecte a conta.");
  const config = gmailOAuthConfig();
  if (!config.clientId || !config.clientSecret) throw new Error("Credenciais OAuth do Gmail não configuradas.");
  const payload = await tokenRequest(new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: decryptSecret(integration.refreshTokenEncrypted),
    grant_type: "refresh_token",
  }));
  const expiresAt = new Date(Date.now() + Math.max(60, payload.expires_in || 3600) * 1000);
  await prisma.emailIntegration.update({
    where: { id: integration.id },
    data: {
      accessTokenEncrypted: encryptSecret(payload.access_token!),
      tokenExpiresAt: expiresAt,
      scope: payload.scope || integration.scope,
      tokenType: payload.token_type || integration.tokenType,
      active: true,
      lastError: null,
    },
  });
  return payload.access_token!;
}

export async function getValidGmailAccessToken(integration: EmailIntegration, forceRefresh = false) {
  const stillValid = integration.tokenExpiresAt && integration.tokenExpiresAt.getTime() > Date.now() + 60_000;
  if (!forceRefresh && stillValid) return decryptSecret(integration.accessTokenEncrypted);
  return refreshGmailAccessToken(integration);
}

function cleanHeader(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function encodedWord(value: string) {
  return `=?UTF-8?B?${Buffer.from(cleanHeader(value), "utf8").toString("base64")}?=`;
}

function base64Lines(value: Buffer | string) {
  const encoded = Buffer.isBuffer(value) ? value.toString("base64") : Buffer.from(value, "utf8").toString("base64");
  return encoded.match(/.{1,76}/g)?.join("\r\n") || "";
}

export function createProposalMimeMessage(input: {
  senderEmail: string;
  senderName?: string | null;
  recipientEmail: string;
  ccEmails?: string | null;
  subject: string;
  body: string;
  attachmentName: string;
  attachment: Uint8Array;
}) {
  const boundary = `nx_mixed_${crypto.randomBytes(12).toString("hex")}`;
  const attachmentName = cleanHeader(input.attachmentName).replace(/[^a-zA-Z0-9._-]/g, "_");
  const lines = [
    `From: ${input.senderName ? `${encodedWord(input.senderName)} ` : ""}<${cleanHeader(input.senderEmail)}>`,
    `To: ${cleanHeader(input.recipientEmail)}`,
    ...(input.ccEmails ? [`Cc: ${cleanHeader(input.ccEmails)}`] : []),
    `Subject: ${encodedWord(input.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(input.body),
    `--${boundary}`,
    `Content-Type: application/pdf; name="${attachmentName}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${attachmentName}"`,
    "",
    base64Lines(Buffer.from(input.attachment)),
    `--${boundary}--`,
    "",
  ];
  return Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
}

async function gmailSendRequest(accessToken: string, raw: string) {
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
    cache: "no-store",
  });
  const payload = await response.json() as { id?: string; threadId?: string; error?: { message?: string } };
  return { response, payload };
}

export async function sendGmailRawMessage(integration: EmailIntegration, raw: string) {
  let accessToken = await getValidGmailAccessToken(integration);
  let result = await gmailSendRequest(accessToken, raw);
  if (result.response.status === 401 && integration.refreshTokenEncrypted) {
    accessToken = await getValidGmailAccessToken(integration, true);
    result = await gmailSendRequest(accessToken, raw);
  }
  if (!result.response.ok || !result.payload.id) {
    throw new Error(result.payload.error?.message || `O Gmail recusou o envio (HTTP ${result.response.status}).`);
  }
  return { id: result.payload.id, threadId: result.payload.threadId || null };
}

export async function revokeGoogleToken(integration: EmailIntegration) {
  const token = integration.refreshTokenEncrypted
    ? decryptSecret(integration.refreshTokenEncrypted)
    : decryptSecret(integration.accessTokenEncrypted);
  const response = await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
    cache: "no-store",
  });
  if (!response.ok && response.status !== 400) throw new Error("O Google não confirmou a revogação da conexão.");
}
