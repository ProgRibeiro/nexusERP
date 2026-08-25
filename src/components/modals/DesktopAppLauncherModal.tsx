"use client";

import React, { useState, useEffect } from "react";
import {
  Monitor,
  CheckCircle2,
  Server,
  Zap,
  ShieldCheck,
  Download,
  Terminal,
  Globe,
  RefreshCw,
  X,
  ExternalLink,
  Laptop,
  Check,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

interface DesktopAppLauncherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DesktopAppLauncherModal({
  isOpen,
  onClose,
}: DesktopAppLauncherModalProps) {
  const { toast } = useToast();
  const [vpsUrl, setVpsUrl] = useState<string>("https://erp.oprestador.tech");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    online: boolean;
    latencyMs?: number;
    dbConnected?: boolean;
    message?: string;
  } | null>(null);

  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedVps = localStorage.getItem("nexus_vps_custom_url");
      if (savedVps) setVpsUrl(savedVps);

      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        Boolean((navigator as any).standalone);
      setIsStandalone(standalone);

      const handleBeforeInstall = (e: Event) => {
        e.preventDefault();
        setInstallPrompt(e);
      };
      window.addEventListener("beforeinstallprompt", handleBeforeInstall);
      return () => {
        window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      };
    }
  }, []);

  const handleTestVpsConnection = async () => {
    if (!vpsUrl.trim()) {
      toast("Informe a URL da VPS para testar.", "warning");
      return;
    }

    setTesting(true);
    setTestResult(null);
    const startTime = performance.now();

    try {
      const targetUrl = vpsUrl.endsWith("/") ? vpsUrl.slice(0, -1) : vpsUrl;
      const res = await fetch(`${targetUrl}/api/health`, {
        method: "GET",
        cache: "no-store",
      });
      const endTime = performance.now();
      const latencyMs = Math.round(endTime - startTime);

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setTestResult({
          online: true,
          latencyMs,
          dbConnected: data.dbConnected ?? true,
          message: "Servidor VPS respondendo com alta performance!",
        });
        toast(`Conexão OK! Resposta da VPS em ${latencyMs}ms`, "success");
      } else {
        setTestResult({
          online: false,
          message: `O servidor VPS respondeu com status ${res.status}.`,
        });
        toast("VPS respondeu com erro.", "error");
      }
    } catch (err: any) {
      setTestResult({
        online: false,
        message: "Não foi possível conectar à VPS. Verifique o IP/Domínio e se o HTTPS está ativo.",
      });
      toast("Erro de conexão com o servidor VPS.", "error");
    } finally {
      setTesting(false);
    }
  };

  const handleSaveVpsUrl = () => {
    if (!vpsUrl.trim()) return;
    localStorage.setItem("nexus_vps_custom_url", vpsUrl.trim());
    toast("Servidor VPS definido como padrão para o Software Desktop!", "success");
  };

  const handleInstallDesktopPwa = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setInstallPrompt(null);
        toast("Software Desktop instalado com sucesso na sua máquina!", "success");
      }
    } else {
      toast(
        "Se o botão não abrir, use o menu do navegador > Mais Ferramentas > Instalar Aplicativo.",
        "info"
      );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🖥️ Software Desktop Nativo & Conexão VPS — Nexus ERP"
      size="lg"
    >
      <div className="space-y-6 text-xs select-none">
        {/* Header Hero */}
        <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 p-5 text-white shadow-xl relative overflow-hidden">
          <div className="flex items-start gap-4 relative z-10">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-500/20 ring-1 ring-blue-400/30 text-blue-400 shadow-inner">
              <Laptop size={28} />
            </div>
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-300 border border-emerald-500/30">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Software Standalone Ativo
              </span>
              <h3 className="text-base font-black tracking-tight text-white">
                Nexus ERP Desktop App & Multi-VPS Server Switcher
              </h3>
              <p className="text-[11px] leading-relaxed text-slate-300">
                Execute o ERP como um programa nativo no Windows, macOS ou Linux. Conecte-se à sua VPS Hostinger na nuvem ou a servidores privados com 1 clique.
              </p>
            </div>
          </div>
        </div>

        {/* 1. SEÇÃO DE CONEXÃO COM A VPS */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm space-y-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white flex items-center gap-2">
              <Server size={16} className="text-blue-600" />
              1. Servidor VPS de Conexão
            </h4>
            {isStandalone && (
              <span className="text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-900">
                Executando no Modo Desktop App
              </span>
            )}
          </div>

          <div className="space-y-3">
            <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
              Endereço IP ou Domínio da VPS (Servidor ERP):
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={vpsUrl}
                onChange={(e) => setVpsUrl(e.target.value)}
                placeholder="https://erp.oprestador.tech"
                className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3.5 py-2.5 font-mono text-xs text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleTestVpsConnection}
                loading={testing}
                className="px-4 text-xs font-bold shrink-0 border-zinc-300 dark:border-zinc-700"
              >
                <Zap size={14} className="mr-1 text-amber-500" />
                Testar VPS
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleSaveVpsUrl}
                className="px-4 text-xs font-bold shrink-0 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              >
                Salvar VPS
              </Button>
            </div>

            {/* Test Result Display */}
            {testResult && (
              <div
                className={`rounded-xl border p-3.5 ${
                  testResult.online
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
                    : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold">
                    {testResult.online ? (
                      <CheckCircle2 size={17} className="text-emerald-600" />
                    ) : (
                      <X size={17} className="text-rose-600" />
                    )}
                    <span>
                      {testResult.online
                        ? "VPS On-line e Operacional!"
                        : "Falha de Conexão com VPS"}
                    </span>
                  </div>
                  {testResult.latencyMs !== undefined && (
                    <span className="font-mono font-black text-xs bg-white/80 dark:bg-black/40 px-2 py-0.5 rounded-lg border border-emerald-400/40">
                      ⚡ Latência: {testResult.latencyMs}ms
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed">
                  {testResult.message}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 2. OPÇÕES DE INSTALAÇÃO E SOFTWARE NATIVO */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Opção A: Instalação Desktop PWA Standalone */}
          <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/50 to-white p-4 shadow-sm dark:border-blue-900/50 dark:from-blue-950/20 dark:to-zinc-900 space-y-3">
            <div className="flex items-center gap-2 text-blue-900 dark:text-blue-300 font-black text-xs uppercase tracking-wider">
              <Monitor size={17} className="text-blue-600" />
              <span>Instalação Desktop 1-Clique</span>
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-300">
              Crie o ícone nativo do software na sua Área de Trabalho e Barra de Tarefas. Funciona sem abas de navegador.
            </p>
            <Button
              type="button"
              variant="primary"
              onClick={handleInstallDesktopPwa}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download size={15} /> Instalar Software Desktop Nativo
            </Button>
          </div>

          {/* Opção B: Pacote Standalone Electron / Desktop Binary */}
          <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50/50 to-white p-4 shadow-sm dark:border-purple-900/50 dark:from-purple-950/20 dark:to-zinc-900 space-y-3">
            <div className="flex items-center gap-2 text-purple-900 dark:text-purple-300 font-black text-xs uppercase tracking-wider">
              <Terminal size={17} className="text-purple-600" />
              <span>Pacote Standalone Electron (.exe)</span>
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-300">
              O projeto possui o script <code>electron-main.js</code> integrado. Empacote executáveis standalone (.exe / .dmg) com 1 comando:
            </p>
            <div className="rounded-xl bg-zinc-950 p-2.5 font-mono text-[10px] text-emerald-400 overflow-x-auto border border-zinc-800">
              npx electron electron-main.js
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 dark:border-zinc-800 pt-4">
          <Button variant="secondary" onClick={onClose} className="px-5 font-bold">
            Fechar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
