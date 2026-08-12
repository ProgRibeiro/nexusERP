"use client";

import { useEffect } from "react";

/**
 * Reduz efeitos caros somente quando o navegador detecta travamentos reais.
 * O modo leve sai automaticamente depois de alguns segundos de estabilidade.
 */
export default function AdaptivePerformance() {
  useEffect(() => {
    const root = document.documentElement;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const constrainedDevice = (navigator.hardwareConcurrency || 4) <= 4 || connection?.saveData;
    let recoveryTimer: number | undefined;
    let longTaskCount = 0;

    const enableLiteMode = () => {
      root.classList.add("performance-lite");
      window.clearTimeout(recoveryTimer);
      recoveryTimer = window.setTimeout(() => {
        root.classList.remove("performance-lite");
        longTaskCount = 0;
      }, 7000);
    };

    if (constrainedDevice) enableLiteMode();

    const observer = "PerformanceObserver" in window
      ? new PerformanceObserver((list) => {
          longTaskCount += list.getEntries().filter((entry) => entry.duration >= 80).length;
          if (longTaskCount >= 2) enableLiteMode();
        })
      : null;

    try {
      observer?.observe({ type: "longtask", buffered: true });
    } catch {
      // Navegadores sem suporte a longtask continuam com o modo normal.
    }

    return () => {
      observer?.disconnect();
      window.clearTimeout(recoveryTimer);
      root.classList.remove("performance-lite");
    };
  }, []);

  return null;
}
