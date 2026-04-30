/**
 * Tiny client-side CSV download. Used by the FM doplers + positions
 * export buttons. RFC 4180 escaping (double-quoted, internal quotes
 * doubled) with a defensive newline flatten so multi-line content
 * (future thesis notes, descriptions) doesn't trip Excel/Numbers.
 *
 * Cells accept `string | number | null | undefined` so callers can pass
 * Supabase rows directly without pre-stringifying numeric or nullable
 * columns. The escape coerces with `String(v ?? "")`.
 */

export type CellValue = string | number | null | undefined;

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: CellValue[][]
): void {
  const escape = (v: CellValue) => {
    const s = String(v ?? "").replace(/[\r\n]+/g, " ");
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = [headers.map(escape).join(",")];
  for (const row of rows) lines.push(row.map(escape).join(","));
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
