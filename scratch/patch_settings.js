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

const oldButton = `<Link
                      href="/contact-sales"
                      className="mt-8 block w-full rounded-xl border border-amber-400/30 bg-amber-400/20 px-4 py-3 text-center text-sm font-semibold text-amber-300 transition hover:bg-amber-400/30 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      Contact Sales
                    </Link>`;

const newButton = `{price && price.available ? (
                      <button
                        type="button"
                        onClick={() => void checkout(price.priceCode)}
                        disabled={!!busyKey}
                        className="mt-8 block w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50"
                      >
                        {busyKey === price.priceCode ? "Processing..." : "Subscribe"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="mt-8 block w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-slate-500 cursor-not-allowed"
                      >
                        {unavailableLabel(price?.unavailableReason ?? "PRICE_NOT_APPROVED")}
                      </button>
                    )}`;

code = code.replace(oldButton, newButton);

fs.writeFileSync('src/app/settings/subscription/page.tsx', code);
