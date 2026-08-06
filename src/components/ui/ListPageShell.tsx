"use client";

import React from "react";
import { Loader2, Plus, Search as SearchIcon } from "lucide-react";
import { Input } from "./Input";
import { Button } from "./Button";
import { Card } from "./Card";

interface ListPageShellProps {
  /** Omit to hide the search box entirely (rare, e.g. read-only log views). */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** Extra filter controls (Selects, etc.) rendered next to the search box. */
  filters?: React.ReactNode;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  /** Proactive insight chips (InsightBar) rendered above the toolbar. */
  insight?: React.ReactNode;
  loading: boolean;
  isEmpty: boolean;
  emptyIcon?: React.ReactNode;
  emptyMessage: string;
  children: React.ReactNode;
}

/**
 * Shared anatomy for the ~9 list-page modules: search + filters + primary action,
 * then a loading / empty / table three-way state. Extracted because every module
 * (Clientes, Estoque, Contratos, Serviços, Orçamentos, OS...) reimplemented this
 * identically.
 */
export function ListPageShell({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  filters,
  primaryActionLabel,
  onPrimaryAction,
  insight,
  loading,
  isEmpty,
  emptyIcon,
  emptyMessage,
  children,
}: ListPageShellProps) {
  return (
    <div className="flex flex-col gap-5">
      {insight}

      <div className="flex flex-wrap items-center gap-3 rounded-[20px] border border-slate-200/80 bg-white/90 p-3 shadow-[0_10px_30px_rgba(15,23,42,.045)] ring-1 ring-white/80 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/90 dark:ring-white/[.03] sm:p-4">
        {onSearchChange && (
          <div className="w-full sm:w-auto sm:flex-1 sm:max-w-md">
            <Input
              icon={<SearchIcon size={14} />}
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        )}
        {filters}
        <div className="flex-1" />
        {primaryActionLabel && onPrimaryAction && (
          <Button onClick={onPrimaryAction}>
            <Plus size={15} />
            {primaryActionLabel}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-[22px] border border-slate-200/70 bg-white/80 py-20 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/80">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400"><Loader2 className="animate-spin" size={22} /></span>
          <p className="text-xs font-bold">Carregando informações...</p>
        </div>
      ) : isEmpty ? (
        <Card className="relative flex min-h-64 flex-col items-center justify-center gap-3 overflow-hidden py-16 text-center text-zinc-400">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,.08),transparent_19rem)]" />
          <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-500 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-400">{emptyIcon}</span>
          <p className="relative text-sm font-bold text-zinc-600 dark:text-zinc-300">{emptyMessage}</p>
          <p className="relative max-w-sm text-xs leading-relaxed text-zinc-400">Use a ação acima para criar o primeiro registro ou ajuste os filtros da pesquisa.</p>
        </Card>
      ) : (
        children
      )}
    </div>
  );
}
