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
  PackageCheck,
  Cpu,
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

  const handleDownloadBatInstaller = () => {
    try {
      const link = document.createElement("a");
      link.href = "/api/desktop-app/download?type=installer_bat";
      link.download = "Instalar_NexusERP_Desktop.bat";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast(
        "Download do Instalador Automático (1-Clique .bat) iniciado! Execute o arquivo baixado para pré-configurar tudo.",
        "success"
      );
    } catch {
      toast("Erro ao baixar o instalador automático.", "error");
    }
  };

  const handleDownloadDesktopPackage = async () => {
    try {
      const res = await fetch("/api/desktop-app/download");
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      const blob = new Blob([data.files["nexus_erp_desktop.py"]], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "nexus_erp_desktop.py";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast("Download do Software Nativo Python concluído com sucesso!", "success");
    } catch {
      toast("Erro ao baixar o pacote desktop.", "error");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🖥️ Software Desktop Nativo Pré-Configurado — Nexus ERP"
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
                Instalação Padrão Automática Pré-Configurada (Windows/Mac/Linux)
              </span>
              <h3 className="text-base font-black tracking-tight text-white">
                Nexus ERP Desktop Suite — Instalador de 1-Clique
              </h3>
              <p className="text-[11px] leading-relaxed text-slate-300">
                Baixe o instalador oficial. Ele configura automaticamente o servidor VPS Cloud, cria os atalhos na Área de Trabalho e registra o protocolo nativo <code className="bg-slate-800 px-1 py-0.5 rounded text-blue-300">nexus-erp://</code> no seu sistema.
              </p>
            </div>
          </div>
        </div>

        {/* 1. INSTALADOR DESTACADO EM 1-CLIQUE */}
        <div className="rounded-2xl border-2 border-emerald-500 bg-gradient-to-br from-emerald-500/10 via-emerald-950/20 to-slate-900 p-5 shadow-lg relative overflow-hidden space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PackageCheck size={22} className="text-emerald-400" />
              <div>
                <h4 className="text-sm font-black uppercase tracking-wide text-white">
                  ⭐ Instalador Automático Padrão (Recomendado)
                </h4>
                <p className="text-[11px] text-emerald-200/90">
                  Instala tudo, cria atalho na Área de Trabalho, Menu Iniciar e já vem 100% pré-configurado!
                </p>
              </div>
            </div>
            <span className="bg-emerald-500 text-slate-950 font-black text-[10px] uppercase px-2.5 py-1 rounded-full shadow-sm">
              1-Clique
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
            <div className="bg-slate-900/80 rounded-xl p-3 border border-emerald-500/20 text-slate-200">
              <span className="font-bold text-emerald-400 flex items-center gap-1 mb-1">
                <Check size={14} /> Pré-configurado
              </span>
              Conecta direto na VPS Cloud (https://erp.oprestador.tech) sem precisar digitar IP.
            </div>
            <div className="bg-slate-900/80 rounded-xl p-3 border border-emerald-500/20 text-slate-200">
              <span className="font-bold text-emerald-400 flex items-center gap-1 mb-1">
                <Check size={14} /> Atalho Automático
              </span>
              Cria o ícone &quot;Nexus ERP Enterprise&quot; na sua Área de Trabalho e Menu Iniciar.
            </div>
            <div className="bg-slate-900/80 rounded-xl p-3 border border-emerald-500/20 text-slate-200">
              <span className="font-bold text-emerald-400 flex items-center gap-1 mb-1">
                <Check size={14} /> Protocolo Nativo
              </span>
              Registra <code className="text-blue-300">nexus-erp://</code> para abrir links do ERP direto no aplicativo.
            </div>
          </div>

          <Button
            type="button"
            variant="primary"
            onClick={handleDownloadBatInstaller}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs py-3 shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-all transform hover:-translate-y-0.5"
          >
            <Download size={18} /> Baixar Instalador Automático Windows (Instalar_NexusERP_Desktop.bat)
          </Button>
        </div>

        {/* 2. SEÇÃO DE CONFIGURAÇÃO MANUAL DA VPS */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm space-y-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white flex items-center gap-2">
              <Server size={16} className="text-blue-600" />
              Configuração Personalizada do Servidor VPS
            </h4>
            {isStandalone && (
              <span className="text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-900">
                Modo Desktop Nativo Ativo
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

        {/* 3. OUTRAS OPÇÕES DE SOFTWARE NATIVO */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Opção A: Executável Nativo Python / C */}
          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-white p-4 shadow-sm dark:border-emerald-900/50 dark:from-emerald-950/20 dark:to-zinc-900 space-y-3">
            <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-300 font-black text-xs uppercase tracking-wider">
              <Terminal size={17} className="text-emerald-600" />
              <span>Script Nativo Python (.py)</span>
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-300">
              Baixe o código-fonte executável em <strong>Python</strong> com lançadores nativos em <strong>C</strong> e <strong>Java Enterprise</strong>.
            </p>
            <Button
              type="button"
              variant="secondary"
              onClick={handleDownloadDesktopPackage}
              className="w-full font-bold py-2.5 shadow-sm flex items-center justify-center gap-2 cursor-pointer border-zinc-300 dark:border-zinc-700"
            >
              <Download size={15} /> Baixar Script Nativo (.py)
            </Button>
          </div>

          {/* Opção B: Instalação PWA Standalone 1-Clique */}
          <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/50 to-white p-4 shadow-sm dark:border-blue-900/50 dark:from-blue-950/20 dark:to-zinc-900 space-y-3">
            <div className="flex items-center gap-2 text-blue-900 dark:text-blue-300 font-black text-xs uppercase tracking-wider">
              <Monitor size={17} className="text-blue-600" />
              <span>Instalação PWA Desktop</span>
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-300">
              Instale o aplicativo diretamente na sua Área de Trabalho e Barra de Tarefas via Web App sem abas do navegador.
            </p>
            <Button
              type="button"
              variant="secondary"
              onClick={handleInstallDesktopPwa}
              className="w-full font-bold py-2.5 shadow-sm flex items-center justify-center gap-2 cursor-pointer border-zinc-300 dark:border-zinc-700"
            >
              <Download size={15} /> Instalar Web App Standalone
            </Button>
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
