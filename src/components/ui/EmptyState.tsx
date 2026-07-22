import React from "react";

export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/30">
      {icon && <div className="mb-3 text-zinc-400">{icon}</div>}
      <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-100">{title}</h3>
      {description && <p className="mt-1 max-w-md text-xs leading-relaxed text-zinc-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
