"use client";

import React from "react";
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronRight,
  Heart,
  MessageCircle,
  Share2,
  Shield,
  Sparkles,
  TrendingUp,
  Lock,
  Database,
  MonitorCheck,
  ShieldCheck,
  Network,
  ArrowUpRight,
} from "lucide-react";

const slides = [
  {
    kind: "https",
    label: "HTTPS e cadeado verde",
    eyebrow: "TLS/SSL + HSTS — Full (Strict)",
    body: "Criptografia de ponta a ponta entre o navegador e o servidor. Isso garante que seus dados estejam protegidos em trânsito e que o tráfego seja autenticado e validado antes de qualquer comunicação.",
  },
  {
    kind: "shield",
    label: "Escudo na frente do site",
    eyebrow: "WAF + Bot Fight Mode + Rate Limiting",
    body: "Firewall de aplicação, bloqueio de bots maliciosos e limite de requisições por IP. É o filtro que barra tráfego suspeito antes de bater no servidor. Sem isso, o sistema recebe visita de robô o dia inteiro, e uma hora algo aciona a porta aberta.",
  },
  {
    kind: "audit",
    label: "Auditoria de segurança",
    eyebrow: "Security audit — gate de deploy",
    body: "Antes de publicar, alguém da equipe passa um pente-fino procurando vulnerabilidade. Dependência desatualizada, rota exposta, permissão frouxa. Se a auditoria reprovar, o deploy trava.",
  },
  {
    kind: "tests",
    label: "Testes automáticos",
    eyebrow: "Testes unitários, de integração e E2E",
    body: "Tem robô rodando o sistema inteiro a cada alteração no código. Ele testa função por função, a comunicação entre elas e o fluxo completo do usuário. Se algo quebrou, o robô grita antes do cliente perceber.",
  },
  {
    kind: "error",
    label: "Botão de reportar erro",
    eyebrow: "Error reporting — error boundary + captura de logs",
    body: "Em toda tela, visível, sem esconder em menu. O botão tira print da tela automaticamente, captura o log do erro e joga numa fila.",
  },
  {
    kind: "catalog",
    label: "Catálogo de funcionalidades",
    eyebrow: "Arquitetura modular — catálogo de apps + feature flags",
    body: "Cada pedaço do sistema é um módulo independente que liga e desliga. Isso evita aquele Frankenstein de 40 funcionalidades empilhadas que ninguém pediu.",
  },
  {
    kind: "map",
    label: "Mapa do sistema",
    eyebrow: "UML — diagrama de classes e sequência",
    body: "É o desenho de quem conversa com quem dentro do sistema. Qual classe chama qual, por onde o dado passa e o que acontece quando o usuário clica naquele botão.",
  },
  {
    kind: "bank",
    label: "Trava dentro do banco",
    eyebrow: "RLS — Row Level Security",
    body: "A trava de acesso mora no banco de dados. Mesmo que alguém descubra como burlar a interface, o banco se recusa a entregar linhas que não pertencem àquele usuário.",
  },
  {
    kind: "secrets",
    label: "Nenhuma senha no código",
    eyebrow: "Secrets management — variáveis de ambiente (.env)",
    body: "Crie esta regra: chave de API, senha do banco, ou token nunca podem ficar no código fonte. Isso é um desastre de segurança.",
  },
  {
    kind: "multi",
    label: "Separação de clientes",
    eyebrow: "Multi-tenancy — isolamento por tenant_id",
    body: "Se o sistema atende mais de uma empresa, cada uma vive num compartimento separado. O tenant_id é a chave que garante que o cliente A nunca tromba com dado do cliente B.",
  },
  {
    kind: "rbac",
    label: "Tabela de quem pode o quê",
    eyebrow: "RBAC — matriz de níveis de acesso",
    body: "Dono vê tudo. Administrador gerencia. Operador executa. Cliente só vê o que é dele. Cada função tem um guarda-chuva de permissões.",
  },
];

function Scene({ kind }: { kind: string }) {
  switch (kind) {
    case "https":
      return (
        <div className="relative h-full w-full overflow-hidden rounded-[18px] bg-[radial-gradient(circle_at_center,_rgba(255,0,45,0.18),_transparent_22%),linear-gradient(180deg,#050507_0%,#111315_100%)]">
          <div className="absolute inset-0 opacity-90">
            <div className="absolute left-[-12%] top-[45%] h-[2px] w-[62%] rotate-[12deg] bg-red-600 shadow-[0_0_16px_#ff3b3b,0_0_32px_#ff3b3b]" />
            <div className="absolute right-[-8%] top-[34%] h-[2px] w-[58%] -rotate-[10deg] bg-red-600 shadow-[0_0_16px_#ff3b3b,0_0_32px_#ff3b3b]" />
          </div>
          <div className="absolute left-1/2 top-1/2 h-[230px] w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-[22px] bg-black/40 ring-1 ring-red-500/60 shadow-[0_0_35px_rgba(255,34,34,0.45)]" />
          <div className="absolute left-1/2 top-1/2 h-[180px] w-[180px] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border-[10px] border-red-500/80 bg-gradient-to-b from-[#7d0000] to-[#390303] shadow-[0_0_20px_rgba(255,40,40,0.7)]" />
          <div className="absolute left-1/2 top-1/2 h-[90px] w-[90px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[12px] border-red-500/80" />
          <div className="absolute left-1/2 top-1/2 h-[20px] w-[24px] -translate-x-1/2 translate-y-[-16px] rounded-full bg-red-500 shadow-[0_0_18px_rgba(255,80,80,0.9)]" />
          <div className="absolute left-1/2 top-1/2 h-[20px] w-[18px] -translate-x-1/2 translate-y-[42px] rounded-full bg-red-500 shadow-[0_0_18px_rgba(255,80,80,0.9)]" />
        </div>
      );
    default:
      return (
        <div className="relative h-full w-full overflow-hidden rounded-[18px] bg-[#0c0d10] p-6 text-white">
          <Shield className="h-12 w-12 text-red-500" />
        </div>
      );
  }
}

export default function DemoPage() {
  return (
    <main className="min-h-screen bg-black text-white p-6">
      <h1 className="text-2xl font-bold mb-4">Apresentação Técnica NX ERP</h1>
      <div className="space-y-6 max-w-xl mx-auto">
        {slides.map((s, idx) => (
          <div key={idx} className="rounded-2xl border border-white/10 bg-zinc-900 p-6">
            <h2 className="text-lg font-bold text-red-500">{s.label}</h2>
            <p className="text-xs text-zinc-400 font-mono mt-1">{s.eyebrow}</p>
            <p className="text-sm text-zinc-300 mt-3">{s.body}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
