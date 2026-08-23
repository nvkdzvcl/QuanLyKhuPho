import ExcelJS from 'exceljs';

export interface XlsxColumnDef {
  header: string;
  key: string;
  width?: number;
}

/**
 * Escapes cell values against spreadsheet formula injection for Excel.
 */
function sanitizeXlsxValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string' && /^\s*[=+\-@]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

/**
 * Generates an Excel XLSX workbook buffer using exceljs.
 * Configures frozen styled header row, readable widths, and safe text/number cells.
 */
export async function generateXlsx(
  sheetName: string,
  columns: XlsxColumnDef[],
  rows: Record<string, unknown>[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'QuanLyKhuPho';
  workbook.lastModifiedBy = 'QuanLyKhuPho';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet(sheetName.slice(0, 31), {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  // Define columns
  worksheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width || Math.max(col.header.length + 5, 16),
  }));

  // Style Header Row (Row 1)
  const headerRow = worksheet.getRow(1);
  headerRow.font = {
    name: 'Arial',
    size: 11,
    bold: true,
    color: { argb: 'FF0F172A' }, // slate-900
  };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF1F5F9' }, // slate-100
  };
  headerRow.alignment = {
    vertical: 'middle',
    horizontal: 'left',
    wrapText: false,
  };
  headerRow.height = 28;

  // Add Data Rows
  for (let i = 0; i < rows.length; i++) {
    const rawRow = rows[i]!;
    const sanitizedRow: Record<string, unknown> = {};
    for (const col of columns) {
      sanitizedRow[col.key] = sanitizeXlsxValue(rawRow[col.key]);
    }
    const addedRow = worksheet.addRow(sanitizedRow);
    addedRow.height = 22;
    addedRow.alignment = {
      vertical: 'middle',
      horizontal: 'left',
    };
    addedRow.font = {
      name: 'Arial',
      size: 10,
    };
  }

  // Adjust column widths based on maximum content length (clamped between 12 and 60)
  for (const column of worksheet.columns) {
    let maxLength = 10;
    if (column.header) {
      maxLength = Math.max(maxLength, String(column.header).length);
    }
    if (column.eachCell) {
      column.eachCell({ includeEmpty: false }, (cell) => {
        const val = cell.value ? String(cell.value) : '';
        maxLength = Math.max(maxLength, val.length);
      });
    }
    column.width = Math.min(Math.max(maxLength + 4, 14), 60);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
