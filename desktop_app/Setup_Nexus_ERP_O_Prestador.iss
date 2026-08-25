; ===============================================================================
; NEXUS ERP — O PRESTADOR v2.0 — INNO SETUP PROFESSIONAL INSTALLER SCRIPT (.EXE)
; ===============================================================================
; Este script gera o Instalador Executável Padrão Windows (.exe) com assistente visual 
; "Avançar > Avançar > Concluir", ícone de marca e registro no Painel de Controle.
; ===============================================================================

[Setup]
AppId={{8F4C2A1E-9B3D-4F5E-9A1C-7E8F9D0A1B2C}
AppName=Nexus ERP — O Prestador
AppVersion=2026.8.2-v2
AppPublisher=O Prestador Tecnologias Enterprise
AppPublisherURL=https://erp.oprestador.tech
AppSupportURL=https://erp.oprestador.tech/site/contato
AppUpdatesURL=https://erp.oprestador.tech
DefaultDirName={userappdata}\NexusERP
DefaultGroupName=Nexus ERP — O Prestador
DisableProgramGroupPage=yes
OutputDir=dist
OutputBaseFilename=Setup_NexusERP_OPrestador_v2.0
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "nexus_erp_desktop.py"; DestDir: "{app}"; Flags: ignoreversion
Source: "Instalar_NexusERP_Desktop.bat"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\Nexus ERP — O Prestador"; Filename: "msedge.exe"; Parameters: "--app=https://erp.oprestador.tech --window-size=1366,850"
Name: "{autodesktop}\Nexus ERP - O Prestador"; Filename: "msedge.exe"; Parameters: "--app=https://erp.oprestador.tech --window-size=1366,850"; Tasks: desktopicon

[Run]
Filename: "msedge.exe"; Parameters: "--app=https://erp.oprestador.tech --window-size=1366,850"; Description: "{cm:LaunchProgram,Nexus ERP — O Prestador}"; Flags: nowait postinstall skipifsilent
