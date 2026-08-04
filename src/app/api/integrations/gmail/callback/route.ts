import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  exchangeGmailAuthorizationCode,
  getGoogleUserInfo,
  GMAIL_SEND_SCOPE,
} from "@/lib/gmail";
import { decryptSecret, encryptSecret } from "@/lib/secretBox";

export const runtime = "nodejs";

interface OAuthState {
  state: string;
  returnTo: string;
  userId: string;
  expiresAt: number;
}

function safeReturnTo(value?: string) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/orcamentos";
}

function redirectResult(request: NextRequest, returnTo: string, result: string, reason?: string) {
  const target = new URL(safeReturnTo(returnTo), request.nextUrl.origin);
  target.searchParams.set("gmail", result);
  if (reason) target.searchParams.set("reason", reason.slice(0, 120));
  const response = NextResponse.redirect(target);
  response.cookies.set("nx_gmail_oauth_state", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/api/integrations/gmail/callback",
    maxAge: 0,
  });
  return response;
}

export async function GET(request: NextRequest) {
  let returnTo = "/orcamentos";
  try {
    const session = await requirePermission("quotes.write");
    const encryptedState = request.cookies.get("nx_gmail_oauth_state")?.value;
    if (!encryptedState) throw new Error("Estado OAuth ausente ou expirado.");
    const savedState = JSON.parse(decryptSecret(encryptedState)) as OAuthState;
    returnTo = safeReturnTo(savedState.returnTo);
    if (savedState.userId !== session.userId || savedState.expiresAt < Date.now()) throw new Error("Estado OAuth inválido ou expirado.");
    if (request.nextUrl.searchParams.get("state") !== savedState.state) throw new Error("A validação de segurança do Google falhou.");
    const oauthError = request.nextUrl.searchParams.get("error");
    if (oauthError) throw new Error(oauthError === "access_denied" ? "A autorização da conta Google foi cancelada." : oauthError);
    const code = request.nextUrl.searchParams.get("code");
    if (!code) throw new Error("O Google não devolveu o código de autorização.");

    const token = await exchangeGmailAuthorizationCode(code, request.nextUrl.origin);
    const grantedScopes = token.scope || "";
    if (!grantedScopes.split(" ").includes(GMAIL_SEND_SCOPE)) {
      throw new Error("A permissão para enviar e-mails não foi concedida.");
    }
    const profile = await getGoogleUserInfo(token.access_token!);
    const existing = await prisma.emailIntegration.findUnique({ where: { provider: "GMAIL" } });
    const refreshTokenEncrypted = token.refresh_token
      ? encryptSecret(token.refresh_token)
      : existing?.refreshTokenEncrypted;
    if (!refreshTokenEncrypted) throw new Error("O Google não forneceu um token de renovação. Revogue o acesso anterior e conecte novamente.");

    const integration = await prisma.emailIntegration.upsert({
      where: { provider: "GMAIL" },
      update: {
        email: profile.email,
        displayName: profile.name,
        accessTokenEncrypted: encryptSecret(token.access_token!),
        refreshTokenEncrypted,
        tokenExpiresAt: new Date(Date.now() + Math.max(60, token.expires_in || 3600) * 1000),
        scope: grantedScopes,
        tokenType: token.token_type || "Bearer",
        active: true,
        lastError: null,
        connectedById: session.userId,
      },
      create: {
        provider: "GMAIL",
        email: profile.email,
        displayName: profile.name,
        accessTokenEncrypted: encryptSecret(token.access_token!),
        refreshTokenEncrypted,
        tokenExpiresAt: new Date(Date.now() + Math.max(60, token.expires_in || 3600) * 1000),
        scope: grantedScopes,
        tokenType: token.token_type || "Bearer",
        connectedById: session.userId,
      },
    });
    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "INTEGRACAO_CONECTADA",
        entity: "EmailIntegration",
        entityId: integration.id,
        changesJson: JSON.stringify({ provider: "GMAIL", email: profile.email, scopes: grantedScopes.split(" ") }),
      },
    });
    return redirectResult(request, returnTo, "connected");
  } catch (error) {
    return redirectResult(request, returnTo, "error", error instanceof Error ? error.message : "Falha ao conectar Gmail.");
  }
}
