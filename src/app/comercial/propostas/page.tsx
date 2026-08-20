import { getQuotes, updateQuoteStatus } from "@/app/actions/quoteActions";
import Link from "next/link";

export default async function ComercialPropostasPage() {
  const quotes = await getQuotes();

  async function changeStatus(formData: FormData) {
    "use server";
    const quoteId = String(formData.get("quoteId") || "");
    const status = String(formData.get("status") || "");
    if (!quoteId || !status) return;
    await updateQuoteStatus(quoteId, status, "");
  }

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-black uppercase tracking-wider text-zinc-300">Propostas comerciais</h2>
          <p className="text-xs text-zinc-400">Reaproveita o fluxo de orçamentos do ERP como pipeline comercial.</p>
        </div>
        <Link href="/orcamentos" className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-zinc-200 hover:bg-white/10">
          Abrir ERP de Orçamentos
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900 text-xs uppercase tracking-wider text-zinc-400">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {quotes.map((quote) => (
              <tr key={quote.id}>
                <td className="px-4 py-3 font-mono text-zinc-200">{quote.code}</td>
                <td className="px-4 py-3 font-semibold text-white">{quote.clientName}</td>
                <td className="px-4 py-3 text-zinc-300">{quote.status}</td>
                <td className="px-4 py-3 text-[#d4af37]">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(quote.total)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <form action={changeStatus}>
                      <input type="hidden" name="quoteId" value={quote.id} />
                      <input type="hidden" name="status" value="APROVADO" />
                      <button className="rounded-lg bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-200">Aprovar</button>
                    </form>
                    <form action={changeStatus}>
                      <input type="hidden" name="quoteId" value={quote.id} />
                      <input type="hidden" name="status" value="REPROVADO" />
                      <button className="rounded-lg bg-rose-500/20 px-3 py-1 text-xs font-bold text-rose-200">Perder</button>
                    </form>
                    <form action={changeStatus}>
                      <input type="hidden" name="quoteId" value={quote.id} />
                      <input type="hidden" name="status" value="NEGOCIACAO" />
                      <button className="rounded-lg bg-blue-500/20 px-3 py-1 text-xs font-bold text-blue-200">Negociar</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
