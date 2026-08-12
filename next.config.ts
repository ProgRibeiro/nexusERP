import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Identifica cada compilação em produção. O Next detecta telas abertas em
  // uma versão anterior e evita misturar Server Actions de releases distintas.
  deploymentId: process.env.NEXT_DEPLOYMENT_ID || undefined,
  experimental: {
    // As evidências são comprimidas no navegador e enviadas em um único lote.
    // O limite comporta até 20 imagens otimizadas sem aceitar arquivos brutos.
    serverActions: { bodySizeLimit: "12mb" },
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
      {
        // As fotos já são otimizadas antes do envio e recebem nome único.
        // O cache longo evita baixar novamente a mesma evidência ao alternar
        // abas, abrir o relatório ou gerar a impressão.
        source: "/uploads/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
