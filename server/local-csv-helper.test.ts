import { describe, expect, it } from "vitest";
import { parseLocalGradeCsv } from "../shared/local-csv-helper";

describe("local grade CSV helper", () => {
  it("parses BOM, CRLF, quoted commas/quotes, Arabic digits, and a real zero", () => {
    const result = parseLocalGradeCsv('\uFEFF"ليلى، أ""مين",٠\r\n"سارة",٩٥.٥\r\n');
    expect(result.rows).toEqual([
      { name: "ليلى، أ\"مين", score: 0 },
      { name: "سارة", score: 95.5 },
    ]);
    expect(result.warnings).toEqual([]);
  });

  it("warns instead of silently dropping invalid rows and enforces bounded cells", () => {
    const result = parseLocalGradeCsv("صالح,80\nفارغ,\n\"اسم,بعمود\",90,زائد\n");
    expect(result.rows).toEqual([{ name: "صالح", score: 80 }]);
    expect(result.warnings.join(" ")).toMatch(/الصف 2/);
    expect(result.warnings.join(" ")).toMatch(/فـ?ارغة|فارغة/);
    expect(result.warnings.join(" ")).toMatch(/الصف 3/);
  });
});
