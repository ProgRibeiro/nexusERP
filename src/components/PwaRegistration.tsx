"use client";

import { useEffect, useState } from "react";
import { RefreshCw, WifiOff, X } from "lucide-react";

export default function PwaRegistration() {
  const [offline, setOffline] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    const syncConnection = () => setOffline(!navigator.onLine);
    const initialTimer = window.setTimeout(syncConnection, 0);
    window.addEventListener("online", syncConnection);
    window.addEventListener("offline", syncConnection);

    if (!("serviceWorker" in navigator)) {
      return () => {
        window.clearTimeout(initialTimer);
        window.removeEventListener("online", syncConnection);
        window.removeEventListener("offline", syncConnection);
      };
    }

    let firstController = navigator.serviceWorker.controller;
    let updateTimer: number | undefined;
    const handleControllerChange = () => {
      if (firstController) setUpdateReady(true);
      firstController = navigator.serviceWorker.controller;
    };
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await registration.update();
        // Mantém abas deixadas abertas alinhadas com novas publicações.
        updateTimer = window.setInterval(() => void registration.update(), 60_000);
      } catch (error) {
        console.warn("Não foi possível registrar o aplicativo instalável.", error);
      }
    };

    if (document.readyState === "complete") void register();
    else window.addEventListener("load", register, { once: true });
    return () => {
      window.clearTimeout(initialTimer);
      window.removeEventListener("online", syncConnection);
      window.removeEventListener("offline", syncConnection);
      window.removeEventListener("load", register);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      if (updateTimer) window.clearInterval(updateTimer);
    };
  }, []);

  return (
    <>
      {offline && (
        <div className="fixed inset-x-3 top-[max(.75rem,env(safe-area-inset-top))] z-[100] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 shadow-xl print:hidden dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100" role="status">
          <WifiOff size={18} className="shrink-0" />
          <div className="min-w-0 flex-1"><p className="text-xs font-black">Modo sem conexão</p><p className="text-[10px] leading-relaxed opacity-80">Os dados do servidor voltarão quando a rede for restabelecida.</p></div>
        </div>
      )}
      {updateReady && !offline && (
        <div className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] left-3 right-3 z-[100] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-blue-200 bg-white px-4 py-3 text-zinc-900 shadow-2xl print:hidden dark:border-blue-900 dark:bg-zinc-900 dark:text-white xl:bottom-5" role="status">
          <RefreshCw size={18} className="shrink-0 text-blue-600" />
          <div className="min-w-0 flex-1"><p className="text-xs font-black">Atualização instalada</p><p className="text-[10px] text-zinc-500">Reabra o ERP para usar a versão mais recente.</p></div>
          <button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-blue-600 px-3 py-2 text-[10px] font-black text-white">Atualizar</button>
          <button type="button" onClick={() => setUpdateReady(false)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100" aria-label="Fechar aviso"><X size={14} /></button>
        </div>
      )}
    </>
  );
}
