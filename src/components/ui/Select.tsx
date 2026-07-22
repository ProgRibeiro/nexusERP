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
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={generatedId}
            className="text-xs font-medium text-zinc-500 dark:text-zinc-450 block"
          >
            {label}
          </label>
        )}
        <select
          id={generatedId}
          ref={ref}
          className={`w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-800 dark:text-zinc-150 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors duration-150 cursor-pointer ${
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
