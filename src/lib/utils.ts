/**
 * Formata um valor numérico para Moeda Brasileira (R$)
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/**
 * Formata CPF ou CNPJ adicionando as pontuações correspondentes
 */
export function formatCpfCnpj(value?: string | null): string {
  if (!value) return "Não informado";
  const clean = value.replace(/\D/g, "");
  if (!clean) return "Não informado";
  
  if (clean.length <= 11) {
    // CPF: 000.000.000-00
    return clean
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  } else {
    // CNPJ: 00.000.000/0001-00
    return clean
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1/$2")
      .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  }
}

/**
 * Formata telefone adicionando parênteses e traço
 */
export function formatPhone(value: string): string {
  const clean = value.replace(/\D/g, "");
  
  if (clean.length === 11) {
    // Celular: (00) 00000-0000
    return clean.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  } else if (clean.length === 10) {
    // Fixo: (00) 0000-0000
    return clean.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }
  return value;
}

/**
 * Formata data para o padrão brasileiro (DD/MM/AAAA)
 */
export function formatDate(date: Date | string | null): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  
  if (isNaN(d.getTime())) return "-";
  
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Formata data e hora para o padrão brasileiro (DD/MM/AAAA HH:MM)
 */
export function formatDateTime(date: Date | string | null): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  
  if (isNaN(d.getTime())) return "-";
  
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Helper para concatenar classes CSS condicionalmente
 */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}
