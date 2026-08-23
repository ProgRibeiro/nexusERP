import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, HelpCircle, ShieldCheck, Sparkles } from "lucide-react";

export const metadata: Metadata = { title: "Planos", description: "Planos do ERP O Prestador para empresas de serviços de todos os tamanhos." };

const plans = [
  { name: "Essencial", audience: "Para estruturar a operação", users: "Até 5 usuários", highlight: false, features: ["Clientes e histórico", "Orçamentos profissionais", "Ordens de serviço", "Agenda operacional", "Financeiro essencial", "Suporte de implantação"] },
  { name: "Profissional", audience: "Para empresas em crescimento", users: "Até 25 usuários", highlight: true, features: ["Tudo do Essencial", "CRM e funil de vendas", "Contratos e preventivas", "Estoque e materiais", "NFS-e e painel fiscal", "Indicadores e relatórios", "Treinamento da equipe"] },
  { name: "Enterprise", audience: "Para operações mais complexas", users: "Usuários sob medida", highlight: false, features: ["Tudo do Profissional", "Múltiplas equipes e unidades", "Permissões avançadas", "Governança e auditoria", "Implantação personalizada", "Acompanhamento prioritário"] },
];

const faqs = [
  ["Existe período de implantação?", "Sim. A configuração é acompanhada para organizar cadastros, equipe e fluxo operacional antes da entrada em produção."],
  ["Posso mudar de plano depois?", "Sim. O plano acompanha o crescimento da empresa e pode ser ajustado conforme usuários e módulos necessários."],
  ["O treinamento está incluído?", "Todos os planos têm acesso à central de treinamentos. Os formatos de acompanhamento variam conforme o plano."],
  ["Meus dados ficam protegidos?", "A plataforma possui controle de acesso, permissões, registros de auditoria e rotinas de segurança e backup."],
];

export default function PlanosPage() {
  return <main>
    <section className="relative overflow-hidden bg-[#0b1f33] px-5 py-24 text-center text-white"><div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(21,94,239,.35),transparent_35rem)]"/><div className="relative mx-auto max-w-3xl"><span className="inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-300/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[.2em] text-blue-200"><Sparkles size={13}/> Planos que acompanham seu crescimento</span><h1 className="mt-6 text-4xl font-black tracking-[-.045em] sm:text-5xl">Escolha a estrutura certa para sua operação.</h1><p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-300">Sem pacotes confusos. Entendemos seu cenário e indicamos a configuração ideal para gerar resultado desde a implantação.</p></div></section>
    <section className="mx-auto max-w-[1240px] px-5 py-20"><div className="grid items-stretch gap-5 lg:grid-cols-3">{plans.map((plan) => <article key={plan.name} className={`relative flex flex-col rounded-2xl border bg-white p-7 ${plan.highlight ? "border-[#155eef] shadow-[0_20px_60px_rgba(21,94,239,.14)] ring-1 ring-[#155eef]" : "border-slate-200 shadow-sm"}`}>{plan.highlight && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#155eef] px-4 py-1.5 text-[9px] font-black uppercase tracking-wider text-white">Mais escolhido</span>}<p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#155eef]">{plan.audience}</p><h2 className="mt-3 text-2xl font-black">{plan.name}</h2><p className="mt-2 text-sm font-semibold text-slate-500">{plan.users}</p><div className="my-6 border-t border-slate-100"/><ul className="flex-1 space-y-3">{plan.features.map((feature) => <li key={feature} className="flex gap-2.5 text-sm text-slate-600"><Check size={16} className="mt-0.5 shrink-0 text-[#12b76a]"/>{feature}</li>)}</ul><Link href={`/demonstracao?plano=${plan.name.toLowerCase()}`} className={`mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-lg text-sm font-black ${plan.highlight ? "bg-[#155eef] text-white hover:bg-[#004eeb]" : "border border-slate-300 text-[#0b1f33] hover:border-[#155eef] hover:text-[#155eef]"}`}>Solicitar proposta <ArrowRight size={15}/></Link></article>)}</div>
      <div className="mt-12 flex flex-col items-center justify-between gap-5 rounded-2xl bg-[#eff6ff] p-6 sm:flex-row"><div className="flex gap-3"><ShieldCheck className="shrink-0 text-[#155eef]"/><div><h3 className="font-black">Não sabe qual escolher?</h3><p className="mt-1 text-sm text-slate-600">Conte como sua empresa trabalha e receba uma recomendação sem compromisso.</p></div></div><Link href="/contato" className="shrink-0 rounded-lg bg-white px-5 py-3 text-sm font-black text-[#155eef] shadow-sm">Falar com especialista</Link></div>
    </section>
    <section className="border-t border-slate-200 bg-white"><div className="mx-auto max-w-4xl px-5 py-20"><div className="text-center"><HelpCircle className="mx-auto text-[#155eef]"/><h2 className="mt-4 text-3xl font-black tracking-tight">Perguntas frequentes</h2></div><div className="mt-10 divide-y divide-slate-200 rounded-2xl border border-slate-200">{faqs.map(([q,a]) => <details key={q} className="group p-5"><summary className="cursor-pointer list-none font-bold text-[#101828]">{q}<span className="float-right text-[#155eef] group-open:rotate-45">+</span></summary><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{a}</p></details>)}</div></div></section>
  </main>;
}
