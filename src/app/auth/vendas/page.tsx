import Link from "next/link";
import { ArrowRight, BarChart3, CalendarCheck, CheckCircle2, FileSignature, Target, Users } from "lucide-react";
import { PrestadorBrand } from "@/components/brand/PrestadorBrand";

const resources = [
  { icon: Users, title: "Leads organizados", text: "Centralize contatos, histórico e próximos passos de cada oportunidade." },
  { icon: BarChart3, title: "Pipeline visível", text: "Acompanhe negociações por etapa e saiba onde o time precisa agir." },
  { icon: FileSignature, title: "Propostas conectadas", text: "Transforme oportunidades em propostas e serviços sem retrabalho." },
  { icon: Target, title: "Metas e comissões", text: "Dê clareza à equipe com resultados, objetivos e evolução comercial." },
];

export default function SalesPortalLandingPage() {
  return (
    <main className="min-h-screen bg-[#071426] text-white">
      <header className="border-b border-white/10 bg-[#071426]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5">
          <PrestadorBrand light />
          <Link href="https://oprestador.tech/demonstracao" className="inline-flex items-center gap-2 rounded-xl bg-[#155eef] px-4 py-2.5 text-xs font-black text-white transition hover:bg-blue-500">
            Quero uma demonstração <ArrowRight size={15} />
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(59,130,246,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,.12)_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="absolute left-[-10rem] top-[-12rem] h-[34rem] w-[34rem] rounded-full bg-blue-600/20 blur-[110px]" />
        <div className="relative mx-auto grid max-w-7xl gap-14 px-5 py-24 lg:grid-cols-[1.08fr_.92fr] lg:py-32">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-[10px] font-black uppercase tracking-[.2em] text-cyan-100">
              <CalendarCheck size={14} /> ERP completo para prestadores de serviços
            </span>
            <h1 className="mt-7 max-w-3xl text-5xl font-black leading-[.98] tracking-[-.055em] sm:text-6xl">
              Mais serviços vendidos. <span className="bg-gradient-to-r from-blue-300 to-cyan-200 bg-clip-text text-transparent">Mais controle para crescer.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300">
              Conheça o O Prestador: o sistema que conecta captação de clientes, propostas, ordens de serviço, equipe de campo e financeiro em uma única operação.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="https://oprestador.tech/demonstracao" className="inline-flex items-center gap-2 rounded-xl bg-[#155eef] px-6 py-3.5 text-sm font-black shadow-[0_16px_40px_rgba(21,94,239,.35)] transition hover:bg-blue-500">
                Ver o ERP em ação <ArrowRight size={16} />
              </Link>
              <Link href="https://oprestador.tech/planos" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-black transition hover:bg-white/10">
                Conhecer os planos
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {resources.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-2xl border border-white/10 bg-white/[.045] p-6 shadow-2xl backdrop-blur">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-500/15 text-blue-300 ring-1 ring-blue-400/20"><Icon size={20} /></span>
                <h2 className="mt-5 text-base font-black">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[.025]">
        <div className="mx-auto grid max-w-7xl gap-5 px-5 py-14 md:grid-cols-3">
          {["Implantação acompanhada", "Operação acessível em qualquer dispositivo", "Comercial, campo e financeiro conectados"].map((item) => (
            <div key={item} className="flex items-center gap-3 text-sm font-bold text-slate-200"><CheckCircle2 className="text-emerald-400" size={19} /> {item}</div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-24 text-center">
        <p className="text-[10px] font-black uppercase tracking-[.22em] text-blue-300">Pare de perder tempo entre planilhas</p>
        <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-black tracking-[-.04em] sm:text-4xl">Transforme cada oportunidade em uma operação organizada do orçamento ao recebimento.</h2>
        <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-slate-400">Veja como o O Prestador pode apoiar sua empresa com processos claros, histórico completo e indicadores para decisões melhores.</p>
        <Link href="https://oprestador.tech/contato" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#f59e0b] px-6 py-3.5 text-sm font-black text-[#071426] transition hover:bg-amber-400">
          Falar com um especialista <ArrowRight size={16} />
        </Link>
      </section>
    </main>
  );
}
