const fs = require('fs');
let code = fs.readFileSync('src/app/settings/subscription/page.tsx', 'utf8');

code = code.replace(
  'enterpriseProducts?: EnterpriseAnnualPlan[]',
  ''
);

const startEA = code.indexOf('type EnterpriseAnnualPlan = {');
if (startEA > -1) {
    const endEA = code.indexOf('};', startEA) + 2;
    code = code.substring(0, startEA) + code.substring(endEA);
}

const fromConstruct = `const enterpriseProducts = ENTERPRISE_PRODUCT_ORDER.map((productCode) =>
    checkoutAvailability?.enterpriseProducts?.find((product) => product.productCode === productCode),
  ).filter((product): product is EnterpriseAnnualPlan => Boolean(product));`;

const toConstruct = `const enterpriseProducts = ENTERPRISE_PRODUCT_ORDER.map((productCode) =>
    checkoutAvailability?.products.find((product) => product.productCode === productCode),
  ).filter((product): product is CheckoutOptionProduct => Boolean(product));`;

code = code.replace(fromConstruct, toConstruct);

code = code.replace(
  'const price = product.price;',
  'const price = product.prices.find((p) => p.billingInterval === "YEAR");'
);

const oldButtonsRegex = /\{currentPlan \? \([\s\S]*?<Link[\s\S]*?href="\/contact-sales"[\s\S]*?\{ctaLabel\}[\s\S]*?<\/Link>[\s\S]*?\)\}/;
const newButtons = `{currentPlan ? (
                        <button
                          type="button"
                          disabled
                          aria-current={isSelectedPricingIntent ? "true" : undefined}
                          data-selected-pricing-intent={isSelectedPricingIntent ? "true" : undefined}
                          className="mt-7 w-full rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {ctaLabel}
                        </button>
                      ) : price && price.available ? (
                        <button
                          type="button"
                          onClick={() => void checkout(price.priceCode)}
                          disabled={!!busyKey}
                          className="mt-7 w-full rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:opacity-50"
                        >
                          {busyKey === price.priceCode ? "Processing..." : "Subscribe"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="mt-7 w-full rounded-xl bg-amber-900/40 px-4 py-3 text-sm font-semibold text-amber-500 cursor-not-allowed"
                        >
                          {unavailableLabel(price?.unavailableReason ?? "PRICE_NOT_APPROVED")}
                        </button>
                      )}`;
code = code.replace(oldButtonsRegex, newButtons);

code = code.replace(
  '<p className="text-lg font-semibold text-slate-500">Pricing unavailable</p>',
  '<p className="text-lg font-semibold text-slate-500">Setup pending</p>'
);

fs.writeFileSync('src/app/settings/subscription/page.tsx', code);
