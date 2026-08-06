"use client";

import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "flat" | "bordered";
  hoverable?: boolean;
}

export function Card({
  children,
  variant = "default",
  hoverable = false,
  className = "",
  ...props
}: CardProps) {
  const baseStyle = "p-6 rounded-[22px] transition-all duration-200";

  const variants = {
    default: "bg-white/95 dark:bg-zinc-900/95 border border-slate-200/80 dark:border-zinc-800 shadow-premium ring-1 ring-white/70 dark:ring-white/[.03]",
    flat: "bg-slate-50/80 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800/70",
    bordered: "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-750 ring-1 ring-slate-100 dark:ring-zinc-800"
  };

  const hoverEffect = hoverable
    ? "hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_16px_36px_rgba(15,23,42,.09)] dark:hover:border-blue-900 cursor-pointer"
    : "";

  return (
    <div
      className={`${baseStyle} ${variants[variant]} ${hoverEffect} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
