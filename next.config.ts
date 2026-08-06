import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Identifica cada compilação em produção. O Next detecta telas abertas em
  // uma versão anterior e evita misturar Server Actions de releases distintas.
  deploymentId: process.env.NEXT_DEPLOYMENT_ID || undefined,
  experimental: {
    // Fotos de evidência são comprimidas no navegador e enviadas uma a uma.
    // O limite padrão de Server Actions (1 MB) é insuficiente para fotos de campo.
    serverActions: { bodySizeLimit: "8mb" },
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          { key: "Content-Type", value: "application/manifest+json" },
          { key: "Cache-Control", value: "public, max-age=3600" },
        ],
      },
    ];
  },
};

export default nextConfig;
