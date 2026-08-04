"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, Download, MonitorSmartphone, ShieldCheck, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export default function PwaInstallButton() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isSecure, setIsSecure] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    const initialStateTimer = window.setTimeout(() => {
      setIsInstalled(standalone);
      setIsSecure(window.isSecureContext);
    }, 0);

    const handlePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
      setShowGuide(false);
    };

    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.clearTimeout(initialStateTimer);
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  useEffect(() => {
    if (!showGuide) return;
    const closeOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setShowGuide(false);
    };
    document.addEventListener("mousedown", closeOutside);
    return () => document.removeEventListener("mousedown", closeOutside);
  }, [showGuide]);

  const install = async () => {
    if (!installPrompt) {
      setShowGuide((current) => !current);
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstallPrompt(null);
  };

  if (isInstalled) {
    return (
      <span className="hidden 2xl:flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[10px] font-bold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-400">
        <Check size={14} /> App instalado
      </span>
    );
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={install}
        className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2 text-xs font-bold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/35 dark:text-blue-300 dark:hover:bg-blue-950/55"
        title="Instalar NX ERP como aplicativo"
      >
        <Download size={15} />
        <span className="hidden 2xl:inline">Instalar aplicativo</span>
      </button>

      {showGuide && (
        <div className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start gap-3 bg-gradient-to-r from-slate-950 to-blue-950 p-4 text-white">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/20 ring-1 ring-blue-300/25">
              <MonitorSmartphone size={20} className="text-blue-200" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black">Use o ERP como aplicativo</p>
              <p className="mt-1 text-[11px] leading-relaxed text-blue-100/75">A mesma base de dados, em janela própria no computador e na tela inicial do Android.</p>
            </div>
            <button type="button" onClick={() => setShowGuide(false)} className="rounded-lg p-1 text-blue-100/70 hover:bg-white/10 hover:text-white" aria-label="Fechar">
              <X size={16} />
            </button>
          </div>
          <div className="space-y-3 p-4 text-xs text-zinc-600 dark:text-zinc-300">
            <div>
              <p className="font-black text-zinc-900 dark:text-white">No computador</p>
              <p className="mt-1 leading-relaxed">Abra no Chrome ou Edge e use o ícone de instalação da barra de endereço.</p>
            </div>
            <div>
              <p className="font-black text-zinc-900 dark:text-white">No Android</p>
              <p className="mt-1 leading-relaxed">Abra no Chrome, toque em ⋮ e escolha <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.</p>
            </div>
            {!isSecure && (
              <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-300">
                <ShieldCheck size={16} className="mt-0.5 shrink-0" />
                <p className="leading-relaxed">A instalação no celular será habilitada quando o servidor Linux estiver com HTTPS configurado.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
