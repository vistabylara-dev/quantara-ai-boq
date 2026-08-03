"use client";

import { useEffect, useState } from "react";
import { applyThemeMode, getSavedThemeMode, saveThemeMode, type ThemeMode } from "@/lib/theme";

const options: { label: string; value: ThemeMode }[] = [
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
  { label: "System", value: "system" },
];

export default function ThemeSelector() {
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");

  useEffect(() => {
    const stored = getSavedThemeMode();
    setThemeMode(stored);
    applyThemeMode(stored);
  }, []);

  const handleChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    saveThemeMode(mode);
    applyThemeMode(mode);
  };

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Appearance</p>
          <p className="mt-1 text-sm text-slate-400">Choose light, dark, or system mode.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => handleChange(option.value)}
            className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
              themeMode === option.value
                ? "border-blue-500 bg-blue-600 text-white"
                : "border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-600 hover:bg-slate-800"
            }`}
          >
            <p>{option.label}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
