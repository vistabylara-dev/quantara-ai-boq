const fs = require('fs');

let content = fs.readFileSync('src/app/marketplace/page.tsx', 'utf8');

// 1. Add CheckoutOptionProduct to types if not exist
if (!content.includes('type CheckoutOptionProduct =')) {
  content = content.replace(
    'type PublicCommerceProduct = {',
    `type CheckoutOptionProduct = {
  productCode: string;
  name: string;
  shortDescription: string;
  prices: {
    priceCode: string;
    amountMinor: number;
    currency: string;
    billingInterval: string;
    available: boolean;
    unavailableReason?: string;
  }[];
};

type CheckoutAvailability = {
  products: CheckoutOptionProduct[];
};

type PublicCommerceProduct = {`
  );
}

// 2. Add checkoutAvailability state
if (!content.includes('setCheckoutAvailability')) {
  content = content.replace(
    'const [tayqanCommerceProducts, setTayqanCommerceProducts] =',
    `const [checkoutAvailability, setCheckoutAvailability] = useState<CheckoutAvailability | null>(null);
  const [tayqanCommerceProducts, setTayqanCommerceProducts] =`
  );
}

// 3. Fetch checkoutAvailability
if (!content.includes('"/api/commerce/checkout-options"')) {
  content = content.replace(
    'setPackages(data);',
    `setPackages(data);
      try {
        const availability = await apiClient.get<CheckoutAvailability>("/api/commerce/checkout-options", signal);
        setCheckoutAvailability(availability);
      } catch (e) {
        console.error("Failed to load checkout options", e);
      }`
  );
}

// 4. Add rendering for Core and Enterprise
if (!content.includes('Core Software')) {
  const replacement = `
      {checkoutAvailability && (
        <>
          <section className="mb-16">
            <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>
              Core Software
            </h2>
            <div className="grid gap-6 md:grid-cols-3">
              {checkoutAvailability.products
                .filter(p => ["starter", "professional", "business"].includes(p.productCode))
                .sort((a, b) => {
                  const order = { starter: 0, professional: 1, business: 2 } as any;
                  return order[a.productCode] - order[b.productCode];
                })
                .map(plan => {
                  const price = plan.prices.find(p => p.billingInterval === "MONTH") || plan.prices[0];
                  if (!price) return null;
                  return (
                    <div key={plan.productCode} className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-300">
                      <h3 className="text-lg font-bold text-white capitalize">{plan.name}</h3>
                      <p className="mt-2 flex-grow text-sm text-slate-400">{plan.shortDescription}</p>
                      <div className="mt-6 border-t border-slate-800 pt-6">
                        <p className="text-2xl font-semibold text-white">
                          {price.currency} {(price.amountMinor / 100).toLocaleString("en-AE")}
                          <span className="text-sm font-normal text-slate-500">/mo</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => checkout(price.priceCode)}
                        disabled={busyKey === price.priceCode || !price.available}
                        className="mt-6 rounded-xl border border-blue-600 bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50"
                      >
                        {busyKey === price.priceCode ? "Redirecting..." : price.available ? "Buy plan" : (price.unavailableReason || "Unavailable")}
                      </button>
                    </div>
                  );
                })}
            </div>
          </section>

          <section className="mb-16">
            <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-500"><path d="M3 21h18"/><path d="M19 21v-4"/><path d="M19 17a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v4"/><path d="M14 15V7a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v8"/><path d="M10 9h2"/></svg>
              Enterprise
            </h2>
            <div className="grid gap-6 md:grid-cols-3">
              {checkoutAvailability.products
                .filter(p => ["enterprise_core", "enterprise_scale", "enterprise_authority"].includes(p.productCode))
                .sort((a, b) => {
                  const order = { enterprise_core: 0, enterprise_scale: 1, enterprise_authority: 2 } as any;
                  return order[a.productCode] - order[b.productCode];
                })
                .map(plan => {
                  const price = plan.prices.find(p => p.billingInterval === "YEAR") || plan.prices[0];
                  if (!price) return null;
                  return (
                    <div key={plan.productCode} className="flex flex-col rounded-2xl border border-purple-900/30 bg-slate-900 p-6 text-slate-300">
                      <h3 className="text-lg font-bold text-purple-400 capitalize">{plan.name}</h3>
                      <p className="mt-2 flex-grow text-sm text-slate-400">{plan.shortDescription}</p>
                      <div className="mt-6 border-t border-slate-800 pt-6">
                        <p className="text-2xl font-semibold text-white">
                          {price.currency} {(price.amountMinor / 100).toLocaleString("en-AE")}
                          <span className="text-sm font-normal text-slate-500">/yr</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => checkout(price.priceCode)}
                        disabled={busyKey === price.priceCode || !price.available}
                        className="mt-6 rounded-xl border border-purple-600 bg-purple-600 px-4 py-3 text-sm font-bold text-white hover:bg-purple-500 disabled:opacity-50"
                      >
                        {busyKey === price.priceCode ? "Redirecting..." : price.available ? "Buy enterprise" : (price.unavailableReason || "Setup pending")}
                      </button>
                    </div>
                  );
                })}
            </div>
          </section>
        </>
      )}
`;
  content = content.replace(
    '{tayqanCommerceProducts.length > 0 && (',
    replacement + '\n      {tayqanCommerceProducts.length > 0 && ('
  );
}

fs.writeFileSync('src/app/marketplace/page.tsx', content);
