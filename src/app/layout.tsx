import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import PwaRegistration from "@/components/PwaRegistration";
import AdaptivePerformance from "@/components/AdaptivePerformance";
import StaleChunkRecovery from "@/components/StaleChunkRecovery";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://oprestador.tech"),
  title: { default: "O Prestador · ERP completo", template: "%s · O Prestador" },
  description:
    "Sistema de Gestão Integrada para Prestadores de Serviços Técnicos.",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "https://oprestador.tech",
    siteName: "O Prestador",
    title: "O Prestador · ERP completo para sua empresa",
    description: "Conecte vendas, ordens de serviço, equipe e financeiro em uma única plataforma.",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: "O Prestador — ERP completo para sua empresa" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "O Prestador · ERP completo para sua empresa",
    description: "Conecte vendas, ordens de serviço, equipe e financeiro em uma única plataforma.",
    images: ["/og.png"],
  },
  applicationName: "O Prestador",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "O Prestador",
  },
  icons: {
    icon: [{ url: "/brand/oprestador-icon.png", sizes: "1254x1254", type: "image/png" }],
    apple: [{ url: "/brand/oprestador-icon.png", sizes: "1254x1254", type: "image/png" }],
  },
  formatDetection: { telephone: false },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0b1833" },
    { media: "(prefers-color-scheme: dark)", color: "#07101f" },
  ],
};

import { MaintenanceBanner } from "@/components/MaintenanceBanner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${inter.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <MaintenanceBanner />
          {children}
        </AuthProvider>
        <StaleChunkRecovery />
        <AdaptivePerformance />
        <PwaRegistration />
      </body>
    </html>
  );
}
