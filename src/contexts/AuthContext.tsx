"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { UserSession, getUsers, getUserByEmail } from "@/app/actions/userActions";

interface AuthContextType {
  user: UserSession | null;
  users: UserSession[];
  loading: boolean;
  switchUser: (email: string) => Promise<void>;
  hasPermission: (permissionCode: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [users, setUsers] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);

  // Carregar todos os usuários disponíveis e inicializar o usuário logado
  useEffect(() => {
    async function initAuth() {
      try {
        const allUsers = await getUsers();
        setUsers(allUsers);

        // Verifica se já existe um usuário salvo localmente, senão assume o Admin
        const savedEmail = localStorage.getItem("erp_user_email") || "admin@erp.com";
        const currentUser = await getUserByEmail(savedEmail);

        if (currentUser) {
          setUser(currentUser);
        } else if (allUsers.length > 0) {
          // Fallback para o primeiro da lista
          setUser(allUsers[0]);
          localStorage.setItem("erp_user_email", allUsers[0].email);
        }
      } catch (error) {
        console.error("Erro ao inicializar autenticação:", error);
      } finally {
        setLoading(false);
      }
    }

    initAuth();
  }, []);

  const switchUser = async (email: string) => {
    setLoading(true);
    try {
      const currentUser = await getUserByEmail(email);
      if (currentUser) {
        setUser(currentUser);
        localStorage.setItem("erp_user_email", email);
      }
    } catch (error) {
      console.error("Erro ao alternar de usuário:", error);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (permissionCode: string): boolean => {
    if (!user) return false;
    // Administrador tem acesso total
    if (user.permissions.includes("admin.all") || user.roleName === "Administrador") {
      return true;
    }
    return user.permissions.includes(permissionCode);
  };

  return (
    <AuthContext.Provider value={{ user, users, loading, switchUser, hasPermission }}>
      {children}
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
