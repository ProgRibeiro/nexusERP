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
        className={`relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl flex flex-col z-10 ${panelClassName}`}
      >
        <div className="px-5 py-4 border-b border-zinc-150 dark:border-zinc-800 flex items-center justify-between shrink-0">
          <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-50">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-250 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
