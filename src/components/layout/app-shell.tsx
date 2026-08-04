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
    <div className="bg-void min-h-screen text-slate-300 font-sans selection:bg-[#00F0FF]/30 relative">
      <div className="scanline"></div>
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(0, 240, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 240, 255, 0.05) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      
      <div className="xl:flex relative z-10">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopHeader onMenuClick={() => setIsMobileMenuOpen(true)} />
          <MobileNavigation open={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
          <main className="flex-1 px-4 pb-8 pt-6 sm:px-6 xl:px-10 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
      <footer className="border-t border-white/10 cyber-panel px-4 py-4 text-xs text-slate-600 xl:px-10 relative z-10">
        <span className="terminal-text tracking-widest uppercase">Quantara AI // System V.1.0 // Operational</span>
      </footer>
    </div>
  );
}
