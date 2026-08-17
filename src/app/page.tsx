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
    body: "Firewall de aplicação, bloqueio de bots maliciosos e limite de requisições por IP. É o filtro que barra tráfego suspeito antes de bater no servidor. Sem isso, o sistema recebe visita de robô e dia inteiro, e uma hora algo aciona a porta aberta.",
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
    body: "Tem robô rodando o sistema inteiro e cada alteração no código. Ele testa função por função, a comunicação entre elas e o fluxo completo do usuário. Se algo quebrou, o robô grita antes do cliente perceber.",
  },
  {
    kind: "error",
    label: "Botão de reportar erro",
    eyebrow: "Error reporting — error boundary + captura de logs",
    body: "Em toda tela, visível, sem esconder em menu. O botão tira print da tela automaticamente, captura o log do erro e joga numa fila. Quando algo quebra, o cliente não vai abrir chamado com detalhe técnico. Ele manda “deu erro” e a equipe passa 40 minutos tentando reproduzir o que nem sabe qual foi.",
  },
  {
    kind: "catalog",
    label: "Catálogo de funcionalidades",
    eyebrow: "Arquitetura modular — catálogo de apps + feature flags",
    body: "Cada pedaço do sistema é um módulo independente que liga e desliga. Isso evita aquele Frankenstein de 40 funcionalidades empilhadas que ninguém pediu, ninguém usa e o time fica pagando manutenção em tudo.",
  },
  {
    kind: "map",
    label: "Mapa do sistema",
    eyebrow: "UML — diagrama de classes e sequência",
    body: "É o desenho de quem conversa com quem dentro do sistema. Qual classe chama qual, por onde o dado passa e o que acontece quando o usuário clica naquele botão. Sem esse mapa, o sistema funciona por milagre. E milagre em produção costuma dar ruim.",
  },
  {
    kind: "bank",
    label: "Trava dentro do banco",
    eyebrow: "RLS — Row Level Security",
    body: "A trava de acesso mora no banco de dados. Mesmo que alguém descubra como burlá-la a interface, o banco se recusa a entregar linhas que não pertencem àquele usuário.",
  },
  {
    kind: "secrets",
    label: "Nenhuma senha no código",
    eyebrow: "Secrets management — variáveis de ambiente (.env)",
    body: "Crie esta regra: chave de API, senha do banco, ou token nunca podem ficar no código fonte. Isso é um desastre de segurança, e o risco é real para qualquer aplicação conectada e qualquer pessoa com acesso ao repositório.",
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
    body: "Dono vê tudo. Administrador gerencia. Operador executa. Cliente só vê o que é dele. Cada função tem um guarda-chuva de permissões e a aplicação decide por contexto, não por boa vontade.",
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
          <div className="absolute left-[32%] top-[32%] h-[16px] w-[16px] rounded-full bg-red-500 shadow-[0_0_16px_rgba(255,80,80,0.9)]" />
          <div className="absolute right-[32%] top-[36%] h-[12px] w-[12px] rounded-full bg-red-500 shadow-[0_0_12px_rgba(255,80,80,0.9)]" />
        </div>
      );
    case "shield":
      return (
        <div className="relative h-full w-full overflow-hidden rounded-[18px] bg-[radial-gradient(circle_at_center,_rgba(255,0,45,0.18),_transparent_26%),linear-gradient(180deg,#050507_0%,#101214_100%)]">
          <div className="absolute inset-0 opacity-90">
            <div className="absolute left-[-12%] top-[18%] h-[2px] w-[62%] rotate-[10deg] bg-red-600 shadow-[0_0_18px_#ff3b3b,0_0_35px_#ff3b3b]" />
            <div className="absolute right-[-8%] top-[12%] h-[2px] w-[52%] -rotate-[12deg] bg-red-600 shadow-[0_0_18px_#ff3b3b,0_0_35px_#ff3b3b]" />
          </div>
          <div className="absolute left-1/2 top-1/2 h-[270px] w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border-[10px] border-red-500/80 bg-gradient-to-b from-[#0c0d0f] to-[#150303] shadow-[0_0_35px_rgba(255,34,34,0.55)]" />
          <div className="absolute left-1/2 top-1/2 h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2 rotate-[4deg] rounded-[28px] border-[10px] border-red-500/80 bg-gradient-to-b from-[#0a0b0d] to-[#150505] shadow-[0_0_30px_rgba(255,34,34,0.5)] [clip-path:polygon(50%_0%,100%_15%,100%_75%,50%_100%,0%_75%,0%_15%)]" />
          <div className="absolute left-1/2 top-1/2 h-[130px] w-[130px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[10px] border-red-500/75 bg-black/30" />
          <div className="absolute left-1/2 top-1/2 h-[30px] w-[30px] -translate-x-1/2 -translate-y-1/2 rounded-sm bg-red-500 shadow-[0_0_22px_rgba(255,120,120,0.85)] [clip-path:polygon(50%_0%,100%_50%,50%_100%,0%_50%)]" />
        </div>
      );
    case "audit":
      return (
        <div className="relative h-full w-full overflow-hidden rounded-[18px] bg-[radial-gradient(circle_at_center,_rgba(255,0,45,0.18),_transparent_24%),linear-gradient(180deg,#060708_0%,#101214_100%)]">
          <div className="absolute inset-x-[16%] bottom-[18%] top-[12%] rounded-[20px] border border-red-500/50 bg-[#0e0f12] shadow-[0_0_30px_rgba(255,40,40,0.2)]" />
          <div className="absolute left-1/2 top-1/2 h-[220px] w-[260px] -translate-x-1/2 -translate-y-1/2 rounded-[18px] border-[8px] border-red-500/70 bg-[#101214] shadow-[0_0_28px_rgba(255,36,36,0.45)]" />
          <div className="absolute left-1/2 top-1/2 h-[150px] w-[150px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[10px] border-red-500/70 bg-[#09090a]" />
          <div className="absolute left-1/2 top-1/2 h-[70px] w-[70px] -translate-x-1/2 -translate-y-1/2 text-red-500">
            <Check className="h-full w-full" strokeWidth={3.5} />
          </div>
        </div>
      );
    case "tests":
      return (
        <div className="relative h-full w-full overflow-hidden rounded-[18px] bg-[radial-gradient(circle_at_center,_rgba(255,0,45,0.22),_transparent_26%),linear-gradient(180deg,#070808_0%,#101214_100%)]">
          <div className="absolute inset-x-[8%] bottom-[12%] top-[18%] rounded-[18px] border border-red-500/40 bg-[#090b0d] shadow-[0_0_26px_rgba(255,38,38,0.25)]" />
          <div className="absolute inset-x-[16%] top-[22%] bottom-[16%] grid grid-cols-8 gap-2 p-4">
            {Array.from({ length: 48 }).map((_, idx) => (
              <div
                key={idx}
                className="rounded-[4px] border border-red-500/25 bg-red-500/10 shadow-[0_0_10px_rgba(255,60,60,0.5)]"
              />
            ))}
          </div>
          <div className="absolute left-1/2 top-1/2 h-[100px] w-[100px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[10px] border-red-500/70 bg-[#111316] shadow-[0_0_30px_rgba(255,40,40,0.45)]" />
          <div className="absolute left-1/2 top-1/2 h-[18px] w-[80px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500 shadow-[0_0_18px_rgba(255,80,80,0.8)]" />
          <div className="absolute left-1/2 top-1/2 h-[80px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500 shadow-[0_0_18px_rgba(255,80,80,0.8)]" />
        </div>
      );
    case "error":
      return (
        <div className="relative h-full w-full overflow-hidden rounded-[18px] bg-[radial-gradient(circle_at_center,_rgba(255,0,45,0.18),_transparent_20%),linear-gradient(180deg,#060708_0%,#131517_100%)]">
          <div className="absolute left-[18%] top-[28%] h-[200px] w-[240px] rounded-full border-[12px] border-red-500/70 bg-black/20 shadow-[0_0_30px_rgba(255,34,34,0.45)]" />
          <div className="absolute left-[16%] top-[38%] h-[18px] w-[300px] rotate-[18deg] rounded-full bg-red-500 shadow-[0_0_18px_rgba(255,90,90,0.8)]" />
          <div className="absolute right-[12%] top-[32%] h-[140px] w-[110px] rounded-full border-[12px] border-red-500/70 bg-black/20 shadow-[0_0_25px_rgba(255,34,34,0.4)]" />
          <div className="absolute left-1/2 top-1/2 h-[140px] w-[140px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[8px] border-red-500/70 bg-[#121317]" />
          <div className="absolute left-1/2 top-1/2 h-[50px] w-[50px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500 shadow-[0_0_18px_rgba(255,90,90,0.7)]" />
        </div>
      );
    case "catalog":
      return (
        <div className="relative h-full w-full overflow-hidden rounded-[18px] bg-[radial-gradient(circle_at_center,_rgba(255,0,45,0.14),_transparent_22%),linear-gradient(180deg,#050507_0%,#101214_100%)]">
          <div className="absolute inset-x-[9%] top-[26%] bottom-[14%] grid grid-cols-4 gap-3 p-3">
            {Array.from({ length: 12 }).map((_, idx) => (
              <div
                key={idx}
                className="rounded-md border border-red-500/30 bg-[#0d0e11] shadow-[inset_0_0_18px_rgba(255,60,60,0.2),0_0_18px_rgba(255,60,60,0.15)]"
              />
            ))}
          </div>
          <div className="absolute left-1/2 top-1/2 h-[30px] w-[60px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500 shadow-[0_0_20px_rgba(255,90,90,0.8)]" />
          <div className="absolute left-1/2 top-1/2 h-[18px] w-[18px] -translate-x-[4px] -translate-y-[74px] rounded-full bg-red-500 shadow-[0_0_18px_rgba(255,90,90,0.8)]" />
          <div className="absolute left-1/2 top-1/2 h-[18px] w-[18px] translate-x-[54px] -translate-y-[4px] rounded-full bg-red-500 shadow-[0_0_18px_rgba(255,90,90,0.8)]" />
        </div>
      );
    case "map":
      return (
        <div className="relative h-full w-full overflow-hidden rounded-[18px] bg-[radial-gradient(circle_at_center,_rgba(255,0,45,0.18),_transparent_24%),linear-gradient(180deg,#050507_0%,#101214_100%)]">
          <div className="absolute inset-x-[8%] top-[28%] bottom-[18%] rounded-[16px] border border-red-500/25 bg-[#0a0d10]" />
          <div className="absolute left-[20%] top-[30%] h-[150px] w-[150px] rounded-full border border-red-500/50" />
          <div className="absolute right-[18%] top-[28%] h-[150px] w-[150px] rounded-full border border-red-500/50" />
          <div className="absolute left-[52%] top-[23%] h-[130px] w-[130px] rounded-full border border-red-500/50" />
          <div className="absolute left-[26%] top-[48%] h-[2px] w-[42%] rotate-[18deg] bg-red-500 shadow-[0_0_18px_rgba(255,90,90,0.8)]" />
          <div className="absolute left-[43%] top-[35%] h-[2px] w-[40%] -rotate-[12deg] bg-red-500 shadow-[0_0_18px_rgba(255,90,90,0.8)]" />
          <div className="absolute left-[46%] top-[52%] h-[2px] w-[26%] rotate-[8deg] bg-red-500 shadow-[0_0_18px_rgba(255,90,90,0.8)]" />
          <div className="absolute left-[26%] top-[48%] h-3 w-3 rounded-full bg-red-500 shadow-[0_0_14px_rgba(255,90,90,0.8)]" />
          <div className="absolute right-[18%] top-[28%] h-3 w-3 rounded-full bg-red-500 shadow-[0_0_14px_rgba(255,90,90,0.8)]" />
          <div className="absolute left-[52%] top-[23%] h-3 w-3 rounded-full bg-red-500 shadow-[0_0_14px_rgba(255,90,90,0.8)]" />
        </div>
      );
    case "bank":
      return (
        <div className="relative h-full w-full overflow-hidden rounded-[18px] bg-[radial-gradient(circle_at_center,_rgba(255,0,45,0.18),_transparent_35%),linear-gradient(180deg,#050507_0%,#111315_100%)]">
          <div className="absolute inset-x-[8%] top-[12%] bottom-[10%] rounded-[18px] border border-red-500/35 bg-gradient-to-b from-[#0a0a0b] to-[#171a1d] shadow-[0_0_42px_rgba(255,35,35,0.18)]" />
          <div className="absolute left-1/2 top-[25%] h-[190px] w-[260px] -translate-x-1/2 rounded-[18px] border-[10px] border-red-500/75 bg-[#0d0d0e] shadow-[0_0_30px_rgba(255,40,40,0.4)]" />
          <div className="absolute left-1/2 top-[25%] h-[110px] w-[110px] -translate-x-1/2 rounded-full border-[8px] border-red-500/75 bg-[#0d0d0e]" />
          <div className="absolute left-1/2 top-[27%] h-[40px] w-[40px] -translate-x-1/2 rounded-full bg-red-500 shadow-[0_0_18px_rgba(255,100,100,0.8)]" />
          <div className="absolute left-1/2 top-[48%] h-[34px] w-[110px] -translate-x-1/2 rounded-full bg-red-500/90 shadow-[0_0_20px_rgba(255,100,100,0.8)]" />
        </div>
      );
    case "secrets":
      return (
        <div className="relative h-full w-full overflow-hidden rounded-[18px] bg-[radial-gradient(circle_at_center,_rgba(255,0,45,0.18),_transparent_24%),linear-gradient(180deg,#050507_0%,#101214_100%)]">
          <div className="absolute inset-x-[8%] top-[18%] bottom-[12%] rounded-[18px] border border-red-500/35 bg-[#0a0b0d]" />
          <div className="absolute left-[12%] top-[30%] h-[200px] w-[220px] rotate-[20deg] rounded-[18px] border-[8px] border-red-500/75 bg-[#111315] shadow-[0_0_28px_rgba(255,39,39,0.35)]" />
          <div className="absolute right-[12%] top-[28%] h-[200px] w-[220px] -rotate-[18deg] rounded-[18px] border-[8px] border-red-500/75 bg-[#111315] shadow-[0_0_28px_rgba(255,39,39,0.35)]" />
          <div className="absolute left-1/2 top-1/2 h-[80px] w-[80px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[8px] border-red-500/80 bg-black/20" />
          <div className="absolute left-1/2 top-1/2 h-[14px] w-[14px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500 shadow-[0_0_18px_rgba(255,100,100,0.8)]" />
        </div>
      );
    case "multi":
      return (
        <div className="relative h-full w-full overflow-hidden rounded-[18px] bg-[radial-gradient(circle_at_center,_rgba(255,0,45,0.18),_transparent_26%),linear-gradient(180deg,#050507_0%,#101214_100%)]">
          <div className="absolute inset-x-[8%] top-[24%] bottom-[12%] grid grid-cols-3 gap-4 p-4">
            {Array.from({ length: 9 }).map((_, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-red-500/35 bg-[#0c0d10] shadow-[inset_0_0_16px_rgba(255,60,60,0.15),0_0_14px_rgba(255,60,60,0.1)]"
              />
            ))}
          </div>
          <div className="absolute left-1/2 top-1/2 h-[24px] w-[80px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500 shadow-[0_0_18px_rgba(255,92,92,0.8)]" />
          <div className="absolute left-1/2 top-1/2 h-[70px] w-[1px] -translate-x-1/2 -translate-y-1/2 bg-red-500 shadow-[0_0_14px_rgba(255,92,92,0.8)]" />
        </div>
      );
    case "rbac":
      return (
        <div className="relative h-full w-full overflow-hidden rounded-[18px] bg-[radial-gradient(circle_at_center,_rgba(255,0,45,0.18),_transparent_24%),linear-gradient(180deg,#050507_0%,#101214_100%)]">
          <div className="absolute inset-x-[9%] top-[22%] bottom-[14%] rounded-[18px] border border-red-500/35 bg-[#0a0c0f] p-4">
            <div className="grid h-full grid-cols-3 gap-3">
              {Array.from({ length: 9 }).map((_, idx) => (
                <div
                  key={idx}
                  className="rounded-md border border-red-500/25 bg-red-500/10 shadow-[0_0_10px_rgba(255,60,60,0.18)]"
                />
              ))}
            </div>
          </div>
          <div className="absolute left-1/2 top-1/2 h-[90px] w-[90px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[10px] border-red-500/80 bg-black/20" />
          <div className="absolute left-1/2 top-1/2 h-[28px] w-[28px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500 shadow-[0_0_18px_rgba(255,100,100,0.8)]" />
        </div>
      );
    default:
      return null;
  }
}

export default function Page() {
  const item = slides[0];

  return (
    <main className="min-h-screen bg-[#050607] text-white antialiased">
      <div className="mx-auto max-w-[520px] bg-[#050607] shadow-[0_0_40px_rgba(0,0,0,0.7)]">
        <div className="px-5 pt-5">
          <div className="flex items-center justify-between pb-4 text-[18px] font-semibold text-white/95">
            <span>10:27</span>
            <div className="flex items-center gap-3 text-[15px]">
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
                <span className="h-1.5 w-1.5 rounded-full bg-white/60" />
                <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
              </div>
              <div className="flex items-center gap-1 rounded-full border border-white/40 px-2 py-1 text-[12px] font-medium">
                <span className="inline-block h-2.5 w-2.5 rounded-full border border-white/70" />
                <span className="ml-1">44</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pb-4">
            <button
              aria-label="Voltar"
              className="flex h-12 w-12 items-center justify-center text-white/90"
            >
              <ArrowLeft size={32} strokeWidth={2.2} />
            </button>
            <button
              aria-label="Abrir câmera"
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/40 bg-transparent text-white/90"
            >
              <Camera size={28} />
            </button>
          </div>
        </div>

        <div className="relative overflow-hidden border-t border-white/5 bg-[#060708]">
          <div className="relative h-[350px] overflow-hidden px-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,27,27,0.18),_transparent_22%),linear-gradient(180deg,#020304_0%,#060708_100%)]" />
            <div className="absolute inset-0">
              <Scene kind={item.kind} />
            </div>
            <div className="absolute right-5 top-5 flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[12px] font-medium text-white/90 backdrop-blur-sm">
              <span>1/14</span>
            </div>
          </div>

          <div className="relative bg-[#050607] px-4 pb-6 pt-6">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <h1 className="text-[38px] font-black leading-[0.98] tracking-[-0.06em] text-[#ff2f2f]">
                  {item.label}
                </h1>
                <div className="mt-4 text-[18px] font-medium text-zinc-200">
                  <span className="font-bold text-red-500">{item.eyebrow}</span>
                </div>
                <p className="mt-4 max-w-[440px] text-[18px] leading-[1.45] text-zinc-200">
                  {item.body}
                </p>
              </div>

              <div className="flex w-[88px] flex-col items-center gap-4 pt-2 text-white/90">
                <button
                  aria-label="Curtir"
                  className="flex flex-col items-center gap-1"
                >
                  <Heart size={34} strokeWidth={1.8} />
                  <span className="text-[17px] font-medium">7.173</span>
                </button>
                <button
                  aria-label="Comentar"
                  className="flex flex-col items-center gap-1"
                >
                  <MessageCircle size={34} strokeWidth={1.8} />
                  <span className="text-[17px] font-medium">398</span>
                </button>
                <button
                  aria-label="Compartilhar"
                  className="flex flex-col items-center gap-1"
                >
                  <Share2 size={34} strokeWidth={1.8} />
                  <span className="text-[17px] font-medium">122</span>
                </button>
                <button
                  aria-label="Salvar"
                  className="flex flex-col items-center gap-1"
                >
                  <ArrowUpRight size={34} strokeWidth={1.8} />
                  <span className="text-[17px] font-medium">5.506</span>
                </button>
              </div>
            </div>

            <div className="mt-7 flex items-center justify-center gap-3 text-white/50">
              {Array.from({ length: 5 }).map((_, index) => (
                <span
                  key={index}
                  className={`h-2.5 w-2.5 rounded-full ${index === 0 ? "bg-white/90" : "bg-white/30"}`}
                />
              ))}
            </div>

            <div className="mt-7 flex items-center justify-between gap-4 border-t border-white/10 pt-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-white to-zinc-400 text-[10px] font-black text-black">
                  B
                </div>
                <div className="text-[17px] font-semibold text-white/90">
                  brunoguzela
                  <span className="ml-2 inline-block text-zinc-500">✓</span>
                </div>
              </div>

              <button className="rounded-full border border-red-500/50 bg-red-500/12 px-5 py-2 text-[13px] font-bold text-white/90">
                Seguir
              </button>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-4 py-3 text-[14px] font-medium text-white/80">
              <span className="font-bold text-white/90">
                LEIA O COMENTÁRIO FIXADO
              </span>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/20 text-[10px]">
                  ★
                </span>
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#ff4d4d]/20 text-[10px]">
                  ✦
                </span>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white/8 px-4 py-4 text-[18px] text-white/75">
              <span className="flex-1">Faça um comentário...</span>
              <button className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-transparent text-white/80">
                <ChevronRight size={22} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
