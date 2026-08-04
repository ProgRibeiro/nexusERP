import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { buildGmailAuthorizationUrl, gmailOAuthConfig } from "@/lib/gmail";
import { encryptSecret } from "@/lib/secretBox";

export const runtime = "nodejs";

function safeReturnTo(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/orcamentos";
}

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission("quotes.write");
    const config = gmailOAuthConfig(request.nextUrl.origin);
    if (!config.configured) {
      return NextResponse.redirect(new URL("/orcamentos?gmail=not_configured", request.url));
    }
    const state = crypto.randomBytes(32).toString("base64url");
    const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"));
    const stateCookie = encryptSecret(JSON.stringify({
      state,
      returnTo,
      userId: session.userId,
      expiresAt: Date.now() + 10 * 60_000,
    }));
    const response = NextResponse.redirect(buildGmailAuthorizationUrl({
      state,
      requestOrigin: request.nextUrl.origin,
      loginHint: session.email,
    }));
    response.cookies.set("nx_gmail_oauth_state", stateCookie, {
      httpOnly: true,
      sameSite: "lax",
      secure: config.baseUrl.startsWith("https://"),
      path: "/api/integrations/gmail/callback",
      maxAge: 10 * 60,
    });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/?auth=required", request.url));
  }
}
