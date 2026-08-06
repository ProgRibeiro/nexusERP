"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";

interface OverlayProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Classes for the centering/positioning wrapper (e.g. items-center justify-center vs justify-end) */
  containerClassName: string;
  /** Classes for the panel itself (size, radius, entry animation) */
  panelClassName: string;
}

/**
 * Shared chrome for Modal and Drawer: backdrop scrim, scroll-lock, Escape-to-close,
 * and the header (title + close button). Modal/Drawer only differ in positioning.
 */
export function Overlay({ isOpen, onClose, title, children, containerClassName, panelClassName }: OverlayProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 flex ${containerClassName}`}>
      <div
        className="fixed inset-0 overlay-scrim animate-in fade-in duration-150"
        onClick={onClose}
      />
      <div
        className={`relative z-10 flex flex-col border border-white/80 bg-white/[.98] shadow-[0_35px_90px_rgba(2,8,23,.28)] ring-1 ring-slate-950/5 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/[.98] dark:ring-white/5 ${panelClassName}`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200/80 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] px-5 py-[18px] dark:border-zinc-800 dark:bg-none dark:bg-zinc-900">
          <div className="flex items-center gap-3"><span className="h-8 w-1 rounded-full bg-gradient-to-b from-blue-500 to-cyan-400" /><h3 className="text-base font-black tracking-tight text-zinc-950 dark:text-white">{title}</h3></div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-zinc-400 shadow-sm transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-red-900 dark:hover:bg-red-950/30"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
