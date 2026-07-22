"use client";

import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "success" | "warning" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const baseStyle = "inline-flex items-center justify-center font-semibold rounded-lg transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-background disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] cursor-pointer";

  const variants = {
    primary: "bg-primary hover:bg-primary-hover text-white focus:ring-primary/40",
    secondary: "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-750 focus:ring-zinc-500/30",
    success: "bg-success hover:bg-success/90 text-white focus:ring-success/40",
    warning: "bg-warning hover:bg-warning/90 text-white focus:ring-warning/40",
    danger: "bg-danger hover:bg-danger/90 text-white focus:ring-danger/40",
    ghost: "text-zinc-650 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 hover:text-zinc-900 dark:hover:text-white focus:ring-zinc-400/20"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs gap-1.5 h-8",
    md: "px-3.5 py-2 text-sm gap-2 h-9",
    lg: "px-5 py-2.5 text-sm gap-2.5 h-11"
  };

  return (
    <button
      disabled={disabled || loading}
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : null}
      {children}
    </button>
  );
}
