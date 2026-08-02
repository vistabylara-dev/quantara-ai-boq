import { describe, expect, it } from "vitest";
import {
  INITIAL_REVISION_NUMBER,
  InvalidRevisionNumberError,
  incrementRevisionNumber,
  nextRevisionSequence,
} from "../src/lib/revisions/revision-number";

describe("revision numbering", () => {
  it("starts at R01 and increments with stable padding", () => {
    expect(INITIAL_REVISION_NUMBER).toBe("R01");
    expect(incrementRevisionNumber("R01")).toBe("R02");
    expect(incrementRevisionNumber("R09")).toBe("R10");
    expect(incrementRevisionNumber(99)).toBe("R100");
    expect(nextRevisionSequence("R03")).toBe(4);
  });

  it("rejects malformed and non-positive revisions", () => {
    expect(() => incrementRevisionNumber("revision-1")).toThrow(InvalidRevisionNumberError);
    expect(() => incrementRevisionNumber(0)).toThrow(InvalidRevisionNumberError);
  });
});
