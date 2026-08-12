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
  // Evidências são arquivos estáticos com nomes aleatórios. Elas precisam
  // carregar também no relatório/PDF, onde a requisição da tag <img> pode
  // não carregar o cookie usado pela navegação principal.
  "/uploads",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Compatibilidade com bancos e backups anteriores à rota dinâmica de
  // uploads. O arquivo continua no mesmo diretório; apenas a leitura passa
  // pelo endpoint que enxerga imagens criadas depois do `next build`.
  if (pathname.startsWith("/uploads/")) {
    const uploadUrl = request.nextUrl.clone();
    uploadUrl.pathname = `/api${pathname}`;
    return NextResponse.rewrite(uploadUrl);
  }

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
