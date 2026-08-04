"use client";

import React, { useEffect, useId, useMemo, useState } from "react";
import { Check, Package, PlusCircle, Search, Wrench, X } from "lucide-react";

export interface CatalogSearchOption {
  value: string;
  label: string;
  detail?: string;
  price: number;
  frequent?: boolean;
}

interface CatalogSearchPickerProps {
  type: "SERVICO" | "PECAS";
  value: string;
  options: CatalogSearchOption[];
  onSelect: (value: string) => void;
  onCreate: (suggestedName: string) => void;
}

const normalizeSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();

const formatPrice = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

export function CatalogSearchPicker({ type, value, options, onSelect, onCreate }: CatalogSearchPickerProps) {
  const listboxId = useId();
  const isService = type === "SERVICO";
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const filteredOptions = useMemo(() => {
    const effectiveQuery = query === value ? "" : normalizeSearch(query);
    const terms = effectiveQuery.split(/\s+/).filter(Boolean);

    return options
      .filter((option) => {
        if (!terms.length) return true;
        const searchable = normalizeSearch(`${option.label} ${option.detail || ""}`);
        return terms.every((term) => searchable.includes(term));
      })
      .sort((a, b) => {
        if (Boolean(a.frequent) !== Boolean(b.frequent)) return a.frequent ? -1 : 1;
        if (effectiveQuery) {
          const aStarts = normalizeSearch(a.label).startsWith(effectiveQuery);
          const bStarts = normalizeSearch(b.label).startsWith(effectiveQuery);
          if (aStarts !== bStarts) return aStarts ? -1 : 1;
        }
        return a.label.localeCompare(b.label, "pt-BR");
      })
      .slice(0, 30);
  }, [options, query, value]);

  const chooseOption = (option: CatalogSearchOption) => {
    setQuery(option.label);
    setOpen(false);
    setActiveIndex(0);
    onSelect(option.value);
  };

  const clearSelection = () => {
    setQuery("");
    setOpen(true);
    setActiveIndex(0);
    onSelect("");
  };

  return (
    <div className="relative w-full">
      <label htmlFor={`${listboxId}-input`} className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-450">
        {isService ? "Buscar serviço no catálogo *" : "Buscar material no catálogo *"}
      </label>

      <div className="relative flex items-center">
        <Search size={16} className={`pointer-events-none absolute left-3 ${isService ? "text-blue-500" : "text-orange-500"}`} />
        <input
          id={`${listboxId}-input`}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={open && filteredOptions[activeIndex] ? `${listboxId}-${activeIndex}` : undefined}
          autoComplete="off"
          placeholder={isService ? "Digite o nome, categoria ou descrição do serviço" : "Digite o nome, código ou descrição do material"}
          value={query}
          onFocus={(event) => {
            setOpen(true);
            setActiveIndex(0);
            event.currentTarget.select();
          }}
          onBlur={() => window.setTimeout(() => {
            setOpen(false);
            setQuery(value);
          }, 150)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((current) => Math.min(current + 1, Math.max(0, filteredOptions.length - 1)));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((current) => Math.max(0, current - 1));
            } else if (event.key === "Enter" && open && filteredOptions[activeIndex]) {
              event.preventDefault();
              chooseOption(filteredOptions[activeIndex]);
            } else if (event.key === "Escape") {
              setOpen(false);
              setQuery(value);
            }
          }}
          className={`w-full rounded-lg border bg-white py-2 pl-9 pr-10 text-sm text-zinc-800 outline-none transition-colors placeholder:text-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-150 ${
            isService
              ? "border-blue-200 focus:border-blue-500 focus:ring-blue-500/15 dark:border-blue-900/70"
              : "border-orange-200 focus:border-orange-500 focus:ring-orange-500/15 dark:border-orange-900/70"
          }`}
        />
        {(query || value) && (
          <button
            type="button"
            aria-label="Limpar item selecionado"
            onMouseDown={(event) => event.preventDefault()}
            onClick={clearSelection}
            className="absolute right-2 rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/80 px-3 py-2 text-[10px] font-semibold text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/40">
            <span>{filteredOptions.length ? `${filteredOptions.length} resultado(s)` : "Nenhum item encontrado"}</span>
            <span>Digite para refinar</span>
          </div>

          <div id={listboxId} role="listbox" className="max-h-72 overflow-y-auto p-1.5">
            {filteredOptions.length ? filteredOptions.map((option, index) => {
              const selected = option.value === value;
              const active = index === activeIndex;
              return (
                <button
                  id={`${listboxId}-${index}`}
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => chooseOption(option)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                    active ? (isService ? "bg-blue-50 dark:bg-blue-950/30" : "bg-orange-50 dark:bg-orange-950/30") : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isService ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" : "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300"}`}>
                    {isService ? <Wrench size={15} /> : <Package size={15} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-xs font-bold text-zinc-900 dark:text-zinc-100">{option.label}</span>
                      {option.frequent && <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[8px] font-black uppercase text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">Usado antes</span>}
                    </span>
                    {option.detail && <span className="mt-0.5 block truncate text-[10px] text-zinc-500">{option.detail}</span>}
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[10px] font-black text-zinc-700 dark:text-zinc-200">{formatPrice(option.price)}</span>
                    {selected && <Check size={14} className="ml-auto mt-1 text-emerald-600" />}
                  </span>
                </button>
              );
            }) : (
              <div className="px-4 py-6 text-center">
                <p className="text-xs font-bold text-zinc-700 dark:text-zinc-200">Não encontramos “{query}”</p>
                <p className="mt-1 text-[10px] text-zinc-500">Você pode cadastrar este item no catálogo agora.</p>
              </div>
            )}
          </div>

          <div className="border-t border-zinc-100 bg-zinc-50/80 p-2 dark:border-zinc-800 dark:bg-zinc-950/40">
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setOpen(false);
                onCreate(query === value ? "" : query.trim());
              }}
              className={`flex w-full items-center justify-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-xs font-bold transition-colors dark:bg-zinc-900 ${
                isService
                  ? "border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-950/30"
                  : "border-orange-200 text-orange-700 hover:bg-orange-50 dark:border-orange-900 dark:text-orange-300 dark:hover:bg-orange-950/30"
              }`}
            >
              <PlusCircle size={14} /> Cadastrar novo {isService ? "serviço" : "material"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
