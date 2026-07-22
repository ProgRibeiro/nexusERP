/**
 * Leitor pequeno de CSV/TSV para a área de colagem do importador.
 * Respeita campos entre aspas, aspas escapadas e quebras de linha internas.
 */
export function parseDelimitedText(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(field.trim());
      field = "";
    } else if (character === "\n" && !quoted) {
      row.push(field.trim());
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  row.push(field.trim());
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

function detectDelimiter(text: string): "," | ";" | "\t" {
  const counts = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (character === "\n" && !quoted) {
      break;
    } else if (!quoted && (character === "," || character === ";" || character === "\t")) {
      counts[character] += 1;
    }
  }
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || ",") as "," | ";" | "\t";
}
