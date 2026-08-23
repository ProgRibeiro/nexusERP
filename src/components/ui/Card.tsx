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
  const baseStyle = "p-5 rounded-2xl transition-all duration-200";

  const variants = {
    default:
      "bg-white/95 dark:bg-zinc-900/95 border border-[#e2e8f0] dark:border-zinc-800 shadow-premium ring-1 ring-[#f1f5f9]/85 dark:ring-white/[.03]",
    flat: "bg-[#f8fafc]/80 dark:bg-zinc-800/40 border border-[#e2e8f0] dark:border-zinc-800/70",
    bordered:
      "bg-white dark:bg-zinc-900 border border-[#dbe4f0] dark:border-zinc-750 ring-1 ring-[#e2e8f0] dark:ring-zinc-800",
  };

  const hoverEffect = hoverable
    ? "hover:-translate-y-0.5 hover:border-[#155eef]/45 hover:shadow-[0_16px_36px_rgba(37,99,235,.17)] dark:hover:border-[#155eef]/45 cursor-pointer"
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
