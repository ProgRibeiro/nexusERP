export type PortalArea = "marketing" | "app" | "commercial" | "developer" | "unknown";
export { type LandingArea, inferLandingArea, hasCommercialAccess, hasDeveloperAccess } from "./rbac";

const DEFAULT_MARKETING_HOSTS = ["nexusmanutencao.com", "www.nexusmanutencao.com"];
const DEFAULT_APP_HOST = "app.nexusmanutencao.com";
const DEFAULT_COMMERCIAL_HOST = "comercial.nexusmanutencao.com";
const DEFAULT_DEVELOPER_HOST = "dev.nexusmanutencao.com";

const MARKETING_PUBLIC_PATHS = [
  "/",
  "/recursos",
  "/solucoes",
  "/planos",
  "/demonstracao",
  "/contato",
] as const;

const AUTH_PUBLIC_PATHS = ["/login", "/cadastro", "/recuperar-senha"] as const;

function envList(value: string | undefined, fallback: string[]) {
  if (!value?.trim()) return fallback;
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function normalizeHostname(input: string | null | undefined) {
  if (!input) return "";
  return input.split(",")[0].trim().toLowerCase().split(":")[0];
}

export function getPortalHosts() {
  return {
    marketing: envList(process.env.NEXUS_MARKETING_HOSTS, DEFAULT_MARKETING_HOSTS),
    app: (process.env.NEXUS_APP_HOST || DEFAULT_APP_HOST).trim().toLowerCase(),
    commercial: (process.env.NEXUS_COMMERCIAL_HOST || DEFAULT_COMMERCIAL_HOST).trim().toLowerCase(),
    developer: (process.env.NEXUS_DEVELOPER_HOST || process.env.NEXUS_DEV_HOST || DEFAULT_DEVELOPER_HOST).trim().toLowerCase(),
  };
}

export function classifyPortalArea(hostname: string): PortalArea {
  const host = normalizeHostname(hostname);
  const configured = getPortalHosts();
  if (configured.marketing.includes(host)) return "marketing";
  if (configured.app === host) return "app";
  if (configured.commercial === host) return "commercial";
  if (configured.developer === host) return "developer";
  return "unknown";
}

export function isMarketingPublicPath(pathname: string) {
  return MARKETING_PUBLIC_PATHS.includes(pathname as (typeof MARKETING_PUBLIC_PATHS)[number]);
}

export function isAuthPublicPath(pathname: string) {
  return AUTH_PUBLIC_PATHS.includes(pathname as (typeof AUTH_PUBLIC_PATHS)[number]);
}

export function toInternalMarketingPath(pathname: string) {
  return pathname === "/" ? "/site" : `/site${pathname}`;
}

export function toInternalAuthPath(pathname: string) {
  return `/auth${pathname}`;
}

export function toPublicMarketingPath(pathname: string) {
  if (!pathname.startsWith("/site")) return pathname;
  const value = pathname.slice("/site".length);
  return value || "/";
}

export function portalBaseUrls() {
  return {
    marketing: process.env.NEXT_PUBLIC_NEXUS_MARKETING_URL || "https://nexusmanutencao.com",
    app: process.env.NEXT_PUBLIC_NEXUS_APP_URL || "https://app.nexusmanutencao.com",
    commercial: process.env.NEXT_PUBLIC_NEXUS_COMMERCIAL_URL || "https://comercial.nexusmanutencao.com",
    developer: process.env.NEXT_PUBLIC_NEXUS_DEVELOPER_URL || "https://dev.nexusmanutencao.com",
  };
}
