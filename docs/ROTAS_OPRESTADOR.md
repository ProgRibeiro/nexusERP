# Rotas e destinos — O Prestador

## Domínios da VPS

| Destino | Domínio | Função |
| --- | --- | --- |
| Site comercial | `oprestador.tech` e `www.oprestador.tech` | Aquisição, recursos, soluções, planos, demonstração e contato |
| ERP | `app.oprestador.tech` | Login e sistema autenticado |
| Comercial interno | `vendas.oprestador.tech` | CRM e gestão da equipe comercial |
| Administração técnica | `dev.oprestador.tech` | Operação da plataforma para desenvolvedores autorizados |

Todos os domínios chegam ao mesmo serviço Next.js na VPS. O middleware identifica o hostname e encaminha cada acesso para sua área; as portas blue/green continuam privadas atrás do Nginx.

## Jornada pública

1. `/` — página de vendas.
2. `/recursos`, `/solucoes` e `/planos` — apresentação do produto.
3. `/demonstracao` ou `/contato` — conversão comercial.
4. `/login` — autenticação central.
5. Após autenticar, o usuário é direcionado ao ERP, comercial ou administração técnica conforme seu perfil.

## ERP e treinamento

- `/` no domínio `app.` — dashboard do ERP.
- `/clientes`, `/orcamentos`, `/ordens-servico`, `/agenda`, `/financeiro` e demais módulos — páginas operacionais protegidas.
- `/treinamentos` — central acessível pela página comercial e pelo login, fora do menu interno do ERP.
- Administradores podem cadastrar, editar, publicar e excluir treinamentos nessa página.
- Visitantes e usuários comuns visualizam somente vídeos publicados; a administração do conteúdo continua protegida.

## Variáveis usadas na VPS

Os valores públicos ficam em `/etc/nexus-erp.env` e são criados pelo `deploy/install-linux.sh`:

```dotenv
DATABASE_URL=postgresql://nexus_erp:SENHA_RUNTIME@127.0.0.1:5432/nexus_erp?schema=public
MIGRATION_DATABASE_URL=postgresql://nexus_migrate:SENHA_MIGRATIONS@127.0.0.1:5432/nexus_erp?schema=public
BACKUP_DATABASE_URL=postgresql://nexus_backup:SENHA_BACKUP@127.0.0.1:5432/nexus_erp?schema=public
NEXUS_MARKETING_HOSTS=oprestador.tech,www.oprestador.tech
NEXUS_APP_HOST=app.oprestador.tech
NEXUS_COMMERCIAL_HOST=vendas.oprestador.tech
NEXUS_DEV_HOST=dev.oprestador.tech
NEXUS_DEVELOPER_HOST=dev.oprestador.tech
NEXUS_MARKETING_REDIRECT_URL=https://oprestador.tech
NEXT_PUBLIC_NEXUS_MARKETING_URL=https://oprestador.tech
NEXT_PUBLIC_NEXUS_APP_URL=https://app.oprestador.tech
NEXT_PUBLIC_NEXUS_COMMERCIAL_URL=https://vendas.oprestador.tech
NEXT_PUBLIC_NEXUS_DEVELOPER_URL=https://dev.oprestador.tech
SESSION_COOKIE_DOMAIN=.oprestador.tech
```

As contas são obrigatoriamente separadas: `nexus_erp` executa o site sem
`BYPASSRLS`; `nexus_migrate` é proprietária do schema e atua nos deploys; e
`nexus_backup` possui leitura completa exclusivamente para os backups.

DNS e HTTPS são configurados somente quando a VPS estiver pronta e o domínio for apontado.
