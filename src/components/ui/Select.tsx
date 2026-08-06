"use client";

import React, { forwardRef } from "react";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, error, className = "", id, ...props }, ref) => {
    const fallbackId = React.useId();
    const generatedId = id || fallbackId;

    return (
      <div className="w-full flex flex-col gap-2">
        {label && (
          <label
            htmlFor={generatedId}
            className="block text-[11px] font-bold tracking-[0.01em] text-slate-600 dark:text-zinc-400"
          >
            {label}
          </label>
        )}
        <select
          id={generatedId}
          ref={ref}
          className={`min-h-10 w-full cursor-pointer rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-sm text-slate-900 shadow-[inset_0_1px_1px_rgba(15,23,42,.025)] outline-none transition-all duration-200 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-600 dark:focus:border-blue-600 ${
            error ? "border-danger focus:ring-danger/20 focus:border-danger" : ""
          } ${className}`}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100">
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <span className="text-xs font-semibold text-danger animate-in fade-in duration-150">
            {error}
          </span>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";
