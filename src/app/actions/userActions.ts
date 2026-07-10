"use server";

import { prisma } from "@/lib/db";

export interface UserSession {
  id: string;
  name: string;
  email: string;
  roleName: string;
  permissions: string[];
}

/**
 * Obtém todos os usuários do sistema com seus respectivos papéis
 */
export async function getUsers() {
  try {
    const dbUsers = await prisma.user.findMany({
      include: {
        role: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return dbUsers.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      roleName: user.role?.name || "Sem Perfil",
      permissions: JSON.parse(user.permissions) as string[],
    }));
  } catch (error) {
    console.error("Erro ao obter usuários:", error);
    return [];
  }
}

/**
 * Obtém um usuário específico por email
 */
export async function getUserByEmail(email: string): Promise<UserSession | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });

    if (!user) return null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      roleName: user.role?.name || "Sem Perfil",
      permissions: JSON.parse(user.permissions) as string[],
    };
  } catch (error) {
    console.error(`Erro ao obter usuário ${email}:`, error);
    return null;
  }
}
