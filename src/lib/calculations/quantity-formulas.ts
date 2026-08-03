/**
 * Deterministic quantity formulas (spec section 23). Every formula is a pure
 * function: inputs, deductions, wastage, and allowances are all explicit
 * parameters and are all returned alongside the result so nothing is
 * hidden. No AI involvement — these are the same kind of calculation as
 * boq-calculator.ts, just for physical quantities instead of commercial
 * totals. Commercial pricing is calculated separately, never here.
 */

export type FormulaResult = {
  formula: string;
  resultValue: number;
  resultUnit: string;
  inputValues: Record<string, number>;
  deductions?: Record<string, number>;
  allowances?: Record<string, number>;
};

function round(value: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function calculateFlooringArea(netFloorArea: number, wastagePercentage: number): FormulaResult {
  const wastage = netFloorArea * (wastagePercentage / 100);
  return {
    formula: "netFloorArea + (netFloorArea × wastage%)",
    resultValue: round(netFloorArea + wastage),
    resultUnit: "m2",
    inputValues: { netFloorArea, wastagePercentage },
    allowances: { wastage: round(wastage) },
  };
}

export function calculateCeilingArea(ceilingArea: number, wastagePercentage: number): FormulaResult {
  const wastage = ceilingArea * (wastagePercentage / 100);
  return {
    formula: "ceilingArea + (ceilingArea × wastage%)",
    resultValue: round(ceilingArea + wastage),
    resultUnit: "m2",
    inputValues: { ceilingArea, wastagePercentage },
    allowances: { wastage: round(wastage) },
  };
}

export function calculateSkirtingLength(perimeter: number, totalDoorWidths: number, wastagePercentage: number): FormulaResult {
  const net = Math.max(0, perimeter - totalDoorWidths);
  const wastage = net * (wastagePercentage / 100);
  return {
    formula: "(perimeter - doorWidths) + wastage%",
    resultValue: round(net + wastage),
    resultUnit: "m",
    inputValues: { perimeter, totalDoorWidths, wastagePercentage },
    deductions: { doorWidths: totalDoorWidths },
    allowances: { wastage: round(wastage) },
  };
}

export function calculateWallFinishArea(wallLength: number, wallHeight: number, openingsArea: number, wastagePercentage: number): FormulaResult {
  const gross = wallLength * wallHeight;
  const net = Math.max(0, gross - openingsArea);
  const wastage = net * (wastagePercentage / 100);
  return {
    formula: "(wallLength × wallHeight - openings) + wastage%",
    resultValue: round(net + wastage),
    resultUnit: "m2",
    inputValues: { wallLength, wallHeight, openingsArea, wastagePercentage },
    deductions: { openingsArea },
    allowances: { wastage: round(wastage) },
  };
}

export function calculatePaintArea(wallArea: number, openingsArea: number, coats: number): FormulaResult {
  const net = Math.max(0, wallArea - openingsArea);
  return {
    formula: "(wallArea - openings) × coats",
    resultValue: round(net * coats),
    resultUnit: "m2",
    inputValues: { wallArea, openingsArea, coats },
    deductions: { openingsArea },
  };
}

export function calculatePartitionArea(length: number, height: number, faces: number): FormulaResult {
  return {
    formula: "length × height × faces",
    resultValue: round(length * height * faces),
    resultUnit: "m2",
    inputValues: { length, height, faces },
  };
}

export function calculateConcreteVolume(length: number, width: number, depth: number): FormulaResult {
  return {
    formula: "length × width × depth",
    resultValue: round(length * width * depth),
    resultUnit: "m3",
    inputValues: { length, width, depth },
  };
}

export function calculateExcavationVolume(length: number, width: number, depth: number): FormulaResult {
  return {
    formula: "length × width × depth",
    resultValue: round(length * width * depth),
    resultUnit: "m3",
    inputValues: { length, width, depth },
  };
}

export function calculateBlockworkArea(wallLength: number, wallHeight: number, openingsArea: number): FormulaResult {
  const net = Math.max(0, wallLength * wallHeight - openingsArea);
  return {
    formula: "wallLength × wallHeight - openings",
    resultValue: round(net),
    resultUnit: "m2",
    inputValues: { wallLength, wallHeight, openingsArea },
    deductions: { openingsArea },
  };
}

export function calculateFormworkArea(exposedConcreteSurfaceArea: number): FormulaResult {
  return {
    formula: "exposedConcreteSurfaceArea",
    resultValue: round(exposedConcreteSurfaceArea),
    resultUnit: "m2",
    inputValues: { exposedConcreteSurfaceArea },
  };
}

/** Uses the schedule quantity directly when available (already a verified extracted value); otherwise a manual bar-length × unit-weight calculation. */
export function calculateReinforcementWeight(scheduleQuantity?: number, barLength?: number, unitWeightPerMeter?: number): FormulaResult {
  if (scheduleQuantity !== undefined) {
    return {
      formula: "scheduleQuantity (from verified schedule)",
      resultValue: round(scheduleQuantity),
      resultUnit: "kg",
      inputValues: { scheduleQuantity },
    };
  }
  if (barLength === undefined || unitWeightPerMeter === undefined) {
    throw new Error("Either scheduleQuantity or both barLength and unitWeightPerMeter are required.");
  }
  return {
    formula: "barLength × unitWeightPerMeter",
    resultValue: round(barLength * unitWeightPerMeter),
    resultUnit: "kg",
    inputValues: { barLength, unitWeightPerMeter },
  };
}

export function calculateDuctSurfaceArea(ductPerimeter: number, length: number): FormulaResult {
  return {
    formula: "ductPerimeter × length",
    resultValue: round(ductPerimeter * length),
    resultUnit: "m2",
    inputValues: { ductPerimeter, length },
  };
}

export function calculatePipeLength(verifiedRouteLength: number, approvedAllowancePercentage: number): FormulaResult {
  const allowance = verifiedRouteLength * (approvedAllowancePercentage / 100);
  return {
    formula: "verifiedRouteLength + approvedAllowance%",
    resultValue: round(verifiedRouteLength + allowance),
    resultUnit: "m",
    inputValues: { verifiedRouteLength, approvedAllowancePercentage },
    allowances: { allowance: round(allowance) },
  };
}

export function calculateCableLength(routeLength: number, verticalDrops: number, approvedTerminationAllowance: number): FormulaResult {
  return {
    formula: "routeLength + verticalDrops + approvedTerminationAllowance",
    resultValue: round(routeLength + verticalDrops + approvedTerminationAllowance),
    resultUnit: "m",
    inputValues: { routeLength, verticalDrops, approvedTerminationAllowance },
    allowances: { terminationAllowance: approvedTerminationAllowance },
  };
}

export function calculateFurnitureCount(verifiedCount: number): FormulaResult {
  return {
    formula: "verifiedCount",
    resultValue: round(verifiedCount, 0),
    resultUnit: "nr",
    inputValues: { verifiedCount },
  };
}
