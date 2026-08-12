"use client";

import { useEffect } from "react";

const RECOVERY_KEY = "nx_chunk_recovery";
const STALE_PATTERNS = [
  "module factory is not available",
  "failed to fetch dynamically imported module",
  "loading chunk",
  "chunkloaderror",
  "was instantiated because it was required from module",
];

function staleMessage(value: unknown) {
  const message = value instanceof Error ? `${value.name} ${value.message}` : String(value || "");
  return STALE_PATTERNS.some((pattern) => message.toLowerCase().includes(pattern));
}

export default function StaleChunkRecovery() {
  useEffect(() => {
    const recover = async () => {
      const previous = Number(sessionStorage.getItem(RECOVERY_KEY) || 0);
      if (Date.now() - previous < 30_000) return;
      sessionStorage.setItem(RECOVERY_KEY, String(Date.now()));
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter((key) => key.startsWith("nx-erp-")).map((key) => caches.delete(key)));
      }
      window.location.reload();
    };
    const onError = (event: ErrorEvent) => { if (staleMessage(event.error || event.message)) void recover(); };
    const onRejection = (event: PromiseRejectionEvent) => { if (staleMessage(event.reason)) void recover(); };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
