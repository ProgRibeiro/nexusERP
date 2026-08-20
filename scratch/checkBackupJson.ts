import fs from "node:fs";

async function main() {
  const file = "./backups/nexus-hourly-2026-08-19T18-25-40-593Z.json";
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const dbData = typeof data.database === "string" ? JSON.parse(data.database) : data.database;

  console.log("=== BACKUP TABLES AND RECORD COUNTS ===");
  for (const [table, rows] of Object.entries(dbData)) {
    if (Array.isArray(rows)) {
      console.log(`Table '${table}': ${rows.length} records`);
      if (rows.length > 0) {
        console.log(`  Sample '${table}':`, JSON.stringify(rows[0]).slice(0, 120));
      }
    }
  }
}

main().catch(console.error);
