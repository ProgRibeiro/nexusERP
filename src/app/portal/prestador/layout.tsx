import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portal do Prestador",
  description: "Portal Nexus para acompanhamento de serviços, ordens de serviço e pagamentos.",
};

export default function ProviderPortalLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#070809] text-white">{children}</div>;
}
