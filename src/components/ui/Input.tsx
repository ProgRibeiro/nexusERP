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
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={generatedId}
            className="text-xs font-medium text-zinc-500 dark:text-zinc-450 block"
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
            className={`w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm placeholder-zinc-400 text-zinc-800 dark:text-zinc-150 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors duration-150 ${
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
