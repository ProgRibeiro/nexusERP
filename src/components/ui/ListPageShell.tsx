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
    <div className="flex flex-col gap-4">
      {insight}

      <div className="flex flex-wrap items-center gap-2.5">
        {onSearchChange && (
          <div className="w-full sm:w-auto sm:flex-1 sm:max-w-xs">
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
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-zinc-400">
          <Loader2 className="animate-spin" size={20} />
          <p className="text-xs font-medium">Carregando...</p>
        </div>
      ) : isEmpty ? (
        <Card className="flex flex-col items-center justify-center gap-2 py-16 text-center text-zinc-400">
          {emptyIcon}
          <p className="text-sm font-medium">{emptyMessage}</p>
        </Card>
      ) : (
        children
      )}
    </div>
  );
}
