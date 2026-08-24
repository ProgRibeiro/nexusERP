export const NFSE_ISSUANCE_DISABLED_MESSAGE =
  "Emissão de NFS-e temporariamente desativada até a habilitação junto à prefeitura.";

/**
 * A transmissão fiscal fica bloqueada por padrão. Para reativar, a empresa
 * precisa concluir a habilitação municipal e publicar com a flag explícita.
 */
export const NFSE_ISSUANCE_ENABLED =
  process.env.NEXT_PUBLIC_NFSE_ISSUANCE_ENABLED === "true";
