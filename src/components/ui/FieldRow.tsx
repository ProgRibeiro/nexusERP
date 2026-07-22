"use client";

import React from "react";

interface FieldRowProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Label/value pair used across detail views and drawers (e.g. GlobalDrawer).
 * Extracted because the label+value markup was duplicated ~15x with slight
 * variations before this component existed.
 */
export function FieldRow({ label, children, className = "" }: FieldRowProps) {
  return (
    <div className={`text-xs ${className}`}>
      <span className="text-zinc-450 font-medium block mb-0.5 text-[10px] uppercase tracking-wide">{label}</span>
      <span className="font-semibold text-zinc-800 dark:text-zinc-200">{children}</span>
    </div>
  );
}
