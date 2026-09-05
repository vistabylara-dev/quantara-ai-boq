import { describe, expect, it } from "vitest";
import { parsePositionalTextFallback } from "../src/lib/files/table-extraction/pdf-positional-text-fallback";

/**
 * CANVA-HUMAN-JOURNEY-FINAL — the third deterministic PDF table-recovery
 * fallback. Input here is exactly the shape pdf-parse's own getText()
 * produces when called with cellSeparator: "\t" (real PDF text-coordinate
 * column-band detection) and lineEnforce: true (real Y-proximity row
 * clustering) — this module only decides whether that reconstruction is
 * trustworthy enough to call a table, never re-derives geometry itself.
 */
describe("parsePositionalTextFallback", () => {
  it("preserves every row in a headerless Joinery item schedule and counts each exact occurrence", () => {
    const tables = parsePositionalTextFallback(
      [
        "J05\tMASTER BATH\tCABINET WITH DRAWERS",
        "J06\tMASTER BATH\tCABINET WITH DOOR AND OPEN SHELF",
        "J07\tKITCHEN\tSINK BASE CABINET",
      ].join("\n"),
      1,
    );

    expect(tables).toHaveLength(1);
    expect(tables[0].title).toBe("Joinery item schedule — page 1");
    expect(tables[0].rows).toHaveLength(3);
    expect(tables[0].rows[0].cells).toEqual(expect.arrayContaining([
      expect.objectContaining({ columnKey: "item_code", rawValue: "J05" }),
      expect.objectContaining({ columnKey: "room", rawValue: "MASTER BATH" }),
      expect.objectContaining({ columnKey: "description", rawValue: "CABINET WITH DRAWERS" }),
      expect.objectContaining({ columnKey: "quantity", rawValue: "1" }),
      expect.objectContaining({ columnKey: "unit", rawValue: "nr" }),
    ]));
  });

  it("recovers a table when enough rows agree on the same column count", () => {
    const text = [
      "Item\tDescription\tQty\tUnit",
      "C-001\tConcrete 25 MPa\t45\tm3",
      "C-002\tReinforcement 16mm\t6.8\ttonne",
      "C-003\tFormwork\t120\tm2",
    ].join("\n");

    const tables = parsePositionalTextFallback(text, 3);
    expect(tables).toHaveLength(1);
    expect(tables[0].method).toBe("pdf-positional-text-fallback");
    expect(tables[0].rows).toHaveLength(3);
    expect(tables[0].rows[0].cells.map((c) => c.rawValue)).toEqual(["C-001", "Concrete 25 MPa", "45", "m3"]);
    expect(tables[0].rows[0].cells[0].columnTitle).toBe("Item");
  });

  it("rejects a page with too few consistent rows rather than guessing", () => {
    const text = [
      "Some heading text",
      "A\tB",
      "Just a caption line",
      "More prose that isn't tabular at all, running on",
    ].join("\n");

    expect(parsePositionalTextFallback(text, 1)).toEqual([]);
  });

  it("ignores single-column noise (running headers/footers) and still recovers the real table", () => {
    const text = [
      "PROJECT DRAWING — PAGE 4",
      "Item\tDescription\tQty\tUnit",
      "C-001\tConcrete\t10\tm3",
      "C-002\tRebar\t2\ttonne",
      "C-003\tFormwork\t30\tm2",
      "— continued —",
    ].join("\n");

    const tables = parsePositionalTextFallback(text, 4);
    expect(tables).toHaveLength(1);
    expect(tables[0].rows).toHaveLength(3);
  });

  it("rejects a page with no rows sharing a column count at all", () => {
    expect(parsePositionalTextFallback("just one line of text", 1)).toEqual([]);
    expect(parsePositionalTextFallback("", 1)).toEqual([]);
  });

  it("drops empty trailing cells rather than fabricating values", () => {
    const text = [
      "Item\tDescription\tQty\tUnit",
      "C-001\tConcrete\t10\t",
      "C-002\tRebar\t2\ttonne",
      "C-003\tFormwork\t30\tm2",
    ].join("\n");

    const tables = parsePositionalTextFallback(text, 5);
    expect(tables).toHaveLength(1);
    const firstRow = tables[0].rows[0];
    expect(firstRow.cells.map((c) => c.columnTitle)).toEqual(["Item", "Description", "Qty"]);
  });
});
