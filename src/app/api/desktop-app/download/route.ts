import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const desktopDir = path.join(process.cwd(), "desktop_app");
    const pythonScript = fs.readFileSync(path.join(desktopDir, "nexus_erp_desktop.py"), "utf-8");
    const cLauncher = fs.readFileSync(path.join(desktopDir, "nexus_desktop_launcher.c"), "utf-8");
    const javaLauncher = fs.readFileSync(path.join(desktopDir, "NexusERPLauncher.java"), "utf-8");
    const electronMain = fs.readFileSync(path.join(process.cwd(), "electron-main.js"), "utf-8");

    const readmeText = `===============================================================================
NEXUS ERP — SOFTWARE DESKTOP NATIVO SUITE (PYTHON / C / JAVA / ELECTRON)
===============================================================================

INSTRUÇÕES DE INSTALAÇÃO E EXECUÇÃO:

1. COMO EXECUTAR O SOFTWARE DESKTOP EM PYTHON (Recomendado):
   - Requisito: Python 3 instalado (disponível em python.org).
   - Abra o terminal na pasta e execute:
     python nexus_erp_desktop.py
     ou
     python3 nexus_erp_desktop.py

2. COMO EXECUTAR O LANÇADOR EM C (ALTA PERFORMANCE):
   - No Windows: gcc nexus_desktop_launcher.c -o NexusERP.exe && NexusERP.exe
   - No Linux/Mac: gcc nexus_desktop_launcher.c -o nexus_erp && ./nexus_erp

3. COMO EXECUTAR O LANÇADOR EM JAVA (ENTERPRISE):
   - Requisito: Java instalado (JDK / JRE).
   - Execute:
     javac NexusERPLauncher.java
     java NexusERPLauncher

4. COMO EXECUTAR O PACOTE STANDALONE ELECTRON:
   - Execute: npx electron electron-main.js

Suporte Técnico: Nexus ERP Enterprise Support (Hostinger Cloud VPS)
`;

    // Retorna um JSON simples com todos os arquivos da suíte para o cliente empacotar ou salvar
    return NextResponse.json({
      success: true,
      appName: "Nexus ERP — Software Desktop Nativo Suite",
      version: "2026.8.1",
      files: {
        "nexus_erp_desktop.py": pythonScript,
        "nexus_desktop_launcher.c": cLauncher,
        "NexusERPLauncher.java": javaLauncher,
        "electron-main.js": electronMain,
        "README_INSTALACAO.txt": readmeText,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro ao preparar pacote desktop" }, { status: 500 });
  }
}
