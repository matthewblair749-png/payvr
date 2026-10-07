/**
 * CSV parsing (RFC 4180): quoted fields, escaped quotes, CRLF/LF, a BOM,
 * and comma / semicolon / tab / pipe delimiters (sniffed from the header).
 * Hard limits keep a hostile or broken file from exhausting the server.
 */
export class CsvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvError";
  }
}

export const CSV_LIMITS = { maxRows: 200_000, maxColumns: 100, maxCell: 1_000, maxBytes: 10 * 1024 * 1024 };

export interface ParsedCsv {
  header: string[];
  rows: string[][];
  delimiter: string;
}

function sniff(text: string): string {
  const firstLine = text.slice(0, text.search(/\r?\n/) === -1 ? text.length : text.search(/\r?\n/));
  let best = ",";
  let bestCount = 0;
  for (const d of [",", ";", "\t", "|"]) {
    let count = 0;
    let quoted = false;
    for (const ch of firstLine) {
      if (ch === '"') quoted = !quoted;
      else if (ch === d && !quoted) count++;
    }
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

export function parseCsv(input: string, maxRows = CSV_LIMITS.maxRows): ParsedCsv {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  if (!text.trim()) throw new CsvError("The file is empty.");
  if (text.includes("\u0000")) throw new CsvError("This doesn't look like a text CSV file.");
  const d = sniff(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = 0;
  const n = text.length;

  const endField = () => {
    if (field.length > CSV_LIMITS.maxCell) throw new CsvError(`A cell is longer than ${CSV_LIMITS.maxCell} characters. Is this the right file?`);
    row.push(field);
    field = "";
    if (row.length > CSV_LIMITS.maxColumns) throw new CsvError(`The file has more than ${CSV_LIMITS.maxColumns} columns.`);
  };
  const endRow = () => {
    endField();
    if (!(row.length === 1 && row[0].trim() === "")) rows.push(row);
    row = [];
    if (rows.length > maxRows + 1) throw new CsvError(`The file has more than ${maxRows.toLocaleString("en-US")} rows. Upload a monthly summary or split the file.`);
  };

  while (i < n) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"' && field.trim() === "") {
      quoted = true;
      field = "";
      i++;
    } else if (ch === d) {
      endField();
      i++;
    } else if (ch === "\r" || ch === "\n") {
      endRow();
      i += ch === "\r" && text[i + 1] === "\n" ? 2 : 1;
    } else {
      field += ch;
      i++;
    }
  }
  if (quoted) throw new CsvError("A quoted value is never closed. Check the file for a stray quote mark.");
  if (field !== "" || row.length) endRow();

  if (rows.length < 2) throw new CsvError("The file needs a header row and at least one row of data.");
  const seen = new Map<string, number>();
  const header = rows[0].map((h, k) => {
    let name = h.trim().replace(/\s+/g, " ").slice(0, 80) || `Column ${k + 1}`;
    const c = seen.get(name.toLowerCase()) ?? 0;
    seen.set(name.toLowerCase(), c + 1);
    if (c) name = `${name} (${c + 1})`;
    return name;
  });
  const body = rows.slice(1).map((r) => {
    const out = r.slice(0, header.length).map((c) => c.trim());
    while (out.length < header.length) out.push("");
    return out;
  });
  return { header, rows: body, delimiter: d };
}
