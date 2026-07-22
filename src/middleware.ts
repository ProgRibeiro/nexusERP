import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decryptSession, SESSION_COOKIE_NAME } from "@/lib/session";

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

const PASSTHROUGH_PREFIXES = ["/_next", "/favicon.ico", "/api"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PASSTHROUGH_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // A raiz ("/") é o próprio shell do app: quando não há sessão, o
  // AuthProvider (client-side) já renderiza a tela de login no lugar do
  // dashboard. Não redirecionamos "/" para não criar um loop.
  if (pathname === "/") {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await decryptSession(token) : null;

  if (!session) {
    const loginUrl = new URL("/", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
