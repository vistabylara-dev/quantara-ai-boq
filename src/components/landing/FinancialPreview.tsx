'use client';

import React, { useState } from 'react';

export default function FinancialPreview() {
  const [revenue, setRevenue] = useState('');
  const [expenses, setExpenses] = useState('');
  const [cash, setCash] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<null | { snapshot: string, insight: string, issue: string, nextAction: string }>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    // Simulate API delay for preview
    setTimeout(() => {
      const revNum = parseFloat(revenue) || 0;
      const expNum = parseFloat(expenses) || 0;
      const cashNum = parseFloat(cash) || 0;
      
      const profit = revNum - expNum;
      const margin = revNum > 0 ? ((profit / revNum) * 100).toFixed(1) : '0';
      const runway = expNum > 0 ? (cashNum / expNum).toFixed(1) : '0';

      setResult({
        snapshot: `Profit: $${profit.toLocaleString()} (${margin}% margin) | Available Cash: $${cashNum.toLocaleString()}`,
        insight: `Your business generated $${revNum.toLocaleString()} this period. While you have a ${margin}% profit margin, your cash reserves represent approximately ${runway} months of current expenses.`,
        issue: profit > 0 && cashNum < expNum ? "Cash flow warning: Your cash reserves are lower than your typical monthly expenses, despite being profitable." : (profit < 0 ? "Profitability warning: The business operated at a loss this period." : "No immediate critical warnings."),
        nextAction: profit > 0 && cashNum < expNum ? "Review accounts receivable to accelerate cash collections this week." : (profit < 0 ? "Review the largest expense categories for potential reductions." : "Maintain current cash reserves for upcoming obligations.")
      });
      setLoading(false);
    }, 1500);
  };

  return (
    <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
      <form onSubmit={handleSubmit} className="space-y-4 mb-8">
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="revenue" className="block text-sm font-medium text-slate-700 mb-1">Monthly Revenue ($)</label>
            <input 
              id="revenue" 
              type="number" 
              required 
              min="0"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={revenue} 
              onChange={(e) => setRevenue(e.target.value)} 
              placeholder="e.g. 50000"
            />
          </div>
          <div>
            <label htmlFor="expenses" className="block text-sm font-medium text-slate-700 mb-1">Monthly Expenses ($)</label>
            <input 
              id="expenses" 
              type="number" 
              required 
              min="0"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={expenses} 
              onChange={(e) => setExpenses(e.target.value)} 
              placeholder="e.g. 40000"
            />
          </div>
          <div>
            <label htmlFor="cash" className="block text-sm font-medium text-slate-700 mb-1">Cash in Bank ($)</label>
            <input 
              id="cash" 
              type="number" 
              required 
              min="0"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={cash} 
              onChange={(e) => setCash(e.target.value)} 
              placeholder="e.g. 20000"
            />
          </div>
        </div>
        <button 
          type="submit" 
          disabled={loading}
          className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Analyzing...' : 'Generate Financial Explanation'}
        </button>
      </form>

      {result && (
        <div className="bg-white p-6 rounded-lg border border-slate-200 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h3 className="text-lg font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2">Quantara Explanation</h3>
          
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Financial snapshot</h4>
              <p className="text-slate-900 font-medium">{result.snapshot}</p>
            </div>
            
            <div>
              <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">What the numbers suggest</h4>
              <p className="text-slate-700">{result.insight}</p>
            </div>
            
            <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded-r">
              <h4 className="text-sm font-semibold text-amber-800 mb-1">Potential issue</h4>
              <p className="text-amber-900 text-sm">{result.issue}</p>
            </div>
            
            <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded-r">
              <h4 className="text-sm font-semibold text-blue-800 mb-1">Recommended next action</h4>
              <p className="text-blue-900 text-sm font-medium">{result.nextAction}</p>
            </div>
          </div>
          
          <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500">
            <strong>Disclaimer:</strong> This is an illustrative preview based on your manual inputs. Quantara does not provide licensed professional financial or tax advice.
          </div>
        </div>
      )}
    </div>
  );
}
