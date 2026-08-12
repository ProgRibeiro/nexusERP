module.exports = {
    apps: [{
        name: "nexus-erp",
        script: "node_modules/next/dist/bin/next",
        args: "start -p 3000",
        cwd: "/var/www/nexus-erp/current",
        instances: 1,
        exec_mode: "fork",
        autorestart: true,
        watch: false,
        max_memory_restart: "1G",
        min_uptime: "10s",
        max_restarts: 10,
        env: {
            NODE_ENV: "production",
            NEXT_TELEMETRY_DISABLED: "1",
            PORT: "3000",
        },
        error_file: "/var/log/nexus-erp/error.log",
        out_file: "/var/log/nexus-erp/out.log",
        time: true,
    }, ],
};