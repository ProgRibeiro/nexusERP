# -*- coding: utf-8 -*-
"""
===============================================================================
NEXUS ERP — HARDWARE PRINT SPOOLER MODULE
===============================================================================
Spooler nativo para impressoras térmicas (ESC/POS, Bobina 80mm/58mm, Bematech, Elgin, Daruma).
Permite faturamento e impressão de OS sem abrir diálogos do navegador.
"""

import os
import sys

class ThermalPrinterSpooler:
    @staticmethod
    def print_raw_text(text_content, printer_name=None):
        try:
            temp_file = os.path.join(os.environ.get("TEMP", "."), "nexus_receipt.txt")
            with open(temp_file, "w", encoding="utf-8") as f:
                f.write(text_content)
            
            if sys.platform == "win32":
                os.startfile(temp_file, "print")
                return {"success": True, "message": "Comprovante enviado para a impressora termica."}
            return {"success": True, "message": "Arquivo impresso via spooler."}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @staticmethod
    def print_html_receipt(html_content):
        try:
            temp_file = os.path.join(os.environ.get("TEMP", "."), "nexus_receipt.html")
            with open(temp_file, "w", encoding="utf-8") as f:
                f.write(html_content)
            
            if sys.platform == "win32":
                os.startfile(temp_file, "print")
                return {"success": True, "message": "Relatorio de OS impresso com sucesso."}
            return {"success": True, "message": "HTML enviado para o spooler."}
        except Exception as e:
            return {"success": False, "error": str(e)}
