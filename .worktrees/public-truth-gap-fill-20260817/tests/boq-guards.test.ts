import { describe, expect, it } from "vitest";
import {
  BOQLockBlockedError,
  LockedBOQError,
  assertBOQCanBeLocked,
  assertBOQEditable,
  isBOQLocked,
} from "../src/lib/domain/boq-guards";

describe("BOQ lock protection", () => {
  it("blocks edits when the lock flag or immutable status is present", () => {
    expect(isBOQLocked({ isLocked: true, status: "DRAFT" })).toBe(true);
    expect(isBOQLocked({ isLocked: false, status: "ISSUED" })).toBe(true);
    expect(isBOQLocked({ isLocked: false, status: "DRAFT" })).toBe(false);
    expect(() => assertBOQEditable({ id: "boq-1", isLocked: true })).toThrow(LockedBOQError);
  });

  it("blocks locking while unresolved critical verification exceptions exist", () => {
    expect(() =>
      assertBOQCanBeLocked([
        { severity: "CRITICAL", resolved: false },
        { severity: "WARNING", resolved: false },
      ]),
    ).toThrow(BOQLockBlockedError);

    expect(() => assertBOQCanBeLocked([{ severity: "CRITICAL", resolved: true }])).not.toThrow();
  });
});
