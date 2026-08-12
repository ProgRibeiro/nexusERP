# Publicar NX ERP no Android e iOS com Capacitor

Este guia empacota o NX ERP como aplicativo nativo usando uma WebView segura.
O app abre o ERP hospedado em HTTPS, então Android/iOS usam a mesma base de dados
PostgreSQL e o mesmo backend.

## 1) Pré-requisitos

- ERP já publicado em HTTPS (ex.: `https://erp.suaempresa.com.br`)
- Node.js 20+
- Android Studio (para Android)
- Xcode (para iOS, somente macOS)
- Conta Google Play Console (publicação Android)
- Conta Apple Developer Program (publicação iOS)

## 2) Configurar identidade do app

No terminal do projeto, ajuste os dados do pacote:

```bash
export CAPACITOR_APP_ID="com.suaempresa.nxerp"
export CAPACITOR_APP_NAME="NX ERP"
export CAPACITOR_SERVER_URL="https://erp.suaempresa.com.br"
```

## 3) Gerar projetos nativos

```bash
npm run mobile:add:android
npm run mobile:add:ios
npm run mobile:sync
npm run mobile:doctor
```

Se as pastas `android/` e `ios/` ja existirem, rode apenas:

```bash
npm run mobile:sync
```

## 4) Build e assinatura Android

1. Abra o projeto Android:

```bash
npm run mobile:open:android
```

2. No Android Studio:

- Build > Generate Signed Bundle / APK
- Escolha Android App Bundle (`.aab`) para Play Store
- Configure `keystore`, alias e senha
- Gere o arquivo final

3. Publique o `.aab` no Play Console.

## 5) Build e assinatura iOS

1. Abra o projeto iOS:

```bash
npm run mobile:open:ios
```

2. No Xcode:

- Selecione Team e Signing no target principal
- Ajuste Bundle Identifier (deve bater com `CAPACITOR_APP_ID`)
- Product > Archive
- Distribua via App Store Connect

## 6) Checklist para aprovação em loja

- Política de privacidade pública
- Tela de login funcionando em rede real
- Ícones e screenshots da loja
- Nome, descrição e categoria do app
- Termos de uso e contato de suporte
- Conta de teste para review, se necessário

## 7) Atualizações do ERP

Como o app abre o ERP hospedado, mudanças de UI/regra de negócio entram no app
sem republicar toda versão nativa (desde que não exijam novos recursos nativos).

Você só precisa publicar nova versão Android/iOS quando:

- mudar permissões nativas,
- adicionar plugin nativo,
- alterar identidade/binários do app.
