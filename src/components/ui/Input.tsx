"use client";

import React, { forwardRef } from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className = "", id, ...props }, ref) => {
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
        <div className="relative flex items-center">
          {icon && (
            <div className="absolute left-3 text-zinc-400 pointer-events-none flex items-center justify-center">
              {icon}
            </div>
          )}
          <input
            id={generatedId}
            ref={ref}
            className={`min-h-10 w-full rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-sm text-slate-900 shadow-[inset_0_1px_1px_rgba(15,23,42,.025)] outline-none transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-600 dark:focus:border-blue-600 ${
              icon ? "pl-9" : ""
            } ${error ? "border-danger focus:ring-danger/20 focus:border-danger" : ""} ${className}`}
            {...props}
          />
        </div>
        {error && (
          <span className="text-xs font-semibold text-danger animate-in fade-in duration-150">
            {error}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
