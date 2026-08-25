#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
NEXUS ERP - O PRESTADOR - MASTER EXECUTABLE COMPILER (.EXE)
===============================================================================
Compilador PyInstaller para compilação binária única de alta performance.
"""

import os
import sys
import subprocess

def build_executable():
    print("=================================================================")
    print("COMPILANDO EXECUTAVEL MASTER DESKTOP - NEXUS ERP - O PRESTADOR")
    print("=================================================================")

    bin_dir = os.path.dirname(os.path.abspath(__file__))
    desktop_dir = os.path.dirname(bin_dir)
    main_script = os.path.join(desktop_dir, "nexus_desktop_main.py")
    dist_dir = os.path.join(desktop_dir, "dist")
    build_dir = os.path.join(desktop_dir, "build")

    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--noconfirm",
        "--clean",
        "--onefile",
        "--windowed",
        "--name=Nexus_ERP_O_Prestador_Enterprise",
        f"--paths={desktop_dir}",
        f"--distpath={dist_dir}",
        f"--workpath={build_dir}",
        main_script
    ]

    print("Executando PyInstaller:", " ".join(cmd))
    subprocess.run(cmd, check=True)
    
    exe_path = os.path.join(dist_dir, "Nexus_ERP_O_Prestador_Enterprise.exe")
    print(f"\nCOMPILACAO CONCLUIDA COM SUCESSO!")
    print(f"Executavel salvo em: {exe_path}")
    return exe_path

if __name__ == "__main__":
    build_executable()
