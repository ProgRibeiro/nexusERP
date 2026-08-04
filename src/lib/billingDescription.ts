export interface BillingDescriptionParts {
  purchaseOrder?: string | null;
  quoteCode?: string | null;
  serviceOrderCode?: string | null;
  serviceDescription?: string | null;
  maxLength?: number;
}

const compactText = (value: string | null | undefined) =>
  (value || "").replace(/\s+/g, " ").trim();

const truncate = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
};

/**
 * Monta a descrição curta usada pela contabilidade e pelo importador fiscal.
 * A referência comercial aparece antes do resumo técnico para facilitar a busca.
 */
export function buildBillingDescription({
  purchaseOrder,
  quoteCode,
  serviceOrderCode,
  serviceDescription,
  maxLength = 240,
}: BillingDescriptionParts) {
  const order = compactText(purchaseOrder);
  const quote = compactText(quoteCode);
  const serviceOrder = compactText(serviceOrderCode);
  const service = compactText(serviceDescription) || "Serviços executados conforme escopo aprovado";
  const references = [
    order ? `Pedido de compra ${order}` : "",
    quote ? `Orçamento ${quote}` : serviceOrder ? `OS ${serviceOrder}` : "",
  ].filter(Boolean);
  const prefix = references.join(" | ");
  const availableForService = Math.max(48, maxLength - prefix.length - (prefix ? 3 : 0));
  const summary = truncate(service, availableForService);

  return truncate([prefix, summary].filter(Boolean).join(" | "), maxLength);
}
