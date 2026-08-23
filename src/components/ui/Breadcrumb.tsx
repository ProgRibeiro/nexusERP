import React from "react";
import { ChevronRight } from "lucide-react";

export function Breadcrumb({ items }: { items: string[] }) {
  return <nav aria-label="Navegação estrutural" className="flex min-w-0 items-center gap-1 text-[10px] font-medium text-[#667085]">{items.map((item, index) => <React.Fragment key={`${item}-${index}`}><span className={index === items.length - 1 ? "truncate text-[#344054] dark:text-slate-300" : "truncate"}>{item}</span>{index < items.length - 1 && <ChevronRight aria-hidden size={11} className="shrink-0 text-slate-300" />}</React.Fragment>)}</nav>;
}
