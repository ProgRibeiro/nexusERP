# Manual de Operação, Publicação e Diagnóstico do Nexus ERP

## Visão Geral dos Arquivos

Esta pasta contém a infraestrutura e automação para colocar o Nexus ERP (ASP.NET Core) em produção no Ubuntu Server com Nginx e PostgreSQL:

* `setup-nexus-server.sh`: Script principal de provisionamento da VPS.
* `nexusmanutencao.com.nginx.conf`: Arquivo de reverse proxy do Nginx.
* `nexus-erp.service`: Serviço de inicialização do systemd.
* `nexus-erp.env.example`: Exemplo do arquivo de variáveis de ambiente (`/etc/nexus-erp/nexus-erp.env`).
* `deploy-nexus-erp.sh`: Script atômico de deploy com rollback automático.
* `backup-nexus-erp.sh`: Script de backup diário do PostgreSQL e uploads.
* `fail2ban-jail.local`: Configuração de segurança SSH para Fail2ban.
* `upload-windows.ps1`: Automação PowerShell de envio do Windows para a VPS.
* `Program.cs.snippet`: Código C# para suporte a Nginx no ASP.NET Core.

---

## Comandos de Emergência

```bash
# Status e Logs do ERP
systemctl status nexus-erp
journalctl -u nexus-erp -f
journalctl -u nexus-erp -n 200 --no-pager
systemctl restart nexus-erp

# Status e Teste do Nginx
systemctl status nginx
nginx -t
systemctl restart nginx

# Status do Banco PostgreSQL
systemctl status postgresql

# Firewall e Certificados SSL
ufw status verbose
certbot certificates

# Rede, Sockets, Disco e Memória
ss -tulpn
df -h
free -h
```

---

## Guia de Diagnóstico e Resolução de Problemas (Troubleshooting)

### 1. Erro `502 Bad Gateway` no Navegador
* **Causa:** O Nginx está ativo, mas o serviço Kestrel do ERP (`127.0.0.1:5000`) não está respondendo.
* **Diagnóstico:** Execute `systemctl status nexus-erp` e `journalctl -u nexus-erp -n 50 --no-pager`.

### 2. O ERP não Inicia (`systemctl status nexus-erp` mostra `failed`)
* **Causa:** Nome da DLL divergente em `/etc/systemd/system/nexus-erp.service` ou erro de sintaxe na string de conexão do PostgreSQL em `/etc/nexus-erp/nexus-erp.env`.
* **Diagnóstico:** Execute o binário diretamente como usuário de serviço:
  `sudo -u nexuserp /usr/bin/dotnet /var/www/nexus-erp/current/NexusERP.dll`

### 3. O Domínio não Abre / Conexão Recusada
* **Causa:** O registro DNS A não propagou ou o firewall UFW não liberou as portas HTTP/HTTPS.
* **Diagnóstico:** Cheque o estado do UFW: `sudo ufw status`. Certifique-se de que `80/tcp` e `443/tcp` estão `ALLOW`.

### 4. Falha na Geração do SSL pelo Certbot
* **Causa:** O Nginx não está respondendo no IP para onde o domínio aponta.
* **Diagnóstico:** Verifique se o Nginx está no ar (`nginx -t`) e execute o Certbot manualmente:
  `sudo certbot --nginx -d nexusmanutencao.com -d www.nexusmanutencao.com`

### 5. Erro de Conexão com Banco de Dados
* **Causa:** PostgreSQL inativo ou credenciais incorretas no arquivo `.env`.
* **Diagnóstico:** Teste a conexão local: `psql -h 127.0.0.1 -U nexus_erp_user -d nexus_erp`.

### 6. Arquivos Uploadados Não Aparecem ou Dão "Permission Denied"
* **Causa:** Diretório de dados permanentes sem a propriedade do usuário `nexuserp`.
* **Diagnóstico:** Ajuste as permissões:
  `sudo chown -R nexuserp:nexuserp /var/lib/nexus-erp`
  `sudo chmod -R 750 /var/lib/nexus-erp`
