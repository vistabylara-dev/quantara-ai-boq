import { describe, expect, it } from "vitest";
import { parsePdfGridTable } from "../src/lib/files/table-extraction/pdf-table-grid-normalization";
import { parseStructuralScheduleTextFallback } from "../src/lib/files/table-extraction/pdf-text-schedule-fallback";

describe("representative construction schedule recovery", () => {
  it("reconstructs a multi-level tie-beam schedule and keeps every row/cell under the correct full header path", () => {
    const table = parsePdfGridTable([
      ["SCHEDULE OF TIE BEAM", "", "", "", "", "", "", "", ""],
      ["TYPE", "DIMENSIONS\n(cm)", "REINFORCEMENT", "", "", "", "", "", "NOTES"],
      ["", "", "BOTTOM STEEL", "", "TOP STEEL", "", "SIDE BARS\nFOR EACH\nSIDE", "STIRRUPS", ""],
      ["", "", "STRAIGHT", "EXTRA AT\nSUPPORT", "STRAIGHT", "EXTRA AT\nSUPPORT", "", "", ""],
      ["TB1", "20 X 60", "3 T 16", "----", "2 T 16", "1 T 16", "----", "T8 @15cm", ""],
      ["TB2", "25 X 70", "4 T 16", "----", "3 T 16", "----", "2 T 12", "T8 @10cm", ""],
    ], 1, 0);

    expect(table).not.toBeNull();
    expect(table!.rows).toHaveLength(2);

    const first = table!.rows[0].cells;
    expect(first.find((cell) => cell.rawValue === "3 T 16")?.columnTitle)
      .toBe("REINFORCEMENT > BOTTOM STEEL > STRAIGHT");
    expect(first.find((cell) => cell.rawValue === "2 T 16")?.columnTitle)
      .toBe("REINFORCEMENT > TOP STEEL > STRAIGHT");
    expect(first.find((cell) => cell.rawValue === "T8 @15cm")?.columnTitle)
      .toBe("REINFORCEMENT > STIRRUPS");

    const second = table!.rows[1].cells;
    expect(second.find((cell) => cell.rawValue === "4 T 16")?.columnTitle)
      .toBe("REINFORCEMENT > BOTTOM STEEL > STRAIGHT");
    expect(second.find((cell) => cell.rawValue === "3 T 16")?.columnTitle)
      .toBe("REINFORCEMENT > TOP STEEL > STRAIGHT");
  });

  it("reconstructs multiple footing rows with dimension and reinforcement parent headers", () => {
    const table = parsePdfGridTable([
      ["SCHEDULE OF FOOTING", "", "", "", "", "", "", "", ""],
      ["TYPE", "R.C.C DIMENSIONS (cm)", "", "", "REINFORCEMENT", "", "", "", "NOTES"],
      ["", "", "", "", "BOTTOM STEEL", "", "TOP STEEL", "", ""],
      ["", "L", "B", "D", "LONG SPAN", "SHORT SPAN", "LONG SPAN", "SHORT SPAN", ""],
      ["F1", "160", "120", "35", "T12@20cm", "T12@20cm", "----", "----", "300kN"],
      ["F2", "220", "180", "40", "T12@15cm", "T12@15cm", "----", "----", "700kN"],
      ["F3", "240", "220", "40", "T12@15cm", "T12@15cm", "----", "----", "950kN"],
    ], 1, 1);

    expect(table!.rows).toHaveLength(3);
    expect(table!.rows[0].cells.find((cell) => cell.rawValue === "160")?.columnTitle)
      .toBe("R.C.C DIMENSIONS (cm) > L");
    expect(table!.rows[2].cells.find((cell) => cell.rawValue === "950kN")?.columnTitle)
      .toBe("NOTES");
  });

  it("recovers all exact structural schedule rows from a text layer when vector grid geometry is unavailable", () => {
    const text = [
      "SCHEDULE OF TIE BEAM",
      "TYPE",
      "DIMENSIONS",
      "(cm)",
      "REINFORCEMENT",
      "TB1 20 X 60 3 T 16 ---- 2 T 16 1 T 16 ---- T8 @15cm",
      "SCHEDULE OF BEAM",
      "B1 20 X 80 4 T 16 ---- 3 T 16 ---- 2 T 12 T8 @15cm",
      "CB 20 X 80 2 T 16 ---- 6 T 16 ---- 2 T 12 T8 @10cm",
      "SCHEDULE OF FOOTING",
      "F1 160 120 35 T12@20cm T12@20cm ---- ---- 300kN",
      "F2 220 180 40 T12@15cm T12@15cm ---- ---- 700kN",
      "F2* 220 180 40 T12@15cm T12@15cm T12@15cm T12@15cm",
      "F3 240 220 40 T12@15cm T12@15cm ---- ---- 950kN",
      "F4 300 240 55 T12@15cm T12@15cm T12@15cm T12@15cm",
      "F5 240 160 45 T12@15cm T12@15cm ---- ---- 700kN",
      "F6 180 110 40 T12@15cm T12@15cm ---- ---- 350kN",
    ].join("\n");

    const tables = parseStructuralScheduleTextFallback(text, 1);
    expect(tables).toHaveLength(3);
    expect(tables.find((table) => table.title === "SCHEDULE OF TIE BEAM")?.rows).toHaveLength(1);
    expect(tables.find((table) => table.title === "SCHEDULE OF BEAM")?.rows).toHaveLength(2);
    expect(tables.find((table) => table.title === "SCHEDULE OF FOOTING")?.rows).toHaveLength(7);

    const footingF6 = tables
      .find((table) => table.title === "SCHEDULE OF FOOTING")!
      .rows.find((row) => row.cells.some((cell) => cell.rawValue === "F6"))!;

    expect(footingF6.cells.find((cell) => cell.rawValue === "180")?.columnTitle)
      .toBe("R.C.C Dimensions (cm) > L");
    expect(footingF6.cells.find((cell) => cell.rawValue === "350kN")?.columnTitle)
      .toBe("Notes / Load");
  });
});
