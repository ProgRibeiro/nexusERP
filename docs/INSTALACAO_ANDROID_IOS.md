# Instalação do NX ERP no Android, iPhone e iPad

O NX ERP funciona como um aplicativo web instalável (PWA). Android, iPhone,
iPad e computadores acessam o mesmo servidor e o mesmo banco PostgreSQL, sem
duplicar cadastros ou exigir uma atualização manual em cada aparelho.

## Requisitos do servidor

Para instalar em celulares, o ERP precisa estar disponível em um endereço HTTPS
com certificado válido, por exemplo:

```text
https://erp.suaempresa.com.br
```

`http://localhost:3000` pode ser instalado e testado somente na própria máquina.
Um endereço como `http://192.168.1.10:3000` não é considerado seguro pelos
navegadores móveis e normalmente não libera a instalação completa.

O servidor Linux deve possuir:

- Node.js e PostgreSQL configurados;
- Nginx encaminhando as requisições para o NX ERP;
- certificado HTTPS válido;
- acesso pela rede Wi-Fi ou pela internet, conforme a política da empresa;
- backup e atualização automática já configurados.

Consulte também [DEPLOYMENT.md](../DEPLOYMENT.md).

## Android

1. Abra o endereço HTTPS do ERP no Google Chrome.
2. Faça login normalmente.
3. Toque no menu de três pontos `⋮`.
4. Escolha **Instalar aplicativo**.
5. Se essa opção não aparecer, escolha **Adicionar à tela inicial**.
6. Confirme a instalação.
7. Abra o ícone **NX ERP** criado na tela inicial.

Em navegadores compatíveis, o próprio ERP também mostra o botão **Instalar
aplicativo** na barra superior.

## iPhone e iPad

1. Abra o endereço HTTPS do ERP no Safari.
2. Faça login normalmente.
3. Toque no botão **Compartilhar**.
4. Role a lista de ações e toque em **Adicionar à Tela de Início**.
5. Mantenha o nome `NX ERP` e toque em **Adicionar**.
6. Abra o novo ícone na tela inicial.

Ao abrir pelo ícone, o ERP usa o modo independente, sem a barra normal do
Safari. O armazenamento dessa instalação é separado do Safari; por isso pode
ser necessário fazer login novamente na primeira abertura.

## Atualizações

O aplicativo verifica novas versões automaticamente. Quando uma atualização
for instalada, o ERP apresenta o aviso **Atualização instalada**. Toque em
**Atualizar** para recarregar a interface na versão mais recente.

Não é necessário remover e reinstalar o ícone a cada atualização do servidor.

## Funcionamento sem conexão

Quando o aparelho perde a rede, o ERP apresenta uma tela offline segura e não
mantém páginas administrativas autenticadas no cache.

A execução de campo pode preservar localmente rascunhos, respostas de
formulários e fotos pendentes para sincronização posterior. Cadastros gerais,
financeiro, faturamento e consultas ao PostgreSQL precisam de conexão para
evitar exibir informações antigas.

## Segurança recomendada

- use HTTPS com certificado válido;
- não exponha diretamente a porta do PostgreSQL;
- permita acesso externo somente pelo Nginx;
- mantenha usuários individuais e senhas fortes;
- encerre a sessão antes de emprestar o aparelho;
- use bloqueio por senha, biometria ou Face ID no celular;
- revogue o usuário no ERP quando um aparelho for perdido;
- mantenha os backups automáticos fora do servidor principal.

## Distribuição pelas lojas oficiais

A instalação descrita acima não depende da Google Play ou da App Store. Ela é a
opção indicada para uso interno porque recebe atualizações diretamente do
servidor e mantém uma única versão do ERP.

Uma publicação futura nas lojas exige etapas adicionais, incluindo contas de
desenvolvedor Google e Apple, políticas de privacidade, materiais da loja,
assinatura dos pacotes e análise de cada plataforma.
