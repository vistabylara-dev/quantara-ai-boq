const fs = require('fs');
let code = fs.readFileSync('src/app/settings/subscription/page.tsx', 'utf8');

// Replace `enterpriseProducts?: EnterpriseAnnualPlan[]`
code = code.replace(/enterpriseProducts\?: EnterpriseAnnualPlan\[\]/, '');
code = code.replace(/type EnterpriseAnnualPlan = \{[\s\S]*?\};\n/, '');

// Replace enterpriseProducts definition
code = code.replace(
  /\/\/ item-A \(Round 3 correction\)[\s\S]*?\.filter\(\(product\): product is EnterpriseAnnualPlan => Boolean\(product\)\);/,
  `const enterpriseProducts = ENTERPRISE_PRODUCT_ORDER.map((productCode) =>
    checkoutAvailability?.products.find((product) => product.productCode === productCode),
  ).filter((product): product is CheckoutOptionProduct => Boolean(product));`
);

// Fix the map loop for enterprise
// Old code:
// const price = product.price;
// New code:
// const price = product.prices.find((p) => p.billingInterval === "YEAR");
code = code.replace(
  /const price = product\.price;/g,
  'const price = product.prices.find((p) => p.billingInterval === "YEAR");'
);

// We also need to change the rendering of the button:
// Old code had contact sales button, we need it to use checkout().
// Let's find the exact block and replace it.

const startMarker = `const isSelectedPricingIntent = price?.priceCode === selectedPricingIntent;`;
const endMarker = `</article>\n                );\n              })}`;

const newBlock = `
                  const isSelectedPricingIntent = price?.priceCode === selectedPricingIntent;
                  const currentPlan = entitlements.planName.trim().toLowerCase() === product.name.trim().toLowerCase();

                  return (
                    <article
                      key={product.productCode}
                      className={\`relative flex flex-col justify-between rounded-2xl border p-6 \${
                        currentPlan
                          ? "border-amber-400/50 bg-amber-400/10"
                          : isSelectedPricingIntent
                            ? "border-indigo-400/50 bg-slate-900"
                            : "border-slate-800 bg-slate-900"
                      }\`}
                    >
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-xl font-bold text-white">{product.name}</h3>
                          {currentPlan && (
                            <span className="rounded-full border border-amber-400/30 bg-amber-400/20 px-2 py-0.5 text-xs font-semibold text-amber-300">
                              Current Plan
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-400">{meta.positioning}</p>

                        <div className="mt-5 border-t border-slate-800 pt-5">
                          {price ? (
                            <p className="text-[28px] font-semibold tracking-tight text-white">
                              {formatMoney(price.amountMinor, price.currency)}
                              <span className="text-sm font-normal text-slate-400"> /year</span>
                            </p>
                          ) : (
                            <p className="text-[28px] font-semibold tracking-tight text-slate-500">
                              Setup pending
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-6 flex-1 border-t border-slate-800 pt-6">
                        <ul role="list" className="space-y-3">
                          {meta.benefits.map((benefit) => (
                            <li key={benefit} className="flex gap-3 text-sm leading-5 text-slate-300">
                              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-400/50" aria-hidden="true" />
                              <span>{benefit}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      {!currentPlan && (
                        price && price.available ? (
                          <button
                            type="button"
                            onClick={() => checkout(price.priceCode)}
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
                        )
                      )}
                    </article>
                  );
                })}
`;

const startIndex = code.indexOf(startMarker);
const endIndex = code.indexOf(endMarker) + endMarker.length;
if (startIndex !== -1 && endIndex !== -1) {
  code = code.substring(0, startIndex) + newBlock.trim() + code.substring(endIndex);
} else {
  console.log("Could not find block to replace");
}

fs.writeFileSync('src/app/settings/subscription/page.tsx', code);
