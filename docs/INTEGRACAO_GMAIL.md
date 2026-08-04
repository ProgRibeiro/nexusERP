# Integração do Gmail no NX ERP

Este manual configura o envio de propostas comerciais pelo Gmail diretamente
no NX ERP. O sistema gera o PDF da proposta no servidor, anexa o arquivo e
registra o remetente, destinatário, horário, resultado e identificadores do
Gmail no histórico do orçamento.

O ERP usa OAuth 2.0 e solicita apenas a permissão `gmail.send`. A senha da conta
Google nunca é informada ou armazenada no sistema.

## 1. Pré-requisitos

- acesso administrativo ao servidor do NX ERP;
- uma conta Google que será o remetente comercial;
- acesso ao [Google Cloud Console](https://console.cloud.google.com/);
- um domínio HTTPS para o servidor Linux, quando o ERP deixar de rodar somente
  em `localhost`.

## 2. Criar o projeto e ativar a Gmail API

1. Entre no Google Cloud Console.
2. Crie um projeto ou selecione o projeto usado pelo NX ERP.
3. Acesse **APIs e serviços > Biblioteca**.
4. Pesquise **Gmail API**.
5. Clique em **Ativar**.

## 3. Configurar a tela de consentimento OAuth

1. Acesse **APIs e serviços > Tela de consentimento OAuth**.
2. Informe `NX ERP` como nome do aplicativo.
3. Preencha o e-mail de suporte e os dados solicitados pelo Google.
4. Adicione o escopo:

   ```text
   https://www.googleapis.com/auth/gmail.send
   ```

5. Enquanto o aplicativo estiver no modo de teste, adicione a conta Gmail
   remetente em **Usuários de teste**.

Para uma organização Google Workspace, o administrador pode optar pelo tipo
interno quando essa opção estiver disponível. Para contas comuns, use o fluxo
externo e mantenha os usuários de teste corretamente cadastrados.

## 4. Criar as credenciais OAuth

1. Acesse **APIs e serviços > Credenciais**.
2. Clique em **Criar credenciais > ID do cliente OAuth**.
3. Escolha **Aplicativo da Web**.
4. Cadastre a URI correspondente ao ambiente.

Desenvolvimento local:

```text
http://localhost:3000/api/integrations/gmail/callback
```

Servidor Linux com domínio:

```text
https://erp.suaempresa.com.br/api/integrations/gmail/callback
```

A URI no Google e o valor de `APP_BASE_URL` precisam representar exatamente o
mesmo endereço, protocolo e porta.

## 5. Configurar o servidor

Abra o arquivo `.env` do ERP e preencha:

```env
APP_BASE_URL="https://erp.suaempresa.com.br"
INTEGRATION_ENCRYPTION_KEY="CHAVE_ALEATORIA_COM_PELO_MENOS_32_CARACTERES"
GOOGLE_GMAIL_CLIENT_ID="CLIENT_ID_FORNECIDO_PELO_GOOGLE"
GOOGLE_GMAIL_CLIENT_SECRET="CLIENT_SECRET_FORNECIDO_PELO_GOOGLE"
```

Para gerar a chave de criptografia:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use uma chave diferente de `SESSION_SECRET`. Não envie o Client Secret por
mensagens e não adicione o arquivo `.env` ao Git.

Após alterar as variáveis, reinicie o serviço:

```bash
sudo systemctl restart nexus-erp
sudo systemctl status nexus-erp --no-pager
```

Em execução local, reinicie o comando `npm run dev` ou `npm run start`.

## 6. Autorizar a conta no ERP

1. Entre no NX ERP como Administrador.
2. Abra **Configurações > Gmail & Integrações**.
3. Confira se o status informa que as credenciais estão configuradas.
4. Clique em **Conectar Google**.
5. Selecione a conta remetente e autorize o envio.
6. Volte à tela de configurações e confirme o estado **Conectado**.

Os tokens retornados pelo Google ficam criptografados no PostgreSQL usando
AES-256-GCM. O ERP renova automaticamente o acesso enquanto a autorização
continuar válida.

## 7. Testar o envio

1. Abra **Orçamentos**.
2. Selecione uma proposta.
3. Clique em **Enviar por Gmail**.
4. Confira destinatário, cópia, assunto e mensagem.
5. Clique em **Enviar proposta e PDF**.

O resultado aparece no histórico da proposta. Um envio confirmado também muda
um orçamento em rascunho ou pendente para o estado `ENVIADO`.

## 8. Solução de problemas

### `redirect_uri_mismatch`

Confira se a URI cadastrada no Google é idêntica à exibida em
**Configurações > Gmail & Integrações**. Verifique `http`/`https`, domínio,
porta e ausência de barra extra no final.

### O Google não devolveu um token de renovação

Revogue o acesso anterior na conta Google, desconecte a integração no ERP e
conecte novamente. O fluxo do ERP força uma nova tela de consentimento para
solicitar acesso offline.

### Aplicativo em teste bloqueando a conta

Adicione o endereço remetente à lista de usuários de teste da tela de
consentimento OAuth.

### Envio recusado após funcionar anteriormente

Abra a aba de integrações e confira o último aviso. Tente reconectar a conta.
Também verifique se a Gmail API continua ativa e se o Client Secret não foi
revogado no Google Cloud.

### Servidor Linux sem HTTPS

Use `localhost` somente durante desenvolvimento. Para acesso pela rede ou pela
internet, configure Nginx e HTTPS e atualize `APP_BASE_URL` e a URI autorizada
no Google.

## 9. Segurança e manutenção

- mantenha `INTEGRATION_ENCRYPTION_KEY` no gerenciador de segredos ou no `.env`
  protegido do servidor;
- nunca faça commit do `.env`;
- restrinja **Configurações** ao perfil Administrador;
- use uma conta corporativa dedicada ao envio das propostas;
- revise periodicamente os acessos OAuth na conta Google;
- ao desconectar pelo ERP, os tokens são revogados, mas o histórico das
  propostas permanece para auditoria.
