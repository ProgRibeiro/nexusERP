#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
NEXUS ERP — COMPILADOR DE EXECUTÁVEL STANDALONE (.EXE / PYINSTALLER)
===============================================================================
Este script compila a aplicação desktop Python em um executável (.exe) 
standalone pré-configurado sem dependências externas.
"""

import os
import sys
import subprocess

def build_executable():
    print("=================================================================")
    print("🔨 COMPILADOR EXECUTÁVEL STANDALONE — NEXUS ERP DESKTOP")
    print("=================================================================")
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    main_script = os.path.join(script_dir, "nexus_erp_desktop.py")
    
    # Verifica se PyInstaller está instalado
    try:
        import PyInstaller
    except ImportError:
        print("Instalando PyInstaller...")
        subprocess.run([sys.executable, "-m", "pip", "install", "pyinstaller"], check=True)

    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--noconfirm",
        "--onedir",
        "--windowed",
        "--name=NexusERP_Desktop",
        f"--distpath={os.path.join(script_dir, 'dist')}",
        f"--workpath={os.path.join(script_dir, 'build')}",
        main_script
    ]
    
    print("Executando PyInstaller:", " ".join(cmd))
    subprocess.run(cmd, check=True)
    print("\n✅ Compilação concluída com sucesso! Executável salvo na pasta 'dist/NexusERP_Desktop'.")

if __name__ == "__main__":
    build_executable()
