const { app, BrowserWindow, Menu, ipcMain } = require("electron");
const path = require("path");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 650,
    title: "Nexus ERP — Software Desktop Nativo",
    icon: path.join(__dirname, "public/favicon.ico"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // URL padrão da VPS em nuvem ou VPS customizada
  const vpsUrl = process.env.VPS_URL || "https://erp.oprestador.tech";
  mainWindow.loadURL(vpsUrl);

  // Menu nativo superior do Software Desktop
  const menuTemplate = [
    {
      label: "Servidores VPS",
      submenu: [
        {
          label: "Conectar à VPS Nuvem (Produção Hostinger)",
          click: () => mainWindow.loadURL("https://erp.oprestador.tech"),
        },
        {
          label: "Conectar ao Servidor Local (Dev localhost:3000)",
          click: () => mainWindow.loadURL("http://localhost:3000"),
        },
        { type: "separator" },
        { label: "Recarregar Software Desktop", role: "reload" },
        { label: "Sair do Software", role: "quit" },
      ],
    },
    {
      label: "Exibição",
      submenu: [
        { label: "Alternar Tela Cheia", role: "togglefullscreen" },
        { label: "Aumentar Zoom", role: "zoomIn" },
        { label: "Diminuir Zoom", role: "zoomOut" },
        { label: "Resetar Zoom", role: "resetZoom" },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
