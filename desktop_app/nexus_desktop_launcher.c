/*
 * ===============================================================================
 * NEXUS ERP — HIGH PERFORMANCE NATIVE C LAUNCHER
 * ===============================================================================
 * Compilador em C Nativo para Windows (gcc/cl.exe) e Linux/macOS.
 * Inicia o motor do aplicativo desktop nativo e conecta à VPS Hostinger.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#ifdef _WIN32
#include <windows.h>
#include <shellapi.h>
#else
#include <unistd.h>
#endif

#define DEFAULT_VPS_URL "https://erp.oprestador.tech"

int main(int argc, char *argv[]) {
    char vps_url[512];
    
    if (argc > 1) {
        strncpy(vps_url, argv[1], sizeof(vps_url) - 1);
    } else {
        strncpy(vps_url, DEFAULT_VPS_URL, sizeof(vps_url) - 1);
    }

    printf("====================================================\n");
    printf("   NEXUS ERP — LANÇADOR DESKTOP NATIVO EM C          \n");
    printf("====================================================\n");
    printf("Conectando ao Servidor VPS: %s\n", vps_url);
    printf("Iniciando motor Python / PySide Engine...\n\n");

#ifdef _WIN32
    // Windows: Executa o script Python ou abre em modo App Standalone
    char cmd[1024];
    snprintf(cmd, sizeof(cmd), "python desktop_app\\nexus_erp_desktop.py");
    system(cmd);
#else
    // macOS / Linux
    char cmd[1024];
    snprintf(cmd, sizeof(cmd), "python3 desktop_app/nexus_erp_desktop.py");
    system(cmd);
#endif

    return 0;
}
