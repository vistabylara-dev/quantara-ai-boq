"use client";

import { useState, type ReactNode } from "react";
import Sidebar from "./sidebar";
import TopHeader from "./top-header";
import MobileNavigation from "./mobile-navigation";

type AppShellProps = {
  children: ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F3F7FC] dark:bg-[#040A16] text-[#08152E] dark:text-white">
      <div className="xl:flex">
        <Sidebar />
        <div className="flex flex-1 flex-col">
          <TopHeader onMenuClick={() => setIsMobileMenuOpen(true)} />
          <MobileNavigation open={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
          <main className="flex-1 px-4 pb-8 pt-6 sm:px-6 xl:px-10">
            {children}
          </main>
        </div>
      </div>
      <footer className="border-t border-[#D5E0EC] dark:border-[#20304D] bg-[#EAF1F8] dark:bg-[#0F1C2E] px-4 py-4 text-sm text-[#7B879C] dark:text-slate-500 xl:px-10">
        Quantara AI • Development Build 0.1.0
      </footer>
    </div>
  );
}
