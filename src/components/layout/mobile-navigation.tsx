"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { NAVIGATION_ITEMS } from "./navigation-items";

type MobileNavigationProps = {
  open: boolean;
  onClose: () => void;
};

export default function MobileNavigation({ open, onClose }: MobileNavigationProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 xl:hidden">
      <div
        className="absolute inset-0 bg-black/40"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Primary navigation"
        className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-6 overflow-y-auto bg-white dark:bg-[#0B1426] px-6 py-6 text-[#0B1630] dark:text-[#F7FAFC] shadow-xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#7B879C] dark:text-[#7F8DA6]">Workspace</p>
            <h2 className="text-xl font-semibold text-[#0B1630] dark:text-white">Quantara AI</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#D9E2EC] dark:border-[#1E2A42] text-[#536078] dark:text-[#7F8DA6] hover:bg-[#EEF3F8] dark:hover:bg-[#111D33] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38BDF8] dark:focus-visible:outline-[#22D3EE]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-2" aria-label="Primary">
          {NAVIGATION_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`min-h-[44px] rounded-2xl border px-4 py-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#38BDF8] dark:focus-visible:outline-[#22D3EE] ${
                  isActive
                    ? "border-[#0EA5E9]/40 bg-[#0EA5E9]/10 text-[#0284C7] dark:border-[#22D3EE]/40 dark:bg-[#22D3EE]/10 dark:text-[#22D3EE]"
                    : "border-[#D9E2EC] dark:border-[#1E2A42] bg-[#EEF3F8] dark:bg-[#111D33] text-[#0B1630] dark:text-[#F7FAFC] hover:border-[#B9C7D6] dark:hover:border-[#31405F]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
