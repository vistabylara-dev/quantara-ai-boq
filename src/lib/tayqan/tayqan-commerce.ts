export const TAYQAN_PRODUCT_FAMILY = "tayqan" as const;

export const TAYQAN_HIRE_PLANS = [
  {
    plan: "DAY",
    productCode: "tayqan_day",
    priceCode: "tayqan_day_299",
    name: "TAYQAN Day Hire",
    amountMinor: 29_900,
    currency: "AED",
    billingInterval: "ONE_TIME",
    checkoutMode: "payment",
    durationHours: 24,
    maxDistinctProjects: 2,
    badge: null,
  },
  {
    plan: "WEEK",
    productCode: "tayqan_week",
    priceCode: "tayqan_week_999",
    name: "TAYQAN Week Hire",
    amountMinor: 99_900,
    currency: "AED",
    billingInterval: "ONE_TIME",
    checkoutMode: "payment",
    durationHours: 24 * 7,
    maxDistinctProjects: null,
    badge: "MOST_POPULAR",
  },
  {
    plan: "MONTHLY",
    productCode: "tayqan_monthly",
    priceCode: "tayqan_monthly_2499",
    name: "TAYQAN Monthly",
    amountMinor: 249_900,
    currency: "AED",
    billingInterval: "MONTH",
    checkoutMode: "subscription",
    durationHours: null,
    maxDistinctProjects: null,
    badge: "DIGITAL_QS",
  },
] as const;

export type TayqanHirePlanCode = (typeof TAYQAN_HIRE_PLANS)[number]["plan"];
export type TayqanPriceCode = (typeof TAYQAN_HIRE_PLANS)[number]["priceCode"];

const BY_PRICE = new Map(TAYQAN_HIRE_PLANS.map((plan) => [plan.priceCode, plan]));
const PRODUCT_CODES = new Set(TAYQAN_HIRE_PLANS.map((plan) => plan.productCode));

export function getTayqanPlanByPriceCode(priceCode: string) {
  return BY_PRICE.get(priceCode as TayqanPriceCode) ?? null;
}

export function getTayqanMaxDistinctProjects(
  plan: string,
): number | null {
  const configured =
    TAYQAN_HIRE_PLANS.find(
      (candidate) =>
        candidate.plan === plan,
    );

  return (
    configured?.maxDistinctProjects
    ?? null
  );
}
export function isTayqanProductCode(productCode: string): boolean {
  return PRODUCT_CODES.has(productCode as (typeof TAYQAN_HIRE_PLANS)[number]["productCode"]);
}

export function isTayqanOneTimeProductCode(productCode: string): boolean {
  return productCode === "tayqan_day" || productCode === "tayqan_week";
}

export function isTayqanMonthlyProductCode(productCode: string): boolean {
  return productCode === "tayqan_monthly";
}
