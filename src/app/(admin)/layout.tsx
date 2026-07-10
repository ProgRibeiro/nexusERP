"use client";

import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Loader2 } from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, user } = useAuth();

  // Exibe um loader premium durante o carregamento inicial dos perfis
  if (loading) {
    return (
      <div className="h-screen w-screen bg-zinc-50 flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
        <p className="text-sm font-semibold text-zinc-500 tracking-wide animate-pulse">
          Carregando ERP Antigravity...
        </p>
      </div>
    );
  }

  // Se por algum motivo o usuário não estiver inicializado
  if (!user) {
    return (
      <div className="h-screen w-screen bg-zinc-50 flex flex-col items-center justify-center gap-2">
        <p className="text-red-500 font-bold">Erro de Autenticação</p>
        <p className="text-sm text-zinc-500">Nenhum perfil de simulação ativo.</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-zinc-50 overflow-hidden font-sans antialiased text-zinc-800">
      {/* Sidebar de Navegação */}
      <Sidebar />

      {/* Container Principal */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Topbar / Cabeçalho */}
        <Header />

        {/* Workspace da Tela */}
        <main className="flex-1 overflow-y-auto p-6 bg-zinc-50">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
