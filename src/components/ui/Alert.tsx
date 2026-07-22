"use client";

import React from "react";
import { Info, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

interface AlertProps {
  children: React.ReactNode;
  variant?: "info" | "warning" | "success" | "danger";
  className?: string;
}

export function Alert({ children, variant = "info", className = "" }: AlertProps) {
  const icons = {
    info: <Info className="text-primary shrink-0" size={16} />,
    warning: <AlertTriangle className="text-warning shrink-0" size={16} />,
    success: <CheckCircle className="text-success shrink-0" size={16} />,
    danger: <XCircle className="text-danger shrink-0" size={16} />
  };

  const backgrounds = {
    info: "bg-primary/5 border-primary/20 text-zinc-800 dark:text-zinc-200",
    warning: "bg-warning/5 border-warning/20 text-zinc-800 dark:text-zinc-200",
    success: "bg-success/5 border-success/20 text-zinc-800 dark:text-zinc-200",
    danger: "bg-danger/5 border-danger/20 text-zinc-800 dark:text-zinc-200"
  };

  return (
    <div className={`p-4 rounded-xl border flex gap-3 text-xs font-semibold leading-relaxed ${backgrounds[variant]} ${className}`}>
      {icons[variant]}
      <div className="flex-1">{children}</div>
    </div>
  );
}
