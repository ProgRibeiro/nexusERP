"use server";

import { logger } from "@/lib/logger";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth, requirePermission } from "@/lib/auth";
import { clientCreateSchema } from "@/lib/schemas";

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

export interface ClientContactDTO {
  id: string;
  name: string;
  role: string | null;
  email: string;
  phone: string;
  whatsapp: string | null;
  isFinancial: boolean;
  isTechnical: boolean;
  isApproval: boolean;
}

export interface ClientAddressDTO {
  id: string;
  label: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  cep: string;
  reference: string | null;
}

export interface ClientDetailsDTO extends ClientDTO {
  contacts: ClientContactDTO[];
  addresses: ClientAddressDTO[];
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
    await requireAuth();

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
    logger.error("Erro ao obter clientes:", error);
    return [];
  }
}

/**
 * Obtém prontuário e detalhes de um cliente específico
 */
export async function getClientDetails(id: string): Promise<ClientDetailsDTO | null> {
  try {
    await requireAuth();

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
    logger.error(`Erro ao obter prontuário do cliente ${id}:`, error);
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
    const session = await requirePermission("clients.write");
    const parsed = clientCreateSchema.parse(data);

    // Documento é sempre persistido sem máscara. Também reconhece registros
    // legados enviados com a mesma máscara para evitar duplicidade.
    const existing = await prisma.client.findFirst({
      where: {
        OR: [
          { cpfCnpj: parsed.cpfCnpj },
          { cpfCnpj: data.cpfCnpj.trim() },
        ],
      },
    });

    if (existing) {
      throw new Error("Já existe um cliente cadastrado com este CPF/CNPJ.");
    }

    const client = await prisma.client.create({
      data: {
        name: parsed.name,
        socialName: parsed.socialName || null,
        fancyName: parsed.fancyName || null,
        cpfCnpj: parsed.cpfCnpj,
        stateRegistration: parsed.stateRegistration || null,
        municipalRegistration: parsed.municipalRegistration || null,
        email: parsed.email,
        phone: parsed.phone,
        whatsapp: parsed.whatsapp || null,
        segment: parsed.segment || null,
        origin: parsed.origin || null,
        notes: parsed.notes || null,
        status: "ATIVO",
      },
    });

    // Auditoria (userId sempre da sessão do servidor, nunca do payload do client)
    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "CRIACAO",
        entity: "Cliente",
        entityId: client.id,
        changesJson: JSON.stringify(client),
      },
    });

    revalidatePath("/clientes");
    return { success: true, client };
  } catch (error: any) {
    logger.error("Erro ao criar cliente:", error);
    return { success: false, error: error.issues?.[0]?.message || error.message };
  }
}

/**
 * Cria cliente e endereço principal na mesma transação. Usado nos fluxos que
 * precisam gerar OS imediatamente, evitando cadastro parcial sem endereço.
 */
export async function createClientWithAddress(data: {
  client: {
    name: string;
    socialName?: string;
    fancyName?: string;
    cpfCnpj: string;
    email: string;
    phone: string;
    whatsapp?: string;
    segment?: string;
    origin?: string;
    notes?: string;
  };
  address: {
    label: string;
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    cep: string;
    reference?: string;
  };
}) {
  try {
    const session = await requirePermission("clients.write");
    const client = clientCreateSchema.parse(data.client);
    const address = {
      label: data.address.label.trim() || "Principal",
      street: data.address.street.trim(),
      number: data.address.number.trim(),
      complement: data.address.complement?.trim() || null,
      neighborhood: data.address.neighborhood.trim(),
      city: data.address.city.trim(),
      state: data.address.state.trim().toUpperCase(),
      cep: data.address.cep.replace(/\D/g, ""),
      reference: data.address.reference?.trim() || null,
    };

    if (!address.street || !address.number || !address.neighborhood || !address.city || address.state.length !== 2 || address.cep.length !== 8) {
      throw new Error("Endereço incompleto. Informe CEP, logradouro, número, bairro, cidade e UF.");
    }

    const created = await prisma.$transaction(async (tx) => {
      const existing = await tx.client.findFirst({
        where: {
          OR: [
            { cpfCnpj: client.cpfCnpj },
            { cpfCnpj: data.client.cpfCnpj.trim() },
          ],
        },
      });
      if (existing) throw new Error("Já existe um cliente cadastrado com este CPF/CNPJ.");

      const newClient = await tx.client.create({
        data: {
          name: client.name,
          socialName: client.socialName || null,
          fancyName: client.fancyName || null,
          cpfCnpj: client.cpfCnpj,
          email: client.email,
          phone: client.phone,
          whatsapp: client.whatsapp || null,
          segment: client.segment || null,
          origin: client.origin || null,
          notes: client.notes || null,
          status: "ATIVO",
          addresses: { create: address },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.userId,
          action: "CRIACAO",
          entity: "Cliente",
          entityId: newClient.id,
          changesJson: JSON.stringify({ client: newClient, address }),
        },
      });
      return newClient;
    });

    revalidatePath("/clientes");
    revalidatePath("/contratos");
    return { success: true, client: created };
  } catch (error: unknown) {
    logger.error("Erro ao criar cliente com endereço:", error);
    const message = error instanceof Error ? error.message : "Não foi possível cadastrar o cliente.";
    return { success: false, error: message };
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
    await requirePermission("clients.write");

    const contact = await prisma.clientContact.create({
      data,
    });
    revalidatePath(`/clientes`);
    return { success: true, contact };
  } catch (error: any) {
    logger.error("Erro ao adicionar contato:", error);
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
    await requirePermission("clients.write");

    const address = await prisma.clientAddress.create({
      data,
    });
    revalidatePath(`/clientes`);
    return { success: true, address };
  } catch (error: any) {
    logger.error("Erro ao adicionar endereço:", error);
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
    await requirePermission("clients.write");

    const equipment = await prisma.clientEquipment.create({
      data,
    });
    revalidatePath(`/clientes`);
    return { success: true, equipment };
  } catch (error: any) {
    logger.error("Erro ao adicionar equipamento:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Consulta CNPJ na base pública e retorna dados formatados
 */
export async function consultarCNPJAction(cnpj: string) {
  try {
    await requireAuth();

    const cleanCnpj = cnpj.replace(/\D/g, "");
    if (cleanCnpj.length === 11) {
      return {
        success: false,
        error: "A busca online suporta apenas CNPJ. Para CPF (11 dígitos), por favor preencha os dados manualmente."
      };
    }
    if (cleanCnpj.length !== 14) {
      return {
        success: false,
        error: "CNPJ inválido. O CNPJ deve conter exatamente 14 dígitos numéricos."
      };
    }

    // 1ª Tentativa: BrasilAPI
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      if (response.ok) {
        const data = await response.json();
        const addressParts = [
          data.logradouro,
          data.numero ? `, ${data.numero}` : "",
          data.complemento ? ` - ${data.complemento}` : "",
          data.bairro ? ` - ${data.bairro}` : "",
          data.cep ? ` - CEP ${data.cep}` : "",
          data.municipio && data.uf ? ` - ${data.municipio} / ${data.uf}` : ""
        ].filter(Boolean).join("");

        return {
          success: true,
          data: {
            corporateName: data.razao_social || "",
            tradeName: data.nome_fantasia || data.razao_social || "",
            email: data.email || "",
            phone: data.ddd_telefone_1 || data.telefone || "",
            address: addressParts,
            addressDetails: {
              street: data.logradouro || "",
              number: data.numero || "S/N",
              complement: data.complemento || "",
              neighborhood: data.bairro || "",
              city: data.municipio || "",
              state: data.uf || "",
              cep: String(data.cep || "").replace(/\D/g, ""),
            },
            cnpj: data.cnpj || cleanCnpj,
          }
        };
      }
    } catch (err) {
      logger.warn("Falha na BrasilAPI, tentando ReceitaWS...", err);
    }

    // 2ª Tentativa: ReceitaWS
    try {
      const response = await fetch(`https://receitaws.com.br/v1/cnpj/${cleanCnpj}`);
      if (response.ok) {
        const data = await response.json();
        if (data.status !== "ERROR") {
          const addressParts = [
            data.logradouro,
            data.numero ? `, ${data.numero}` : "",
            data.complemento ? ` - ${data.complemento}` : "",
            data.bairro ? ` - ${data.bairro}` : "",
            data.cep ? ` - CEP ${data.cep}` : "",
            data.municipio && data.uf ? ` - ${data.municipio} / ${data.uf}` : ""
          ].filter(Boolean).join("");

          return {
            success: true,
            data: {
              corporateName: data.nome || "",
              tradeName: data.fantasia || data.nome || "",
              email: data.email || "",
              phone: data.telefone || "",
              address: addressParts,
              addressDetails: {
                street: data.logradouro || "",
                number: data.numero || "S/N",
                complement: data.complemento || "",
                neighborhood: data.bairro || "",
                city: data.municipio || "",
                state: data.uf || "",
                cep: String(data.cep || "").replace(/\D/g, ""),
              },
              cnpj: data.cnpj?.replace(/\D/g, "") || cleanCnpj,
            }
          };
        }
      }
    } catch (err) {
      logger.error("Falha na ReceitaWS...", err);
    }

    return {
      success: false,
      error: "CNPJ não localizado na base de dados oficial da Receita Federal. Verifique o número digitado."
    };
  } catch (error: any) {
    logger.error("Erro na consulta do CNPJ:", error);
    return {
      success: false,
      error: "Falha de conexão com os servidores da Receita Federal. Tente novamente mais tarde."
    };
  }
}

/**
 * Completa um cadastro existente usando os dados públicos do CNPJ.
 * Campos oficiais não vazios substituem placeholders vindos de importação;
 * o endereço só é criado automaticamente quando o cliente ainda não possui um.
 */
export async function syncClientFromCNPJ(clientId: string) {
  try {
    const session = await requirePermission("clients.write");
    const current = await prisma.client.findUnique({
      where: { id: clientId },
      include: { addresses: true },
    });
    if (!current) return { success: false, error: "Cliente não encontrado." };

    const document = current.cpfCnpj.replace(/\D/g, "");
    if (document.length !== 14) {
      return { success: false, error: "A atualização automática está disponível apenas para clientes com CNPJ." };
    }

    const lookup = await consultarCNPJAction(document);
    if (!lookup.success || !lookup.data) {
      return { success: false, error: lookup.error || "CNPJ não localizado." };
    }
    const official = lookup.data;

    const updated = await prisma.$transaction(async (tx) => {
      const client = await tx.client.update({
        where: { id: clientId },
        data: {
          name: official.tradeName || official.corporateName || current.name,
          socialName: official.corporateName || current.socialName,
          fancyName: official.tradeName || current.fancyName,
          email: official.email || current.email,
          phone: official.phone || current.phone,
          notes: current.notes || (official.address ? `Endereço Receita Federal: ${official.address}` : null),
        },
      });

      if (!current.addresses.length && official.addressDetails?.street) {
        await tx.clientAddress.create({
          data: {
            clientId,
            label: "Endereço cadastral (CNPJ)",
            street: official.addressDetails.street,
            number: official.addressDetails.number || "S/N",
            complement: official.addressDetails.complement || null,
            neighborhood: official.addressDetails.neighborhood || "Não informado",
            city: official.addressDetails.city || "Não informado",
            state: official.addressDetails.state || "",
            cep: official.addressDetails.cep || "",
            reference: "Importado automaticamente da consulta pública de CNPJ",
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: session.userId,
          action: "ATUALIZACAO_CNPJ",
          entity: "Cliente",
          entityId: clientId,
          changesJson: JSON.stringify({ source: "CNPJ", corporateName: official.corporateName }),
        },
      });
      return client;
    });

    revalidatePath("/clientes");
    revalidatePath("/orcamentos");
    return { success: true, client: updated };
  } catch (error: any) {
    logger.error("Erro ao atualizar cliente pelo CNPJ:", error);
    return { success: false, error: error.message || "Erro ao atualizar o cliente pelo CNPJ." };
  }
}
