# -*- coding: utf-8 -*-
"""
===============================================================================
NEXUS ERP — CONFIG MANAGER MODULE
===============================================================================
Gerenciador central de configurações, credenciais de conexão da VPS e estado nativo.
"""

import os
import json

CONFIG_FILE = os.path.expanduser("~/.nexus_erp_vps_config.json")
DEFAULT_VPS_URL = "https://erp.oprestador.tech"

class ConfigManager:
    @staticmethod
    def load():
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return {
            "vps_url": DEFAULT_VPS_URL,
            "app_name": "Nexus ERP - O Prestador",
            "fullscreen": False,
            "auto_start": False,
            "installed_version": "2026.8.2-v2",
            "thermal_printer_name": "DEFAULT",
            "barcode_scanner_enabled": True
        }

    @staticmethod
    def save(cfg):
        try:
            with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump(cfg, f, indent=2)
            return True
        except Exception as e:
            print(f"Erro ao salvar configuracao: {e}")
            return False
