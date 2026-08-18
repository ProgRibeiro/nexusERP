"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, Wrench, ArrowRight } from "lucide-react";

export function ProviderHeader({ compact = false }: { compact?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#08090b]/90 backdrop-blur-xl transition-all">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
        <Link href="/portal/prestador" className="flex items-center gap-3.5 group">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#d4af37] to-[#8d701a] p-0.5 shadow-lg shadow-[#d4af37]/20 group-hover:scale-105 transition-transform">
            <Image
              src="/icons/icon-192.png"
              alt="Nexus ERP"
              width={40}
              height={40}
              className="h-full w-full rounded-[14px] object-cover"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black tracking-[.22em] text-white">NEXUS</span>
              <span className="rounded-full bg-[#d4af37]/20 border border-[#d4af37]/30 px-2 py-0.5 text-[9px] font-black uppercase text-[#e0bf59]">
                TÉCNICO & PARCEIRO
              </span>
            </div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-zinc-400">
              Portal do Prestador
            </p>
          </div>
        </Link>

        {!compact && (
          <nav className="flex items-center gap-3">
            <Link
              href="/portal/prestador/login"
              className="rounded-xl px-4 py-2.5 text-xs font-bold text-zinc-300 transition hover:bg-white/10 hover:text-white"
            >
              Entrar
            </Link>
            <Link
              href="/portal/prestador/cadastro"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b88d1b] px-4 py-2.5 text-xs font-black text-black shadow-md shadow-[#d4af37]/20 transition hover:opacity-95"
            >
              <span>Criar Acesso</span>
              <ArrowRight size={14} />
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
