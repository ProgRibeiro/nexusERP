import Image from "next/image";

export function PrestadorBrand({ compact = false, light = false }: { compact?: boolean; light?: boolean }) {
  if (compact) {
    return <Image src="/brand/oprestador-icon.png" alt="O Prestador" width={42} height={42} className="h-[42px] w-[42px] object-contain" priority />;
  }

  return (
    <span className="inline-flex min-w-0 items-center gap-2.5">
      <Image src="/brand/oprestador-icon.png" alt="" width={46} height={46} className="h-[46px] w-[46px] shrink-0 object-contain" priority />
      <span className="leading-none">
        <strong className={`block whitespace-nowrap text-[15px] font-black uppercase tracking-[.035em] ${light ? "text-white" : "text-[#111827]"}`}>O Prestador</strong>
        <span className={`mt-1.5 block whitespace-nowrap text-[6.5px] font-semibold uppercase tracking-[.2em] ${light ? "text-slate-300" : "text-slate-500"}`}>ERP completo para sua empresa</span>
      </span>
    </span>
  );
}
