import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;
const mode = process.argv[2];
const manifestPath = path.resolve(process.argv[3] || "critical-data-manifest.json");
const criticalTables = [
  "Client",
  "ClientContact",
  "ClientAddress",
  "Quote",
  "QuoteItem",
  "Service",
  "ServiceOrder",
  "ServiceOrderItem",
  "ServiceOrderMaterial",
  "CompletionReport",
  "Invoice",
  "NfseRecord",
  "AccountsReceivable",
  "AccountsPayable",
  "FinancialTransaction",
  "BankAccount",
  "Product",
  "InventoryTransaction",
  "User",
  "Tenant",
];
const moneyColumns = {
  Quote: ["subtotal", "total", "costEstimate"],
  QuoteItem: ["total"],
  ServiceOrder: ["estimatedValue", "realCost"],
  Invoice: ["value", "taxValue"],
  AccountsReceivable: ["totalValue", "pendingValue", "receivedValue"],
  AccountsPayable: ["value"],
  BankAccount: ["balance"],
  FinancialTransaction: ["value"],
};

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");
if (!['capture', 'verify'].includes(mode)) {
  throw new Error("Uso: node scripts/critical-data-manifest.mjs capture|verify ARQUIVO.json");
}

const connectionString = new URL(process.env.DATABASE_URL);
connectionString.searchParams.delete("schema");
const pool = new Pool({ connectionString: connectionString.toString(), max: 1 });

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

async function collect() {
  const result = { version: 1, capturedAt: new Date().toISOString(), tables: {} };
  for (const table of criticalTables) {
    const exists = await pool.query(
      "SELECT to_regclass($1) IS NOT NULL AS exists",
      [`public.${quoteIdentifier(table)}`],
    );
    if (!exists.rows[0]?.exists) continue;

    const columnsResult = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1",
      [table],
    );
    const available = new Set(columnsResult.rows.map((row) => row.column_name));
    const sums = (moneyColumns[table] || []).filter((column) => available.has(column));
    const expressions = sums.map(
      (column) => `COALESCE(SUM(${quoteIdentifier(column)}), 0)::text AS ${quoteIdentifier(column)}`,
    );
    const data = await pool.query(
      `SELECT COUNT(*)::bigint::text AS "count"${expressions.length ? `, ${expressions.join(", ")}` : ""} FROM ${quoteIdentifier(table)}`,
    );
    result.tables[table] = data.rows[0];
  }
  return result;
}

try {
  const current = await collect();
  if (mode === "capture") {
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(manifestPath, `${JSON.stringify(current, null, 2)}\n`, { mode: 0o600 });
    process.stdout.write(`${JSON.stringify({ success: true, mode, manifestPath, tables: Object.keys(current.tables).length })}\n`);
  } else {
    const before = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const losses = [];
    for (const [table, previous] of Object.entries(before.tables || {})) {
      const next = current.tables[table];
      if (!next) {
        losses.push(`${table}: tabela protegida ausente após atualização`);
        continue;
      }
      for (const [metric, previousValue] of Object.entries(previous)) {
        if (!(metric in next)) continue;
        if (Number(next[metric]) < Number(previousValue)) {
          losses.push(`${table}.${metric}: ${previousValue} -> ${next[metric]}`);
        }
      }
    }
    if (losses.length) throw new Error(`Proteção de dados bloqueou a publicação: ${losses.join("; ")}`);
    process.stdout.write(`${JSON.stringify({ success: true, mode, manifestPath, tables: Object.keys(current.tables).length })}\n`);
  }
} finally {
  await pool.end();
}
