#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
NEXUS ERP - O PRESTADOR - COMPILADOR EXECUTAVEL STANDALONE (.EXE / PYINSTALLER)
===============================================================================
Este script compila a aplicacao desktop nativa em um executavel (.exe) standalone
Windows com motor Chromium WebView2 embutido, bandeja do sistema e atalhos F1-F12.
"""

import os
import sys
import subprocess

def build_executable():
    print("=================================================================")
    print("COMPILANDO EXECUTAVEL STANDALONE DESKTOP - NEXUS ERP - O PRESTADOR")
    print("=================================================================")

    script_dir = os.path.dirname(os.path.abspath(__file__))
    main_script = os.path.join(script_dir, "nexus_desktop_master.py")
    dist_dir = os.path.join(script_dir, "dist")
    build_dir = os.path.join(script_dir, "build")

    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--noconfirm",
        "--clean",
        "--onefile",
        "--windowed",
        "--name=Nexus_ERP_O_Prestador_Desktop",
        f"--distpath={dist_dir}",
        f"--workpath={build_dir}",
        main_script
    ]

    print("Executando PyInstaller:", " ".join(cmd))
    subprocess.run(cmd, check=True)
    
    exe_path = os.path.join(dist_dir, "Nexus_ERP_O_Prestador_Desktop.exe")
    print(f"\nCOMPILACAO CONCLUIDA COM SUCESSO!")
    print(f"Executavel salvo em: {exe_path}")
    return exe_path

if __name__ == "__main__":
    build_executable()
