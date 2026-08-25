import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    const desktopDir = path.join(process.cwd(), "desktop_app");

    // 1. Download direto do Instalador Automático de 1-Clique em Batch Windows (.bat)
    if (type === "installer_bat") {
      const batPath = path.join(desktopDir, "Instalar_NexusERP_Desktop.bat");
      const batContent = fs.readFileSync(batPath, "utf-8");

      return new NextResponse(batContent, {
        headers: {
          "Content-Type": "application/x-bat; charset=utf-8",
          "Content-Disposition": 'attachment; filename="Instalar_NexusERP_Desktop.bat"',
        },
      });
    }

    // 2. Download do Instalador PowerShell (.ps1)
    if (type === "ps1") {
      const ps1Path = path.join(desktopDir, "Install_NexusERP.ps1");
      const ps1Content = fs.readFileSync(ps1Path, "utf-8");

      return new NextResponse(ps1Content, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": 'attachment; filename="Install_NexusERP.ps1"',
        },
      });
    }

    // 3. Resposta JSON completa com a suíte e instaladores pré-configurados
    const pythonScript = fs.readFileSync(path.join(desktopDir, "nexus_erp_desktop.py"), "utf-8");
    const cLauncher = fs.readFileSync(path.join(desktopDir, "nexus_desktop_launcher.c"), "utf-8");
    const javaLauncher = fs.readFileSync(path.join(desktopDir, "NexusERPLauncher.java"), "utf-8");
    const batInstaller = fs.readFileSync(path.join(desktopDir, "Instalar_NexusERP_Desktop.bat"), "utf-8");
    const ps1Installer = fs.readFileSync(path.join(desktopDir, "Install_NexusERP.ps1"), "utf-8");
    const buildExe = fs.readFileSync(path.join(desktopDir, "build_exe.py"), "utf-8");
    const electronMain = fs.readFileSync(path.join(process.cwd(), "electron-main.js"), "utf-8");

    const readmeText = `===============================================================================
NEXUS ERP — SOFTWARE DESKTOP NATIVO SUITE (INSTALADOR AUTOMÁTICO PRÉ-CONFIGURADO)
===============================================================================

INSTRUÇÕES DE INSTALAÇÃO RÁPIDA (1-CLIQUE):

1. INSTALAÇÃO AUTOMÁTICA EM 1-CLIQUE NO WINDOWS (Recomendado):
   - Clique duas vezes no arquivo "Instalar_NexusERP_Desktop.bat".
   - O instalador criará automaticamente:
     * A pasta da aplicação em %LOCALAPPDATA%\\NexusERP
     * O atalho na sua Área de Trabalho ("Nexus ERP Enterprise")
     * O atalho no Menu Iniciar
     * O registro do protocolo nexus-erp://
     * A pré-configuração pronta conectando na VPS (https://erp.oprestador.tech)

2. INSTALAÇÃO VIA POWERSHELL:
   - Abra o PowerShell e execute:
     .\\Install_NexusERP.ps1

3. EXECUÇÃO DIRETA DO SOFTWARE DESKTOP PYTHON:
   - Abra o terminal e execute:
     python nexus_erp_desktop.py

4. GERAR EXECUTÁVEL STANDALONE (.EXE):
   - Execute: python build_exe.py

Suporte Técnico: Nexus ERP Enterprise Support (Hostinger Cloud VPS)
`;

    return NextResponse.json({
      success: true,
      appName: "Nexus ERP — Software Desktop Nativo Suite",
      version: "2026.8.1",
      files: {
        "Instalar_NexusERP_Desktop.bat": batInstaller,
        "Install_NexusERP.ps1": ps1Installer,
        "nexus_erp_desktop.py": pythonScript,
        "nexus_desktop_launcher.c": cLauncher,
        "NexusERPLauncher.java": javaLauncher,
        "build_exe.py": buildExe,
        "electron-main.js": electronMain,
        "README_INSTALACAO.txt": readmeText,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro ao preparar pacote desktop" }, { status: 500 });
  }
}
