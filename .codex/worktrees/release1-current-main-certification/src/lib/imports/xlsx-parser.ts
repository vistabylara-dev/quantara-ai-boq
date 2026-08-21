import ExcelJS from "exceljs";

export async function parseXlsx(buffer: Buffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const rows: string[][] = [];
  sheet.eachRow((row) => {
    const values: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      const value = cell.value;
      if (value === null || value === undefined) values.push("");
      else if (typeof value === "object" && "text" in value) values.push(String((value as { text: unknown }).text ?? ""));
      else if (typeof value === "object" && "result" in value) values.push(String((value as { result: unknown }).result ?? ""));
      else values.push(String(value));
    });
    if (values.some((v) => v.trim() !== "")) rows.push(values);
  });
  return rows;
}
