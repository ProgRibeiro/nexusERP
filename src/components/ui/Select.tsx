"use client";

import React, { forwardRef, useEffect, useId, useMemo, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  /** Texto adicional usado somente na pesquisa, como CNPJ, código ou categoria. */
  keywords?: string;
}

interface SelectProps extends Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  "children"
> {
  label?: string;
  options: SelectOption[];
  error?: string;
  /** Mantido para casos excepcionais. Por padrão, toda seleção aceita pesquisa. */
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
}

const normalizeSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      options,
      error,
      className = "",
      id,
      value,
      defaultValue,
      onChange,
      onBlur,
      onFocus,
      disabled,
      required,
      name,
      searchable = true,
      searchPlaceholder = "Digite para pesquisar e selecionar",
      emptyMessage = "Nenhuma opção encontrada",
      ...nativeProps
    },
    ref,
  ) => {
    const fallbackId = useId();
    const generatedId = id || fallbackId;
    const currentValue = String(value ?? defaultValue ?? "");
    const selectedOption = options.find(
      (option) => option.value === currentValue,
    );
    const selectedLabel = selectedOption?.label || "";
    const [query, setQuery] = useState(selectedLabel);
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);

    useEffect(() => {
      if (!open) setQuery(selectedLabel);
    }, [open, selectedLabel]);

    const filteredOptions = useMemo(() => {
      const effectiveQuery =
        open && query !== selectedLabel ? normalizeSearch(query) : "";
      const terms = effectiveQuery.split(/\s+/).filter(Boolean);
      if (!terms.length) return options.slice(0, 80);

      return options
        .filter((option) => {
          const searchableText = normalizeSearch(
            `${option.label} ${option.keywords || ""}`,
          );
          return terms.every((term) => searchableText.includes(term));
        })
        .sort((a, b) => {
          const normalizedA = normalizeSearch(a.label);
          const normalizedB = normalizeSearch(b.label);
          const aStarts = normalizedA.startsWith(effectiveQuery);
          const bStarts = normalizedB.startsWith(effectiveQuery);
          if (aStarts !== bStarts) return aStarts ? -1 : 1;
          return a.label.localeCompare(b.label, "pt-BR");
        })
        .slice(0, 80);
    }, [open, options, query, selectedLabel]);

    const emitChange = (nextValue: string) => {
      const target = {
        value: nextValue,
        name: name || "",
      } as HTMLSelectElement;
      onChange?.({
        target,
        currentTarget: target,
      } as React.ChangeEvent<HTMLSelectElement>);
    };

    const chooseOption = (option: SelectOption) => {
      setQuery(option.label);
      setOpen(false);
      setActiveIndex(0);
      emitChange(option.value);
    };

    const closeAndRestore = () => {
      window.setTimeout(() => {
        setOpen(false);
        setQuery(selectedLabel);
      }, 140);
    };

    if (!searchable) {
      return (
        <div className="flex w-full flex-col gap-2">
          {label && (
            <label
              htmlFor={generatedId}
              className="block text-[11px] font-bold tracking-[0.01em] text-zinc-700 dark:text-zinc-300"
            >
              {label}
            </label>
          )}
          <select
            id={generatedId}
            ref={ref}
            value={value}
            defaultValue={defaultValue}
            onChange={onChange}
            onBlur={onBlur}
            onFocus={onFocus}
            disabled={disabled}
            required={required}
            name={name}
            className={`min-h-10 w-full cursor-pointer rounded-xl border border-[#dbe4f0] bg-white/95 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#155eef] focus:ring-4 focus:ring-[#155eef]/18 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 ${error ? "border-danger" : ""} ${className}`}
            {...nativeProps}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {error && (
            <span className="text-xs font-semibold text-danger">{error}</span>
          )}
        </div>
      );
    }

    return (
      <div className="flex w-full flex-col gap-2">
        {label && (
          <label
            htmlFor={generatedId}
            className="block text-[11px] font-bold tracking-[0.01em] text-zinc-700 dark:text-zinc-300"
          >
            {label}
          </label>
        )}

        <div className="relative w-full">
          <select
            ref={ref}
            tabIndex={-1}
            aria-hidden="true"
            value={currentValue}
            onChange={() => undefined}
            disabled={disabled}
            name={name}
            className="pointer-events-none absolute h-px w-px opacity-0"
            {...nativeProps}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <Search
            size={15}
            className={`pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 ${open ? "text-[#1d4ed8]" : "text-slate-400"}`}
          />
          <input
            id={generatedId}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={`${generatedId}-listbox`}
            aria-activedescendant={
              open && filteredOptions[activeIndex]
                ? `${generatedId}-option-${activeIndex}`
                : undefined
            }
            autoComplete="off"
            disabled={disabled}
            required={required && !currentValue}
            placeholder={searchPlaceholder}
            value={query}
            onFocus={(event) => {
              setOpen(true);
              setActiveIndex(
                Math.max(
                  0,
                  options.findIndex((option) => option.value === currentValue),
                ),
              );
              event.currentTarget.select();
              onFocus?.(
                event as unknown as React.FocusEvent<HTMLSelectElement>,
              );
            }}
            onBlur={(event) => {
              closeAndRestore();
              onBlur?.(event as unknown as React.FocusEvent<HTMLSelectElement>);
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setOpen(true);
                setActiveIndex((current) =>
                  Math.min(
                    current + 1,
                    Math.max(0, filteredOptions.length - 1),
                  ),
                );
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((current) => Math.max(0, current - 1));
              } else if (
                event.key === "Enter" &&
                open &&
                filteredOptions[activeIndex]
              ) {
                event.preventDefault();
                chooseOption(filteredOptions[activeIndex]);
              } else if (event.key === "Escape") {
                setOpen(false);
                setQuery(selectedLabel);
              }
            }}
            className={`min-h-10 w-full rounded-xl border border-[#dbe4f0] bg-white/95 py-2 pl-9 pr-9 text-sm text-slate-900 shadow-[inset_0_1px_1px_rgba(15,23,42,.025)] outline-none transition-all duration-200 placeholder:text-slate-400 hover:border-[#93b4e8] focus:border-[#155eef] focus:ring-4 focus:ring-[#155eef]/18 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-600 dark:focus:border-[#155eef] ${error ? "border-danger focus:border-danger focus:ring-danger/20" : ""} ${className}`}
          />
          <ChevronDown
            size={15}
            className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-transform ${open ? "rotate-180 text-[#1d4ed8]" : ""}`}
          />

          {open && !disabled && (
            <div className="absolute left-0 right-0 z-[100] mt-2 overflow-hidden rounded-2xl border border-[#dbe4f0] bg-white shadow-[0_20px_55px_rgba(15,23,42,.18)] dark:border-zinc-700 dark:bg-zinc-900">
              <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-[10px] font-bold text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-400">
                <span>{filteredOptions.length} resultado(s)</span>
                <span>Digite para filtrar</span>
              </div>
              <div
                id={`${generatedId}-listbox`}
                role="listbox"
                className="max-h-64 overflow-y-auto p-1.5"
              >
                {filteredOptions.length ? (
                  filteredOptions.map((option, index) => {
                    const selected = option.value === currentValue;
                    const active = index === activeIndex;
                    return (
                      <button
                        id={`${generatedId}-option-${index}`}
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onMouseDown={(event) => event.preventDefault()}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => chooseOption(option)}
                        className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-xs transition-colors ${active ? "bg-blue-50 text-blue-800 dark:bg-blue-500/15 dark:text-blue-200" : "text-slate-700 hover:bg-slate-50 dark:text-zinc-200 dark:hover:bg-zinc-800"}`}
                      >
                        <span className="min-w-0 flex-1 truncate font-semibold">
                          {option.label}
                        </span>
                        {selected && (
                          <Check
                            size={15}
                            className="shrink-0 text-[#1d4ed8]"
                          />
                        )}
                      </button>
                    );
                  })
                ) : (
                  <div className="px-4 py-8 text-center">
                    <Search size={20} className="mx-auto text-slate-300" />
                    <p className="mt-2 text-xs font-bold text-slate-700 dark:text-zinc-200">
                      {emptyMessage}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      Tente escrever somente parte do nome ou código.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {error && (
          <span className="text-xs font-semibold text-danger animate-in fade-in duration-150">
            {error}
          </span>
        )}
      </div>
    );
  },
);

Select.displayName = "Select";
