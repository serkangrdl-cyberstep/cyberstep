/**
 * Yüklenen Excel/CSV dosyasının ilk sayfasını başlık satırına göre nesne dizisine çevirir.
 * `xlsx` (SheetJS) paketinin yerine geçer: npm'deki sürümünde bilinen yüksek şiddetli
 * açıklar var ve yama yayımlanmıyor. Yalnızca .xlsx ve .csv desteklenir (.xls desteklenmez).
 */

function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delim = [";", ",", "\t"].map((d) => [d, firstLine.split(d).length] as const).sort((a, b) => b[1] - a[1])[0]![0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]!;
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      rows.push(row); row = [];
    } else cur += ch;
  }
  if (cur !== "" || row.length > 0) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function toObjects(table: string[][]): Record<string, string>[] {
  const header = table[0] ?? [];
  const out: Record<string, string>[] = [];
  for (const cells of table.slice(1)) {
    const obj: Record<string, string> = {};
    header.forEach((h, i) => {
      const key = h.trim();
      if (key) obj[key] = (cells[i] ?? "").trim();
    });
    if (Object.values(obj).some((v) => v !== "")) out.push(obj);
  }
  return out;
}

export async function readSheetRows(file: File): Promise<Record<string, string>[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xls")) {
    throw new Error("Eski .xls biçimi desteklenmiyor. Dosyayı .xlsx veya .csv olarak kaydedip tekrar yükleyin.");
  }
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    return toObjects(parseCsv(await file.text()));
  }
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const table: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    for (let c = 1; c <= row.cellCount; c++) cells.push(String(row.getCell(c).text ?? ""));
    table.push(cells);
  });
  return toObjects(table);
}
