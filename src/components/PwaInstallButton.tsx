"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Check,
  Download,
  MonitorSmartphone,
  Share2,
  ShieldCheck,
  Smartphone,
  X,
} from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export default function PwaInstallButton({
  compact = true,
}: {
  compact?: boolean;
}) {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isSecure, setIsSecure] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">(
    "desktop",
  );
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    const initialStateTimer = window.setTimeout(() => {
      setIsInstalled(standalone);
      setIsSecure(window.isSecureContext);
      const agent = navigator.userAgent.toLowerCase();
      const appleMobile =
        /iphone|ipad|ipod/.test(agent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      setPlatform(
        appleMobile ? "ios" : /android/.test(agent) ? "android" : "desktop",
      );
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
      if (panelRef.current && !panelRef.current.contains(event.target as Node))
        setShowGuide(false);
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
      <span
        className={`${compact ? "hidden 2xl:flex" : "inline-flex"} items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[10px] font-bold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-400`}
      >
        <Check size={14} /> App instalado
      </span>
    );
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={install}
        className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs font-bold text-zinc-700 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-blue-500/60 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
        title="Instalar O Prestador como aplicativo"
      >
        <Download size={15} />
        <span className={compact ? "hidden 2xl:inline" : "inline"}>
          Instalar aplicativo
        </span>
      </button>

      {showGuide && (
        <div className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start gap-3 bg-gradient-to-r from-[#0f1013] to-[#232018] p-4 text-white">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/20 ring-1 ring-blue-300/25">
              <MonitorSmartphone size={20} className="text-blue-200" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black">Use o ERP como aplicativo</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
                A mesma base de dados, em tela cheia no Android, iPhone, iPad e
                computador.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
              aria-label="Fechar"
            >
              <X size={16} />
            </button>
          </div>
          <div className="space-y-3 p-4 text-xs text-zinc-600 dark:text-zinc-300">
            {platform === "ios" && (
              <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
                <Share2 size={17} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-black">Neste iPhone ou iPad</p>
                  <p className="mt-1 leading-relaxed">
                    No Safari, toque em <strong>Compartilhar</strong>, depois em{" "}
                    <strong>Adicionar à Tela de Início</strong> e confirme em{" "}
                    <strong>Adicionar</strong>.
                  </p>
                </div>
              </div>
            )}
            {platform === "android" && (
              <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
                <Smartphone size={17} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-black">Neste Android</p>
                  <p className="mt-1 leading-relaxed">
                    No Chrome, toque em <strong>⋮</strong> e escolha{" "}
                    <strong>Instalar aplicativo</strong> ou{" "}
                    <strong>Adicionar à tela inicial</strong>.
                  </p>
                </div>
              </div>
            )}
            <div>
              <p className="font-black text-zinc-900 dark:text-white">
                iPhone e iPad
              </p>
              <p className="mt-1 leading-relaxed">
                Abra no <strong>Safari</strong>, toque em Compartilhar e
                selecione <strong>Adicionar à Tela de Início</strong>.
              </p>
            </div>
            <div>
              <p className="font-black text-zinc-900 dark:text-white">
                No Android
              </p>
              <p className="mt-1 leading-relaxed">
                Abra no Chrome, toque em ⋮ e escolha{" "}
                <strong>Instalar aplicativo</strong> ou{" "}
                <strong>Adicionar à tela inicial</strong>.
              </p>
            </div>
            <div>
              <p className="font-black text-zinc-900 dark:text-white">
                No computador
              </p>
              <p className="mt-1 leading-relaxed">
                Abra no Chrome ou Edge e use o ícone de instalação da barra de
                endereço.
              </p>
            </div>
            {!isSecure && (
              <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-300">
                <ShieldCheck size={16} className="mt-0.5 shrink-0" />
                <p className="leading-relaxed">
                  A instalação no celular será habilitada quando o servidor
                  Linux estiver com HTTPS configurado.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
