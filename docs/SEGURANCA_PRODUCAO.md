# Segurança de produção — Nexus ERP

## Controles obrigatórios

1. **HTTPS:** TLS válido, redirecionamento HTTP→HTTPS e HSTS por dois anos. Cloudflare deve operar em **Full (strict)**; nunca em Flexible.
2. **WAF:** regras gerenciadas OWASP, Bot Fight Mode e bloqueio/desafio para tráfego anômalo. Aplicar rate limiting especialmente em login, portal e APIs de escrita.
3. **Segredos:** somente variáveis de ambiente ou cofre de segredos. `.env` não entra no Git. Rotacionar imediatamente qualquer segredo exposto.
4. **Gate:** nenhum deploy ocorre antes de schema, TypeScript, busca de segredos, auditoria de dependências, testes de integração e build passarem.
5. **RBAC:** toda leitura/escrita sensível é validada no servidor com `requireAuth`, `requirePermission` ou `requireAnyPermission`.
6. **Auditoria:** criação, edição, aprovação, baixa, troca de feature flag e relato de erro geram registros rastreáveis.
7. **Banco:** usuário da aplicação não deve ser superusuário, não deve ser proprietário do cluster e deve ter apenas privilégios necessários no schema.

## Cloudflare

- SSL/TLS → modo **Full (strict)**.
- Edge Certificates → Always Use HTTPS e HSTS.
- WAF → Managed Rules: Cloudflare e OWASP Core Ruleset.
- Bots → Bot Fight Mode.
- Rate limiting sugerido: login, 5 requisições/minuto/IP; APIs de escrita, 60/minuto/IP; leitura geral, 900/minuto/IP.
- Permitir bypass somente para health check conhecido.
- Registrar eventos e revisar bloqueios falsos positivos antes de endurecer regras.

## Resposta a incidentes

- o botão **Reportar erro** grava URL, usuário, navegador, último erro de runtime, logs recentes e captura autorizada;
- relatórios não devem incluir senhas, tokens ou conteúdo de campos secretos;
- incidentes críticos exigem rotação de credenciais, preservação de logs, correção, teste e registro no `AuditLog`.

## Isolamento entre empresas

Todas as tabelas de negócio possuem `tenantId` no PostgreSQL e políticas **Row Level Security** com `FORCE ROW LEVEL SECURITY`. Cada conexão recebe `app.tenant_id` a partir da variável `TENANT_ID`; o banco rejeita leitura ou gravação de outra empresa mesmo quando uma consulta da aplicação não contém filtro explícito.

- cada empresa deve possuir UUID exclusivo;
- `DATABASE_URL` e `TENANT_ID` são segredos do ambiente;
- o usuário da aplicação não pode ser superusuário nem usar `BYPASSRLS`;
- migrations que criem novas tabelas devem adicionar `tenantId`, índice, FK e política antes do deploy;
- instalações dedicadas continuam recomendadas quando for necessário isolamento físico adicional.
