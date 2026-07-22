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
  const baseStyle = "p-6 rounded-2xl transition-colors duration-150";

  const variants = {
    default: "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-premium",
    flat: "bg-zinc-50 dark:bg-zinc-800/40",
    bordered: "bg-white dark:bg-zinc-900 border-2 border-zinc-150 dark:border-zinc-800"
  };

  const hoverEffect = hoverable
    ? "hover:border-zinc-300 dark:hover:border-zinc-700 cursor-pointer"
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
