import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  if (totalPages <= 1) return null;
  return <nav aria-label="Paginação" className="flex items-center justify-between gap-3 border-t border-[#e4e7ec] px-4 py-3"><p className="text-xs text-[#667085]">Página <strong className="text-[#344054]">{page}</strong> de {totalPages}</p><div className="flex gap-1"><button aria-label="Página anterior" disabled={page <= 1} onClick={() => onChange(page - 1)} className="grid h-8 w-8 place-items-center rounded-lg border border-[#e4e7ec] text-[#475467] hover:bg-slate-50 disabled:opacity-40"><ChevronLeft size={15}/></button><button aria-label="Próxima página" disabled={page >= totalPages} onClick={() => onChange(page + 1)} className="grid h-8 w-8 place-items-center rounded-lg border border-[#e4e7ec] text-[#475467] hover:bg-slate-50 disabled:opacity-40"><ChevronRight size={15}/></button></div></nav>;
}
