import { z } from "zod";

/**
 * Schemas de validação para os payloads das Server Actions mais críticas
 * (dinheiro e dados cadastrais). `requireAuth()`/`requirePermission()`
 * garantem QUEM pode chamar a action; estes schemas garantem que O QUE foi
 * enviado tem o formato esperado antes de tocar o Prisma.
 *
 * Uso: `const parsed = clientCreateSchema.parse(data);` — lança ZodError
 * (com `.issues` detalhado) se o payload for inválido, capturado pelo
 * try/catch já existente em cada action e devolvido como
 * `{ success: false, error: ... }`.
 *
 * Cobertura: cliente, orçamento, agendamento de OS, lançamentos financeiros,
 * lead de CRM e contrato — os pontos onde um payload malformado ou malicioso
 * causaria mais dano (dados cadastrais e movimentação de dinheiro/contratos).
 * As demais Server Actions ainda dependem só da checagem de tipos do
 * TypeScript no client; estender esta cobertura é um bom próximo passo (ver
 * PROMPT_MELHORIA_ERP_BETA.md, item 11).
 */

export const clientCreateSchema = z.object({
  name: z.string().trim().min(2, "Nome é obrigatório."),
  socialName: z.string().trim().optional(),
  fancyName: z.string().trim().optional(),
  cpfCnpj: z
    .string()
    .trim()
    .default("")
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 0 || v.length === 11 || v.length === 14, "CPF/CNPJ deve ficar vazio ou ter 11 ou 14 dígitos."),
  stateRegistration: z.string().trim().optional(),
  municipalRegistration: z.string().trim().optional(),
  email: z.string().trim().email("E-mail inválido."),
  phone: z.string().trim().refine(
    (value) => value.replace(/\D/g, "").length >= 8,
    "Telefone inválido. Informe pelo menos 8 números, incluindo o DDD quando disponível.",
  ),
  whatsapp: z.string().trim().optional(),
  segment: z.string().trim().optional(),
  origin: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  userId: z.string().trim().optional(),
});

export const quoteItemSchema = z.object({
  type: z.enum(["SERVICO", "TERCEIRIZADO", "PRODUTO", "PECAS", "MAO_DE_OBRA", "DESLOCAMENTO", "IMPOSTO"]),
  description: z.string().trim().min(1, "Descrição do item é obrigatória."),
  quantity: z.number().positive("Quantidade deve ser maior que zero."),
  unit: z.string().trim().min(1),
  unitPrice: z.number().nonnegative("Preço unitário não pode ser negativo."),
  costPrice: z.number().nonnegative("Custo não pode ser negativo."),
  markupPercentage: z.number().nonnegative("Margem não pode ser negativa.").max(10000, "Margem informada é muito alta.").optional().default(0),
  supplierId: z.string().trim().optional(),
  discount: z.number().nonnegative("Desconto não pode ser negativo."),
});

export const quoteCreateSchema = z.object({
  clientId: z.string().trim().min(1, "Cliente é obrigatório."),
  addressId: z.string().trim().optional(),
  contactId: z.string().trim().optional(),
  validityDays: z.number().int().positive().optional(),
  warrantyDays: z.number().int().nonnegative().optional(),
  executionTerm: z.string().trim().optional(),
  paymentTerms: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  discount: z.number().nonnegative().optional(),
  tax: z.number().nonnegative().optional(),
  finalValueOverride: z.number().positive().nullable().optional(),
});

export const osScheduleSchema = z.object({
  scheduledDate: z.coerce.date(),
  scheduledTime: z.string().trim().min(1, "Horário é obrigatório."),
  techIds: z.array(z.string().trim().min(1)).min(1, "Selecione ao menos um técnico."),
  priority: z.enum(["BAIXA", "MEDIA", "ALTA", "URGENTE"]).optional(),
});

export const receivePaymentSchema = z.object({
  receivableId: z.string().trim().min(1),
  receivedValue: z.number().positive("Valor recebido deve ser maior que zero."),
  paymentMethod: z.string().trim().min(1, "Forma de pagamento é obrigatória."),
  bankAccountId: z.string().trim().min(1, "Conta bancária é obrigatória."),
  userId: z.string().trim().optional(),
});

export const payBillSchema = z.object({
  payableId: z.string().trim().min(1),
  paymentMethod: z.string().trim().min(1, "Forma de pagamento é obrigatória."),
  bankAccountId: z.string().trim().min(1, "Conta bancária é obrigatória."),
  userId: z.string().trim().optional(),
});

export const crmLeadCreateSchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(2, "Nome é obrigatório."),
  email: z.string().trim().email("E-mail inválido.").optional().or(z.literal("")),
  phone: z.string().trim().min(8, "Telefone inválido."),
  company: z.string().trim().optional(),
  value: z.number().nonnegative("Valor não pode ser negativo."),
  source: z.string().trim().optional(),
  ownerId: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  closePrediction: z.coerce.date().nullable().optional(),
});

export const contractItemSchema = z.object({
  description: z.string().trim().min(1, "Descrição do item é obrigatória."),
  quantity: z.number().positive("Quantidade deve ser maior que zero."),
  unitPrice: z.number().nonnegative("Preço unitário não pode ser negativo."),
});

export const contractCreateSchema = z.object({
  clientId: z.string().trim().min(1, "Cliente é obrigatório."),
  value: z.number().positive("Valor do contrato deve ser maior que zero."),
  billingPeriod: z.enum(["MENSAL", "TRIMESTRAL", "ANUAL"]),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  notes: z.string().trim().optional(),
  items: z.array(contractItemSchema).min(1, "Adicione ao menos um item ao contrato."),
});
