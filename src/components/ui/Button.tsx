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
  const baseStyle = "inline-flex items-center justify-center font-bold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] cursor-pointer whitespace-nowrap";

  const variants = {
    primary: "bg-[#d4af37] hover:bg-[#c79d28] text-[#121317] shadow-[0_10px_22px_rgba(212,175,55,.28)] hover:shadow-[0_12px_28px_rgba(212,175,55,.36)] focus:ring-[#d4af37]/35",
    secondary: "bg-white/95 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-[#ded6c2] dark:border-zinc-700 shadow-sm hover:border-[#d4af37]/60 hover:bg-[#f8f0db] hover:text-[#755a16] dark:hover:border-[#d4af37]/50 dark:hover:bg-[#2f2715] dark:hover:text-[#f1d37d] focus:ring-[#d4af37]/20",
    success: "bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_7px_16px_rgba(16,185,129,.18)] focus:ring-success/40",
    warning: "bg-warning hover:bg-warning/90 text-white focus:ring-warning/40",
    danger: "bg-danger hover:bg-danger/90 text-white focus:ring-danger/40",
    ghost: "text-zinc-650 dark:text-zinc-400 hover:bg-[#f7edd1] dark:hover:bg-[#2d2513] hover:text-[#6f5411] dark:hover:text-[#ebcf79] focus:ring-[#d4af37]/25"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs gap-1.5 h-9",
    md: "px-4 py-2 text-sm gap-2 h-10",
    lg: "px-5 py-2.5 text-sm gap-2.5 h-12"
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
