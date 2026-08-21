const fs = require('fs');

let content = fs.readFileSync('src/app/marketplace/page.tsx', 'utf8');

// 1. Remove contact sales sentence
content = content.replace(
  'Buy a package below to unlock it immediately, or contact\n          sales for enterprise packages.',
  'Buy a package below to unlock it immediately.'
);
content = content.replace(
  'Buy a package below to unlock it immediately, or contact sales for enterprise packages.',
  'Buy a package below to unlock it immediately.'
);

// 2. Fix Core Software block
const coreSoftwareRegex = /\{\s*checkoutAvailability\.products\s*\.filter\(p => \["starter", "professional", "business"\]\.includes\(p\.productCode\)\)[\s\S]*?\.map\(plan => \{[\s\S]*?return \([\s\S]*?\}\)\}\s*<\/div>/;

const newCoreSoftware = `{checkoutAvailability.products
                .filter(p => ["starter", "professional", "business"].includes(p.productCode))
                .sort((a, b) => {
                  const order = { starter: 0, professional: 1, business: 2 } as any;
                  return order[a.productCode] - order[b.productCode];
                })
                .map(plan => {
                  const monthPrice = plan.prices.find(p => p.billingInterval === "MONTH");
                  const yearPrice = plan.prices.find(p => p.billingInterval === "YEAR");
                  if (!monthPrice && !yearPrice) return null;
                  return (
                    <div key={plan.productCode} className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-300">
                      <h3 className="text-lg font-bold text-white capitalize">{plan.name}</h3>
                      <p className="mt-2 flex-grow text-sm text-slate-400">{plan.shortDescription}</p>
                      
                      <div className="mt-4 flex flex-col gap-4">
                        {monthPrice && (
                          <div className="flex flex-col gap-3 border-t border-slate-800 pt-4">
                            <p className="text-2xl font-semibold text-white">
                              {monthPrice.currency} {(monthPrice.amountMinor / 100).toLocaleString("en-AE")}
                              <span className="text-sm font-normal text-slate-500">/mo</span>
                            </p>
                            <button
                              type="button"
                              onClick={() => checkout(monthPrice.priceCode)}
                              disabled={busyKey === monthPrice.priceCode || !monthPrice.available}
                              className="rounded-xl border border-blue-600 bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50"
                            >
                              {busyKey === monthPrice.priceCode ? "Redirecting..." : monthPrice.available ? "Buy Monthly" : purchaseUnavailableLabel(monthPrice.unavailableReason as any)}
                            </button>
                          </div>
                        )}
                        {yearPrice && (
                          <div className="flex flex-col gap-3 border-t border-slate-800 pt-4">
                            <p className="text-2xl font-semibold text-white">
                              {yearPrice.currency} {(yearPrice.amountMinor / 100).toLocaleString("en-AE")}
                              <span className="text-sm font-normal text-slate-500">/yr</span>
                            </p>
                            <button
                              type="button"
                              onClick={() => checkout(yearPrice.priceCode)}
                              disabled={busyKey === yearPrice.priceCode || !yearPrice.available}
                              className="rounded-xl border border-blue-600 bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50"
                            >
                              {busyKey === yearPrice.priceCode ? "Redirecting..." : yearPrice.available ? "Buy Annual" : purchaseUnavailableLabel(yearPrice.unavailableReason as any)}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>`;

content = content.replace(coreSoftwareRegex, newCoreSoftware);

// 3. Fix Enterprise block mapping
const enterpriseRegex = /<button\s+type="button"\s+onClick=\{\(\) => checkout\(price\.priceCode\)\}\s+disabled=\{busyKey === price\.priceCode \|\| !price\.available\}\s+className="mt-6 rounded-xl border border-purple-600 bg-purple-600 px-4 py-3 text-sm font-bold text-white hover:bg-purple-500 disabled:opacity-50"\s*>\s*\{busyKey === price\.priceCode \? "Redirecting\.\.\." : price\.available \? "Buy enterprise" : \(price\.unavailableReason \|\| "Setup pending"\)\}\s*<\/button>/;

const newEnterpriseBtn = `<button
                        type="button"
                        onClick={() => checkout(price.priceCode)}
                        disabled={busyKey === price.priceCode || !price.available}
                        className="mt-6 rounded-xl border border-purple-600 bg-purple-600 px-4 py-3 text-sm font-bold text-white hover:bg-purple-500 disabled:opacity-50"
                      >
                        {busyKey === price.priceCode ? "Redirecting..." : price.available ? "Buy enterprise" : purchaseUnavailableLabel(price.unavailableReason as any)}
                      </button>`;

content = content.replace(enterpriseRegex, newEnterpriseBtn);

fs.writeFileSync('src/app/marketplace/page.tsx', content);

