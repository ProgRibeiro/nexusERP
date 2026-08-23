"use client";

import React from "react";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "primary" | "success" | "warning" | "danger" | "neutral" | "info";
  size?: "sm" | "md";
}

export function Badge({
  children,
  variant = "neutral",
  size = "md",
  className = "",
  ...props
}: BadgeProps) {
  const baseStyle =
    "inline-flex items-center justify-center font-semibold rounded-full uppercase tracking-wide select-none";

  const variants = {
    primary:
      "bg-[#155eef]/16 text-[#1d4ed8] dark:text-[#93c5fd] border border-[#155eef]/35",
    success: "bg-success/10 text-success border border-success/20",
    warning: "bg-warning/10 text-warning border border-warning/20",
    danger: "bg-danger/10 text-danger border border-danger/20",
    neutral:
      "bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border border-zinc-500/25",
    info: "bg-[#dbeafe]/35 text-[#1d4ed8] dark:bg-[#102a50] dark:text-[#93c5fd] border border-[#155eef]/30",
  };

  const sizes = {
    sm: "px-2 py-0.5 text-[9px]",
    md: "px-2.5 py-0.5 text-[10px]",
  };

  return (
    <span
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
