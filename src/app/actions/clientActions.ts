"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export interface ClientDTO {
  id: string;
  name: string;
  socialName: string | null;
  fancyName: string | null;
  cpfCnpj: string;
  stateRegistration: string | null;
  municipalRegistration: string | null;
  email: string;
  phone: string;
  whatsapp: string | null;
  segment: string | null;
  origin: string | null;
  status: string;
  notes: string | null;
  createdAt: Date;
}

export interface ClientDetailsDTO extends ClientDTO {
  contacts: any[];
  addresses: any[];
  equipments: any[];
  quotes: any[];
  serviceOrders: any[];
  invoices: any[];
  receivables: any[];
}

/**
 * Obtém todos os clientes ou filtra por nome/documento
 */
export async function getClients(search?: string): Promise<ClientDTO[]> {
  try {
    const clients = await prisma.client.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search } },
              { fancyName: { contains: search } },
              { socialName: { contains: search } },
              { cpfCnpj: { contains: search } },
            ],
          }
        : undefined,
      orderBy: { name: "asc" },
    });
    return clients;
  } catch (error) {
    console.error("Erro ao obter clientes:", error);
    return [];
  }
}

/**
 * Obtém prontuário e detalhes de um cliente específico
 */
export async function getClientDetails(id: string): Promise<ClientDetailsDTO | null> {
  try {
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        contacts: true,
        addresses: true,
        equipments: true,
        quotes: {
          orderBy: { createdAt: "desc" },
        },
        serviceOrders: {
          orderBy: { createdAt: "desc" },
        },
        invoices: {
          orderBy: { issueDate: "desc" },
        },
        accountsReceivable: {
          orderBy: { dueDate: "desc" },
        },
      },
    });

    if (!client) return null;

    return {
      ...client,
      receivables: client.accountsReceivable,
    };
  } catch (error) {
    console.error(`Erro ao obter prontuário do cliente ${id}:`, error);
    return null;
  }
}

/**
 * Cria um novo Cliente
 */
export async function createClient(data: {
  name: string;
  socialName?: string;
  fancyName?: string;
  cpfCnpj: string;
  stateRegistration?: string;
  municipalRegistration?: string;
  email: string;
  phone: string;
  whatsapp?: string;
  segment?: string;
  origin?: string;
  notes?: string;
  userId?: string;
}) {
  try {
    // Validação de duplicidade
    const existing = await prisma.client.findUnique({
      where: { cpfCnpj: data.cpfCnpj },
    });

    if (existing) {
      throw new Error("Já existe um cliente cadastrado com este CPF/CNPJ.");
    }

    const client = await prisma.client.create({
      data: {
        name: data.name,
        socialName: data.socialName || null,
        fancyName: data.fancyName || null,
        cpfCnpj: data.cpfCnpj,
        stateRegistration: data.stateRegistration || null,
        municipalRegistration: data.municipalRegistration || null,
        email: data.email,
        phone: data.phone,
        whatsapp: data.whatsapp || null,
        segment: data.segment || null,
        origin: data.origin || null,
        notes: data.notes || null,
        status: "ATIVO",
      },
    });

    // Auditoria
    await prisma.auditLog.create({
      data: {
        userId: data.userId || null,
        action: "CRIACAO",
        entity: "Cliente",
        entityId: client.id,
        changesJson: JSON.stringify(client),
      },
    });

    revalidatePath("/clientes");
    return { success: true, client };
  } catch (error: any) {
    console.error("Erro ao criar cliente:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Adiciona um Contato ao Cliente
 */
export async function addClientContact(data: {
  clientId: string;
  name: string;
  role?: string;
  email: string;
  phone: string;
  whatsapp?: string;
  isFinancial: boolean;
  isTechnical: boolean;
  isApproval: boolean;
}) {
  try {
    const contact = await prisma.clientContact.create({
      data,
    });
    revalidatePath(`/clientes`);
    return { success: true, contact };
  } catch (error: any) {
    console.error("Erro ao adicionar contato:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Adiciona um Endereço ao Cliente
 */
export async function addClientAddress(data: {
  clientId: string;
  label: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  cep: string;
  reference?: string;
}) {
  try {
    const address = await prisma.clientAddress.create({
      data,
    });
    revalidatePath(`/clientes`);
    return { success: true, address };
  } catch (error: any) {
    console.error("Erro ao adicionar endereço:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Adiciona um Equipamento ao Cliente
 */
export async function addClientEquipment(data: {
  clientId: string;
  type: string;
  brand: string;
  model: string;
  serialNumber: string;
  capacity?: string;
  tag?: string;
  location?: string;
  installDate?: Date;
  notes?: string;
}) {
  try {
    const equipment = await prisma.clientEquipment.create({
      data,
    });
    revalidatePath(`/clientes`);
    return { success: true, equipment };
  } catch (error: any) {
    console.error("Erro ao adicionar equipamento:", error);
    return { success: false, error: error.message };
  }
}
