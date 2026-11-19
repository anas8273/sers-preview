export const LOCAL_GRADE_CSV_MAX_BYTES = 1_000_000;
export const LOCAL_GRADE_CSV_MAX_ROWS = 1_000;
export const LOCAL_GRADE_CSV_MAX_COLUMNS = 2;
export const LOCAL_GRADE_CSV_MAX_CELL_CHARS = 256;
export const LOCAL_GRADE_CSV_MAX_NAME_CHARS = 200;
export const LOCAL_GRADE_CSV_MAX_SCORE = 1_000;

export type LocalGradeCsvRow = { name: string; score: number };
export type LocalGradeCsvResult = { rows: LocalGradeCsvRow[]; warnings: string[] };

function normalizeDigits(value: string) {
  return value.replace(/[٠-٩۰-۹]/g, digit => {
    const code = digit.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

function parseCsvRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let justClosedQuote = false;

  const pushCell = () => {
    row.push(cell);
    cell = "";
    justClosedQuote = false;
  };
  const pushRow = () => {
    if (row.length !== 1 || row[0].trim() !== "") rows.push(row);
    row = [];
  };

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
          justClosedQuote = true;
        }
      } else {
        cell += character;
      }
      continue;
    }
    if (justClosedQuote) {
      if (character === " " || character === "\t") continue;
      if (character === ",") {
        pushCell();
        continue;
      }
      if (character === "\r" || character === "\n") {
        pushCell();
        if (character === "\r" && input[index + 1] === "\n") index += 1;
        pushRow();
        continue;
      }
      throw new Error(`CSV: quoted cell has unexpected text near character ${index + 1}`);
    }
    if (character === '"' && cell.trim() === "") {
      quoted = true;
      cell = "";
    } else if (character === ",") {
      pushCell();
    } else if (character === "\r" || character === "\n") {
      pushCell();
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      pushRow();
    } else {
      cell += character;
    }
  }
  if (quoted) throw new Error("CSV: an opening quote is not closed");
  if (cell.length > 0 || row.length > 0 || justClosedQuote) {
    pushCell();
    pushRow();
  }
  return rows;
}

export function parseLocalGradeCsv(input: string): LocalGradeCsvResult {
  if (typeof input !== "string") throw new Error("CSV: file text is unavailable");
  const rows = parseCsvRows(input.replace(/^\uFEFF/, ""));
  if (rows.length > LOCAL_GRADE_CSV_MAX_ROWS) {
    throw new Error(`CSV يحتوي على أكثر من ${LOCAL_GRADE_CSV_MAX_ROWS} صف؛ اختر ملفًا أصغر.`);
  }

  const accepted: LocalGradeCsvRow[] = [];
  const warnings: string[] = [];
  rows.forEach((cells, index) => {
    const rowNumber = index + 1;
    if (cells.length !== LOCAL_GRADE_CSV_MAX_COLUMNS) {
      warnings.push(`الصف ${rowNumber}: يجب أن يحتوي على عمودين (اسم الطالب، الدرجة) ولم يُستورد.`);
      return;
    }
    if (cells.some(value => value.length > LOCAL_GRADE_CSV_MAX_CELL_CHARS)) {
      warnings.push(`الصف ${rowNumber}: يتجاوز طول خلية ${LOCAL_GRADE_CSV_MAX_CELL_CHARS} حرفًا ولم يُستورد.`);
      return;
    }
    const name = cells[0].trim();
    const rawScore = normalizeDigits(cells[1].trim());
    if (!name) {
      warnings.push(`الصف ${rowNumber}: اسم الطالب فارغ ولم يُستورد.`);
      return;
    }
    if (name.length > LOCAL_GRADE_CSV_MAX_NAME_CHARS) {
      warnings.push(`الصف ${rowNumber}: اسم الطالب يتجاوز ${LOCAL_GRADE_CSV_MAX_NAME_CHARS} حرفًا ولم يُستورد.`);
      return;
    }
    if (!rawScore) {
      warnings.push(`الصف ${rowNumber}: الدرجة فارغة وليست صفرًا؛ لم يُستورد.`);
      return;
    }
    const score = Number(rawScore);
    if (!/^(?:\d+)(?:\.\d+)?$/.test(rawScore) || !Number.isFinite(score) || score < 0 || score > LOCAL_GRADE_CSV_MAX_SCORE) {
      warnings.push(`الصف ${rowNumber}: الدرجة يجب أن تكون رقمًا من 0 إلى ${LOCAL_GRADE_CSV_MAX_SCORE}؛ لم يُستورد.`);
      return;
    }
    accepted.push({ name, score });
  });
  return { rows: accepted, warnings };
}
