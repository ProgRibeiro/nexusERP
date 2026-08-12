import type { CapacitorConfig } from "@capacitor/cli";

const appName = process.env.CAPACITOR_APP_NAME || "NX ERP";
const appId = process.env.CAPACITOR_APP_ID || "com.nxerp.app";
const serverUrl =
  process.env.CAPACITOR_SERVER_URL || "https://erp.suaempresa.com.br";

// O app nativo abre a versão web hospedada em HTTPS.
// Assim, Android e iOS usam o mesmo backend e banco de dados.
const config: CapacitorConfig = {
  appId,
  appName,
  webDir: "public",
  server: {
    url: serverUrl,
    cleartext: false,
    androidScheme: "https",
  },
  ios: {
    contentInset: "automatic",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
    },
  },
};

export default config;
