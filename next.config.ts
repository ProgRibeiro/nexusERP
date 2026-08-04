import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Fotos de evidência são comprimidas no navegador e enviadas uma a uma.
    // O limite padrão de Server Actions (1 MB) é insuficiente para fotos de campo.
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;
