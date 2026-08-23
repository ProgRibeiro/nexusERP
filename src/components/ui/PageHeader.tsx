import React from "react";

export function PageHeader({ title, description, eyebrow, actions }: { title: string; description?: string; eyebrow?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-[10px] font-bold uppercase tracking-[.14em] text-[#155eef]">{eyebrow}</p>}
        <h1 className="truncate text-xl font-bold tracking-[-.025em] text-[#101828] dark:text-white sm:text-2xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-[#667085] dark:text-slate-400">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
