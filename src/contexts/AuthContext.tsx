"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  UserSession,
  getUsers,
  getSessionUserAction,
  logoutAction,
  switchUserAction,
} from "@/app/actions/userActions";
import LoginView from "@/components/LoginView";
import { Loader2 } from "lucide-react";
import { usePathname } from "next/navigation";

interface AuthContextType {
  user: UserSession | null;
  users: UserSession[];
  loading: boolean;
  switchUser: (email: string) => Promise<{ success: boolean; error?: string }>;
  hasPermission: (permissionCode: string) => boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicStorePortal = pathname.startsWith("/portal/loja/") || pathname.startsWith("/portal/prestador");
  const [user, setUser] = useState<UserSession | null>(null);
  const [users, setUsers] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(!isPublicStorePortal);

  // A sessão agora vive num cookie httpOnly lido no servidor — não há mais
  // nenhuma fonte de verdade de autenticação no localStorage.
  useEffect(() => {
    if (isPublicStorePortal) return;
    async function initAuth() {
      try {
        const sessionUser = await getSessionUserAction();
        setUser(sessionUser);

        if (sessionUser) {
          const allUsers = await getUsers();
          setUsers(allUsers);
        }
      } catch (error) {
        console.error("Erro ao inicializar autenticação:", error);
      } finally {
        setLoading(false);
      }
    }

    initAuth();
  }, [isPublicStorePortal]);

  const switchUser = useCallback(async (email: string) => {
    const res = await switchUserAction(email);
    if (res.success && res.user) {
      setUser(res.user);
    }
    return { success: res.success, error: res.error };
  }, []);

  const handleLoginSuccess = useCallback(async (sessionUser: UserSession) => {
    setUser(sessionUser);
    try {
      const allUsers = await getUsers();
      setUsers(allUsers);
    } catch (error) {
      console.error("Erro ao carregar lista de usuários:", error);
    }
  }, []);

  const logout = useCallback(async () => {
    await logoutAction();
    setUser(null);
    setUsers([]);
  }, []);

  const hasPermission = (permissionCode: string): boolean => {
    if (!user) return false;
    // Administrador tem acesso total
    if (user.permissions.includes("admin.all") || user.roleName === "Administrador") {
      return true;
    }
    return user.permissions.includes(permissionCode);
  };

  if (isPublicStorePortal) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="h-screen w-screen bg-zinc-950 flex flex-col items-center justify-center gap-4 text-zinc-100">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-semibold text-zinc-500 tracking-wide animate-pulse">
          Carregando NX ERP...
        </p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, users, loading, switchUser, hasPermission, logout }}>
      {user ? children : <LoginView onLoginSuccess={handleLoginSuccess} />}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
}
