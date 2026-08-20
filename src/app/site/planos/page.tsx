import Link from "next/link";

const plans = [
  { name: "Start", users: "até 5 usuários", note: "Operação essencial" },
  { name: "Growth", users: "até 25 usuários", note: "Escala comercial e operacional" },
  { name: "Enterprise", users: "usuários ilimitados", note: "Governança completa SaaS" },
];

export default function PlanosPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-16">
      <h1 className="text-3xl font-black">Planos e preços</h1>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-300">
        Escolha o plano ideal para o estágio da sua operação. Todos os planos incluem suporte de implantação.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <article key={plan.name} className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
            <h2 className="text-xl font-black text-[#d4af37]">{plan.name}</h2>
            <p className="mt-2 text-sm font-semibold text-zinc-200">{plan.users}</p>
            <p className="mt-1 text-sm text-zinc-400">{plan.note}</p>
            <Link href="/demonstracao" className="mt-6 inline-block rounded-lg border border-[#d4af37]/50 px-4 py-2 text-xs font-black text-[#d4af37] hover:bg-[#d4af37]/10">
              Solicitar proposta
            </Link>
          </article>
        ))}
      </div>
    </main>
  );
}
