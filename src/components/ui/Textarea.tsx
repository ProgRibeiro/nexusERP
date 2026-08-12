"use client";

import React from "react";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function Textarea({
  label,
  hint,
  error,
  className = "",
  id,
  ...props
}: TextareaProps) {
  const fieldId =
    id ||
    (label
      ? `textarea-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
      : undefined);
  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={fieldId}
          className="block text-xs font-bold text-[#6d685b] dark:text-[#b6ac95]"
        >
          {label}
        </label>
      )}
      <textarea
        id={fieldId}
        className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:ring-2 dark:bg-zinc-900 dark:text-zinc-100 ${error ? "border-red-400 focus:border-red-500 focus:ring-red-500/15" : "border-[#ded6c2] hover:border-[#ceb978] focus:border-[#d4af37] focus:ring-[#d4af37]/20 dark:border-zinc-800 dark:focus:border-[#d4af37]"} ${className}`}
        {...props}
      />
      {(error || hint) && (
        <p
          className={`text-[10px] ${error ? "font-semibold text-red-600" : "text-zinc-500"}`}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
}
