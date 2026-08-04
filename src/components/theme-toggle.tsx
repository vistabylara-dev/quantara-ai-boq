"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { getSavedThemeMode, saveThemeMode, ThemeMode } from "@/lib/theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    setTheme(getSavedThemeMode());
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    saveThemeMode(newTheme);
  };

  return (
    <button
      onClick={toggleTheme}
      className="relative inline-flex h-11 w-11 items-center justify-center border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-[#00F0FF]/10 dark:hover:text-[#00F0FF] dark:hover:border-[#00F0FF]/30"
      aria-label="Toggle Theme"
    >
      <Sun className="h-5 w-5 hidden dark:block" />
      <Moon className="h-5 w-5 block dark:hidden" />
    </button>
  );
}
