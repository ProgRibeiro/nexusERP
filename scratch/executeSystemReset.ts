import { resetSystemDataAction } from "../src/app/actions/settingsActions";

async function main() {
  console.log("Executando o zeramento seguro do banco de dados operacional...");
  const res = await resetSystemDataAction("ZERAR-SISTEMA-CONFIRMAR");

  if (res.success) {
    console.log("=== SISTEMA ZERADO COM SUCESSO! ===");
    console.log("✔ Todos os clientes, orçamentos, ordens de serviço, atendimentos e notas fiscais de teste foram removidos.");
    console.log("✔ Um snapshot pré-restauração de segurança foi gravado em backups/.");
  } else {
    console.error("Erro ao zerar o sistema:", res.error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
