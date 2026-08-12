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
    default:
      "bg-white/95 dark:bg-zinc-900/95 border border-[#e6dfcf] dark:border-zinc-800 shadow-premium ring-1 ring-[#f2ecde]/85 dark:ring-white/[.03]",
    flat: "bg-[#f8f4ea]/80 dark:bg-zinc-800/40 border border-[#ece3d2] dark:border-zinc-800/70",
    bordered:
      "bg-white dark:bg-zinc-900 border border-[#ded6c2] dark:border-zinc-750 ring-1 ring-[#efe7d7] dark:ring-zinc-800",
  };

  const hoverEffect = hoverable
    ? "hover:-translate-y-0.5 hover:border-[#d4af37]/45 hover:shadow-[0_16px_36px_rgba(86,64,7,.17)] dark:hover:border-[#d4af37]/45 cursor-pointer"
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
