import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;
const candidatePort = process.env.CANDIDATE_PORT || process.argv[2] || "3001";
const snapshotDir = path.resolve(process.env.SNAPSHOT_DIR || "update-safety/ui-snapshots");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL não configurada.");
  process.exit(1);
}

const connectionString = new URL(process.env.DATABASE_URL);
connectionString.searchParams.delete("schema");
const pool = new Pool({ connectionString: connectionString.toString(), max: 2 });

async function verifyVisualAndRenderIntegrity() {
  console.log(`\n================ AUDITORIA DE INTEGRIDADE VISUAL E TELAS (PORTA ${candidatePort}) ================`);

  const errors = [];
  const snapshot = {
    capturedAt: new Date().toISOString(),
    candidatePort,
    screens: {},
  };

  try {
    // 1. Snapshot e Validação da Tela Financeiro
    const dbRecs = await pool.query('SELECT COUNT(*)::int AS count, COALESCE(SUM("totalValue"), 0)::numeric AS total, COALESCE(SUM("pendingValue"), 0)::numeric AS pending FROM "AccountsReceivable"');
    const dbPay = await pool.query('SELECT COUNT(*)::int AS count, COALESCE(SUM("value"), 0)::numeric AS total FROM "AccountsPayable"');
    const dbBanks = await pool.query('SELECT COUNT(*)::int AS count, COALESCE(SUM("balance"), 0)::numeric AS balance FROM "BankAccount"');

    const expectedRecsCount = dbRecs.rows[0]?.count || 0;
    const expectedRecsTotal = Number(dbRecs.rows[0]?.total || 0);
    const expectedPendingTotal = Number(dbRecs.rows[0]?.pending || 0);

    const expectedPayCount = dbPay.rows[0]?.count || 0;
    const expectedBankCount = dbBanks.rows[0]?.count || 0;

    snapshot.screens.financeiro = {
      contasReceberEsperadas: expectedRecsCount,
      valorTotalReceber: expectedRecsTotal,
      valorPendenteReceber: expectedPendingTotal,
      contasPagarEsperadas: expectedPayCount,
      contasBancariasEsperadas: expectedBankCount,
    };

    console.log(`[Financeiro] DB Contas a Receber: ${expectedRecsCount} registros | Total: R$ ${expectedRecsTotal.toFixed(2)} | Pendente: R$ ${expectedPendingTotal.toFixed(2)}`);
    console.log(`[Financeiro] DB Contas a Pagar: ${expectedPayCount} registros | Bancos: ${expectedBankCount} contas`);

    // 2. Snapshot e Validação da Tela de Ordens de Serviço
    const dbOS = await pool.query('SELECT COUNT(*)::int AS count FROM "ServiceOrder"');
    const expectedOSCount = dbOS.rows[0]?.count || 0;
    snapshot.screens.ordensServico = { totalEsperado: expectedOSCount };
    console.log(`[Ordens de Serviço] DB Total: ${expectedOSCount} ordens de serviço`);

    // 3. Snapshot e Validação da Tela de Clientes
    const dbClients = await pool.query('SELECT COUNT(*)::int AS count FROM "Client"');
    const expectedClientsCount = dbClients.rows[0]?.count || 0;
    snapshot.screens.clientes = { totalEsperado: expectedClientsCount };
    console.log(`[Clientes] DB Total: ${expectedClientsCount} clientes cadastrados`);

    // 4. Teste de Endpoint de Health & Integridade do Slot Candidato
    const candidateUrl = `http://127.0.0.1:${candidatePort}/api/health`;
    console.log(`\nTestando resposta HTTP do slot candidato em ${candidateUrl}...`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    try {
      const res = await fetch(candidateUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) {
        errors.push(`Health check HTTP ${res.status} falhou em ${candidateUrl}`);
      } else {
        const body = await res.json();
        snapshot.healthResponse = body;

        if (body.status !== "ok") {
          errors.push(`Resposta de integridade do slot não está ok: ${JSON.stringify(body)}`);
        }

        // Valida se as contagens retornadas pelo endpoint de integridade batem
        if (body.integrity) {
          if (expectedRecsCount > 0 && body.integrity.receivables === 0) {
            errors.push(`REGRESSÃO VISUAL GRAVE: O banco tem ${expectedRecsCount} contas a receber, mas o slot candidato retornou 0!`);
          }
          if (expectedClientsCount > 0 && body.integrity.clients === 0) {
            errors.push(`REGRESSÃO VISUAL GRAVE: O banco tem ${expectedClientsCount} clientes, mas o slot candidato retornou 0!`);
          }
        }
      }
    } catch (err) {
      clearTimeout(timeout);
      errors.push(`Falha de conexão com o slot candidato na porta ${candidatePort}: ${err.message}`);
    }

    // Salva a fotografia/snapshot em arquivo para histórico e auditoria
    fs.mkdirSync(snapshotDir, { recursive: true });
    const snapshotFile = path.join(snapshotDir, `ui-snapshot-${Date.now()}.json`);
    fs.writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2), "utf8");
    console.log(`Fotografia das telas gravada com sucesso em: ${snapshotFile}`);

    if (errors.length > 0) {
      console.error("\n❌ FALHA NA AUDITORIA VISUAL / REGRESSÃO DE TELAS:");
      for (const err of errors) {
        console.error(` - ${err}`);
      }
      throw new Error(`Blindagem Visual detectou erro na renderização das telas: ${errors.join(" | ")}`);
    }

    console.log("\n✅ TODAS AS TELAS E DADOS PASSARAM NA AUDITORIA VISUAL DE INTEGRIDADE!");
    process.exit(0);

  } catch (error) {
    console.error(`\n🚨 BLINDAGEM VISUAL ABORTOU O DEPLOY: ${error.message}`);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

verifyVisualAndRenderIntegrity();
