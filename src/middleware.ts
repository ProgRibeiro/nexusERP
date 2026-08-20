import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decryptSession, SESSION_COOKIE_NAME } from "@/lib/session";
import {
  classifyPortalArea,
  hasCommercialAccess,
  hasDeveloperAccess,
  inferLandingArea,
  isAuthPublicPath,
  isMarketingPublicPath,
  normalizeHostname,
  toInternalAuthPath,
  toInternalMarketingPath,
  toPublicMarketingPath,
} from "@/lib/portalRouting";

/**
 * Camada de defesa em profundidade: redireciona navegação direta a rotas
 * protegidas quando não há cookie de sessão válido.
 *
 * IMPORTANTE: isto é UX, não o limite de segurança real. O limite de
 * segurança real são as chamadas a `requireAuth()`/`requirePermission()`
 * dentro de cada Server Action (src/lib/auth.ts) — é lá que dados são
 * de fato protegidos, porque Server Actions podem ser chamadas diretamente
 * sem passar pelo middleware.
 */

const PASSTHROUGH_PREFIXES = [
  "/_next",
  "/favicon.ico",
  "/api",
  "/portal/loja",
  "/portal/prestador",
  "/manifest.webmanifest",
  "/sw.js",
  "/offline.html",
  "/icons",
  "/site",
  "/auth",
  // Evidências são arquivos estáticos com nomes aleatórios. Elas precisam
  // carregar também no relatório/PDF, onde a requisição da tag <img> pode
  // não carregar o cookie usado pela navegação principal.
  "/uploads",
];

// In-memory rate limiting map para proteção contra flooding e estouro de requisições por IP
const ipRateLimitMap = new Map<string, { count: number; resetTime: number }>();

const SUSPICIOUS_BOT_PATTERNS = [
  /sqlmap/i,
  /nikto/i,
  /nmap/i,
  /masscan/i,
  /zgrab/i,
  /dirbuster/i,
  /gobuster/i,
  /censys/i,
  /netsparker/i,
  /w3af/i,
  /acunetix/i,
];

function isMaliciousBot(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return SUSPICIOUS_BOT_PATTERNS.some((pattern) => pattern.test(userAgent));
}

function checkRateLimit(ip: string, maxRequests = 120, windowMs = 10000): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = ipRateLimitMap.get(ip);

  // Limpeza de IPs expirados periodicamente se o mapa crescer muito
  if (ipRateLimitMap.size > 5000) {
    for (const [k, v] of ipRateLimitMap.entries()) {
      if (now > v.resetTime) ipRateLimitMap.delete(k);
    }
  }

  if (!record || now > record.resetTime) {
    ipRateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  record.count += 1;
  if (record.count > maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: maxRequests - record.count };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const userAgent = request.headers.get("user-agent");
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "127.0.0.1";
  const requestHost = normalizeHostname(request.headers.get("x-forwarded-host") || request.headers.get("host"));
  const hostArea = classifyPortalArea(requestHost);

  // WAF / Bot Fight Mode: Bloquear bots de varredura maliciosa
  if (isMaliciousBot(userAgent)) {
    return new NextResponse(JSON.stringify({ error: "Acesso bloqueado pelo WAF / Bot Fight Mode." }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Rate Limiting: 120 requisições a cada 10s por IP
  const rateCheck = checkRateLimit(clientIp, 120, 10000);
  if (!rateCheck.allowed) {
    return new NextResponse(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": "10",
        "X-RateLimit-Limit": "120",
        "X-RateLimit-Remaining": "0",
      },
    });
  }

  // Compatibilidade com bancos e backups anteriores à rota dinâmica de
  // uploads. O arquivo continua no mesmo diretório; apenas a leitura passa
  // pelo endpoint que enxerga imagens criadas depois do `next build`.
  if (pathname.startsWith("/uploads/")) {
    const uploadUrl = request.nextUrl.clone();
    uploadUrl.pathname = `/api${pathname}`;
    return NextResponse.rewrite(uploadUrl);
  }

  if (pathname.startsWith("/site") && hostArea !== "marketing") {
    const target = request.nextUrl.clone();
    target.pathname = toPublicMarketingPath(pathname);
    target.search = request.nextUrl.search;
    return NextResponse.redirect(target);
  }

  if (isAuthPublicPath(pathname)) {
    const authUrl = request.nextUrl.clone();
    authUrl.pathname = toInternalAuthPath(pathname);
    return NextResponse.rewrite(authUrl);
  }

  if (hostArea === "marketing" && isMarketingPublicPath(pathname)) {
    const marketingUrl = request.nextUrl.clone();
    marketingUrl.pathname = toInternalMarketingPath(pathname);
    return NextResponse.rewrite(marketingUrl);
  }

  if (hostArea !== "marketing" && pathname !== "/" && isMarketingPublicPath(pathname)) {
    const target = new URL(process.env.NEXUS_MARKETING_REDIRECT_URL || "https://nexusmanutencao.com");
    target.pathname = pathname;
    target.search = request.nextUrl.search;
    return NextResponse.redirect(target);
  }

  if (hostArea === "developer" && pathname === "/") {
    const devUrl = request.nextUrl.clone();
    devUrl.pathname = "/dev";
    return NextResponse.rewrite(devUrl);
  }

  if (hostArea === "commercial" && pathname === "/") {
    const commercialUrl = request.nextUrl.clone();
    commercialUrl.pathname = "/comercial";
    return NextResponse.rewrite(commercialUrl);
  }

  if (hostArea === "developer" && !pathname.startsWith("/dev")) {
    const devScopedUrl = request.nextUrl.clone();
    devScopedUrl.pathname = `/dev${pathname}`;
    return NextResponse.rewrite(devScopedUrl);
  }

  if (hostArea === "commercial" && !pathname.startsWith("/comercial")) {
    const commercialScopedUrl = request.nextUrl.clone();
    commercialScopedUrl.pathname = `/comercial${pathname}`;
    return NextResponse.rewrite(commercialScopedUrl);
  }

  if (PASSTHROUGH_PREFIXES.some((p) => pathname.startsWith(p))) {
    const response = NextResponse.next();
    response.headers.set("X-RateLimit-Limit", "120");
    response.headers.set("X-RateLimit-Remaining", String(rateCheck.remaining));
    return response;
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await decryptSession(token) : null;

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const landingArea = inferLandingArea({ roleName: session.roleName, permissions: session.permissions });
  if (hostArea === "developer" && !hasDeveloperAccess(session)) {
    const fallback = request.nextUrl.clone();
    fallback.pathname = "/login";
    return NextResponse.redirect(fallback);
  }
  if (hostArea === "commercial" && !hasCommercialAccess(session)) {
    const fallback = request.nextUrl.clone();
    fallback.pathname = "/login";
    return NextResponse.redirect(fallback);
  }
  if (hostArea === "app" && landingArea === "commercial") {
    const fallback = request.nextUrl.clone();
    fallback.pathname = "/login";
    return NextResponse.redirect(fallback);
  }

  const response = NextResponse.next();
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  response.headers.set("X-RateLimit-Limit", "120");
  response.headers.set("X-RateLimit-Remaining", String(rateCheck.remaining));
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
