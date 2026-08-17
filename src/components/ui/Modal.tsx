"use client";

import React, { useEffect, useState } from "react";
import { Overlay } from "./Overlay";
import { Layers3, X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "md" | "lg" | "xl";
}

export function Modal({ isOpen, onClose, title, children, size = "md" }: ModalProps) {
  const [minimized, setMinimized] = useState(false);
  useEffect(() => { if (!isOpen) setMinimized(false); }, [isOpen]);
  const sizeClass = {
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  }[size];

  if (isOpen && minimized) return <div className="fixed bottom-20 right-4 z-52 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-2xl border border-[#d4af37]/30 bg-zinc-950/95 p-2 shadow-2xl backdrop-blur-md xl:bottom-5"><button type="button" onClick={() => setMinimized(false)} className="flex min-w-0 items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-zinc-200 hover:bg-white/10"><Layers3 size={14} className="shrink-0 text-[#d4af37]"/><span className="max-w-52 truncate">{title}</span></button><button type="button" onClick={onClose} className="rounded-xl p-2 text-zinc-500 hover:bg-red-500/10 hover:text-red-300" aria-label={`Fechar ${title}`}><X size={14}/></button></div>;

  return (
    <Overlay
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      onMinimize={() => setMinimized(true)}
      containerClassName="items-center justify-center p-4"
      panelClassName={`w-full ${sizeClass} rounded-[24px] max-h-[88vh] animate-in zoom-in-95 duration-200`}
    >
      {children}
    </Overlay>
  );
}
