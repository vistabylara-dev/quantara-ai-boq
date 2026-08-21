import { describe, expect, it } from "vitest";
import {
  calculateBlockworkArea,
  calculateCableLength,
  calculateCeilingArea,
  calculateConcreteVolume,
  calculateDuctSurfaceArea,
  calculateExcavationVolume,
  calculateFlooringArea,
  calculateFormworkArea,
  calculateFurnitureCount,
  calculatePaintArea,
  calculatePartitionArea,
  calculatePipeLength,
  calculateReinforcementWeight,
  calculateSkirtingLength,
  calculateWallFinishArea,
} from "../src/lib/calculations/quantity-formulas";

describe("Phase 8 sub-phase 11: deterministic quantity formulas", () => {
  it("flooring area adds wastage on top of net area", () => {
    const result = calculateFlooringArea(100, 5);
    expect(result.resultValue).toBe(105);
    expect(result.allowances?.wastage).toBe(5);
  });

  it("ceiling area adds wastage", () => {
    expect(calculateCeilingArea(50, 10).resultValue).toBe(55);
  });

  it("skirting length deducts door widths before adding wastage", () => {
    const result = calculateSkirtingLength(40, 8, 5);
    expect(result.resultValue).toBe(33.6);
    expect(result.deductions?.doorWidths).toBe(8);
  });

  it("wall finish area deducts openings before adding wastage", () => {
    const result = calculateWallFinishArea(10, 3, 2, 10);
    // gross 30, net 28, +10% = 30.8
    expect(result.resultValue).toBe(30.8);
  });

  it("paint area multiplies net area by coat factor", () => {
    expect(calculatePaintArea(50, 5, 2).resultValue).toBe(90);
  });

  it("partition area multiplies by applicable faces", () => {
    expect(calculatePartitionArea(5, 3, 2).resultValue).toBe(30);
  });

  it("concrete volume is length x width x depth", () => {
    expect(calculateConcreteVolume(2, 3, 0.5).resultValue).toBe(3);
  });

  it("excavation volume matches concrete volume formula", () => {
    expect(calculateExcavationVolume(2, 3, 0.5).resultValue).toBe(3);
  });

  it("blockwork area deducts openings, never goes negative", () => {
    expect(calculateBlockworkArea(10, 3, 40).resultValue).toBe(0);
  });

  it("formwork area passes through the exposed surface area", () => {
    expect(calculateFormworkArea(12.5).resultValue).toBe(12.5);
  });

  it("reinforcement weight prefers a verified schedule quantity over a manual calculation", () => {
    const result = calculateReinforcementWeight(580, 100, 10);
    expect(result.resultValue).toBe(580);
    expect(result.formula).toContain("verified schedule");
  });

  it("reinforcement weight falls back to bar-length x unit-weight when no schedule quantity exists", () => {
    const result = calculateReinforcementWeight(undefined, 100, 0.395);
    expect(result.resultValue).toBe(39.5);
  });

  it("reinforcement weight throws when neither a schedule quantity nor bar-length/unit-weight are provided", () => {
    expect(() => calculateReinforcementWeight()).toThrow();
  });

  it("duct surface area is perimeter x length", () => {
    expect(calculateDuctSurfaceArea(1.6, 20).resultValue).toBe(32);
  });

  it("pipe length adds an approved allowance percentage", () => {
    const result = calculatePipeLength(100, 5);
    expect(result.resultValue).toBe(105);
  });

  it("cable length sums route, vertical drops, and termination allowance", () => {
    expect(calculateCableLength(50, 6, 2).resultValue).toBe(58);
  });

  it("furniture count passes through the verified count", () => {
    expect(calculateFurnitureCount(12).resultValue).toBe(12);
  });
});
