/**
 * Escapes a single cell value for CSV output with protection against spreadsheet formula injection.
 * Strings starting with '=', '+', '-', or '@' (after optional leading whitespace) are prefixed with "'".
 * Fields containing commas, quotes, or newlines are wrapped in double quotes, with internal quotes doubled.
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  let str = String(value);

  // Prevent formula injection in spreadsheet applications (Excel, LibreOffice, Google Sheets)
  if (typeof value === 'string' && /^\s*[=+\-@]/.test(str)) {
    str = `'${str}`;
  }

  // Quote cell if it contains special characters: comma, double quote, newline, carriage return
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Builds a single CSV row from an array of values.
 */
export function buildCsvRow(cells: unknown[]): string {
  return cells.map((cell) => escapeCsvCell(cell)).join(',');
}

/**
 * Generates a full UTF-8 BOM encoded CSV string from headers and data rows.
 */
export function generateCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][],
): string {
  const lines: string[] = [];

  // Header row
  lines.push(buildCsvRow(headers));

  // Data rows
  for (const row of rows) {
    lines.push(buildCsvRow(row));
  }

  // Prepend UTF-8 BOM (\uFEFF) and join with standard CRLF
  return '\uFEFF' + lines.join('\r\n');
}
