import type { SearchResult } from "@/app/actions/searchActions";

/** Where a global search result should navigate to — shared between Header's search dropdown and CommandPalette. */
export function getSearchResultTarget(
  type: SearchResult["type"],
  id: string
): { tabType: string; params: Record<string, string> } {
  switch (type) {
    case "cliente":
      return { tabType: "clientes", params: { id } };
    case "lead":
      return { tabType: "crm", params: { id } };
    case "equipamento":
      return { tabType: "clientes", params: { id, section: "equipamentos" } };
    case "os":
      return { tabType: "ordens-servico", params: { id } };
    case "orcamento":
      return { tabType: "orcamentos", params: { id } };
    case "nota":
      return { tabType: "faturamento", params: { id } };
    case "receber":
      return { tabType: "financeiro", params: { tab: "receber", id } };
    case "pagar":
      return { tabType: "financeiro", params: { tab: "pagar", id } };
    case "contrato":
      return { tabType: "contratos", params: { id } };
    case "produto":
      return { tabType: "estoque", params: { id } };
    case "usuario":
      return { tabType: "configuracoes", params: { userId: id } };
  }
}

/**
 * Parses a "/module?param=value" style link (used by dashboardActions' alertas/
 * acoesUrgentes and insightsActions) into openTab() arguments.
 */
export function parseAppLink(link: string): { tabType: string; params: Record<string, string> } {
  const [pathPart, queryPart] = link.replace(/^\//, "").split("?");
  const params: Record<string, string> = {};
  if (queryPart) {
    new URLSearchParams(queryPart).forEach((value, key) => {
      params[key] = value;
    });
  }
  return { tabType: pathPart || "dashboard", params };
}
