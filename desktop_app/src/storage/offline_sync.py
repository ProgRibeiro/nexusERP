# -*- coding: utf-8 -*-
"""
===============================================================================
NEXUS ERP — LOCAL STORAGE & OFFLINE SYNC ENGINE
===============================================================================
Módulo de cache local em SQLite que sincroniza em tempo real com o PostgreSQL VPS.
Garante resiliência e alta performance em conexões lentas.
"""

import os
import sqlite3

LOCAL_DB_FILE = os.path.expanduser("~/.nexus_erp_local_cache.db")

class OfflineSyncEngine:
    def __init__(self):
        self.db_path = LOCAL_DB_FILE
        self._init_db()

    def _init_db(self):
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS pending_sync (
                    id TEXT PRIMARY KEY,
                    entity_type TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Erro ao inicializar cache local SQLite: {e}")

    def save_pending_sync(self, sync_id, entity_type, payload_json):
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("INSERT OR REPLACE INTO pending_sync (id, entity_type, payload_json) VALUES (?, ?, ?)",
                           (sync_id, entity_type, payload_json))
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"Erro ao salvar fila offline: {e}")
            return False
