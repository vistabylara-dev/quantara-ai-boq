"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronDown } from "lucide-react";
import {
  getPublicNavigation,
  type NavigationItem,
  type NavigationSection,
} from "@/config/public-navigation";
import { useTranslations } from "@/lib/i18n/locale-provider";
import { LanguageSwitcher } from "@/components/layout/language-switcher";

export default function PublicHeader() {
  const t = useTranslations();
  const navigation = getPublicNavigation(t);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDesktopSection, setActiveDesktopSection] = useState<string | null>(null);
  const [activeMobileSection, setActiveMobileSection] = useState<string | null>(null);

  const headerRef = useRef<HTMLElement>(null);
  const desktopMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);

  const pathname = usePathname();

  const closeMobileMenu = useCallback((restoreFocus = true) => {
    setMobileMenuOpen(false);
    if (restoreFocus) {
      requestAnimationFrame(() => mobileMenuTriggerRef.current?.focus());
    }
  }, []);

  // Close menus on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setActiveDesktopSection(null);
  }, [pathname]);

  // Handle click outside for desktop menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        desktopMenuRef.current &&
        !desktopMenuRef.current.contains(event.target as Node) &&
        activeDesktopSection !== null
      ) {
        setActiveDesktopSection(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeDesktopSection]);

  // Handle Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (activeDesktopSection !== null) setActiveDesktopSection(null);
        if (mobileMenuOpen) {
          event.preventDefault();
          closeMobileMenu();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeDesktopSection, closeMobileMenu, mobileMenuOpen]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  // Focus trap for mobile menu
  useEffect(() => {
    if (!mobileMenuOpen || !mobileMenuRef.current) return;
    const focusableElements = mobileMenuRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    function handleTabKeyPress(e: KeyboardEvent) {
      if (e.key === "Tab") {
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    }

    document.addEventListener("keydown", handleTabKeyPress);
    firstElement?.focus();
    return () => {
      document.removeEventListener("keydown", handleTabKeyPress);
    };
  }, [mobileMenuOpen]);

  const toggleDesktopSection = (sectionLabel: string) => {
    setActiveDesktopSection(activeDesktopSection === sectionLabel ? null : sectionLabel);
  };

  const toggleMobileSection = (sectionLabel: string) => {
    setActiveMobileSection(activeMobileSection === sectionLabel ? null : sectionLabel);
  };

  return (
    <header
      ref={headerRef}
      role="banner"
      className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur"
    >
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="font-bold text-xl tracking-tight text-slate-900 dark:text-white flex items-center gap-2" aria-label={t("publicSite.header.quantaraHome")}>
          <Image
            src="/logo.png"
            alt=""
            width={48}
            height={48}
            className="h-12 w-12 shrink-0 object-contain"
            priority
          />
          Quantara
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-1" ref={desktopMenuRef}>
          {navigation.map((section) => {
            const isOpen = activeDesktopSection === section.label;
            const buttonId = `desktop-nav-${section.label.toLowerCase().replace(/\s+/g, "-")}`;
            const panelId = `desktop-panel-${section.label.toLowerCase().replace(/\s+/g, "-")}`;

            return (
              <div key={section.label} className="relative">
                <button
                  id={buttonId}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggleDesktopSection(section.label)}
                  className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white rounded-md hover:bg-slate-50 dark:hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                >
                  {section.label}
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>

                {/* Desktop Mega Menu Panel */}
                {isOpen && (
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    className="absolute top-full left-0 mt-2 w-[600px] max-w-[90vw] -translate-x-1/4 bg-white dark:bg-slate-950 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 grid grid-cols-2 gap-8 z-50"
                  >
                    {section.groups.map((group, gIndex) => (
                      <div key={gIndex} className={section.groups.length === 1 ? "col-span-2" : "col-span-1"}>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">
                          {group.label}
                        </h3>
                        <ul className="space-y-3">
                          {group.items.map((item, iIndex) => (
                            <li key={iIndex}>
                              <Link
                                href={item.href}
                                className="block group/link rounded-lg p-2 -mx-2 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <div className="flex items-center gap-2 font-medium text-sm text-slate-900 dark:text-slate-100 group-hover/link:text-blue-600 dark:group-hover/link:text-blue-400">
                                  <span>{item.label}</span>
                                  {item.status ? (
                                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                                      {item.status}
                                    </span>
                                  ) : null}
                                </div>
                                {item.description && (
                                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                                    {item.description}
                                  </p>
                                )}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden lg:flex items-center gap-4">
          <LanguageSwitcher />
          <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md px-2 py-1">
            {t("publicSite.header.signIn")}
          </Link>
          <Link href="/register" className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 h-9 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950 transition-colors">
            {t("publicContent.cta.startAccountSetup")}
          </Link>
        </div>

        {/* Mobile Menu Trigger */}
        <button
          ref={mobileMenuTriggerRef}
          type="button"
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-navigation"
          aria-label={mobileMenuOpen ? t("publicSite.header.closeMenu") : t("publicSite.header.openMenu")}
          className="lg:hidden p-2 -mr-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md"
          onClick={() => {
            if (mobileMenuOpen) closeMobileMenu();
            else setMobileMenuOpen(true);
          }}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
        </button>
      </div>

      {/* Mobile Navigation Overlay */}
      {mobileMenuOpen && (
        <div
          id="mobile-navigation"
          ref={mobileMenuRef}
          role="dialog"
          aria-modal="true"
          aria-label={t("publicSite.header.mobileNavigation")}
          className="absolute left-0 right-0 top-full z-40 h-[calc(100vh-4rem)] overflow-y-auto bg-white dark:bg-slate-950"
        >
          <div className="px-4 py-6 space-y-2">
            {navigation.map((section) => {
              const isOpen = activeMobileSection === section.label;
              const buttonId = `mobile-nav-${section.label.toLowerCase().replace(/\s+/g, "-")}`;
              const panelId = `mobile-panel-${section.label.toLowerCase().replace(/\s+/g, "-")}`;

              return (
                <div key={section.label} className="border-b border-slate-100 dark:border-slate-800/60 pb-2">
                  <button
                    id={buttonId}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => toggleMobileSection(section.label)}
                    className="flex items-center justify-between w-full py-3 text-left text-lg font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md px-2 -mx-2"
                  >
                    {section.label}
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>
                  {isOpen && (
                    <div id={panelId} role="region" aria-labelledby={buttonId} className="pt-2 pb-4 px-2">
                      {section.groups.map((group, gIndex) => (
                        <div key={gIndex} className="mb-6 last:mb-0">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                            {group.label}
                          </h4>
                          <ul className="space-y-3">
                            {group.items.map((item, iIndex) => (
                              <li key={iIndex}>
                                <Link
                                  href={item.href}
                                  className="block text-base text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md py-1"
                                >
                                  <span>{item.label}</span>
                                  {item.status ? (
                                    <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                                      {item.status}
                                    </span>
                                  ) : null}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            
            <div className="pt-8 space-y-4">
              <div className="flex justify-center">
                <LanguageSwitcher />
              </div>
              <Link href="/login" className="block w-full text-center py-3 text-base font-medium text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                {t("publicSite.header.signIn")}
              </Link>
              <Link href="/register" className="block w-full text-center py-3 text-base font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950">
                {t("publicContent.cta.startAccountSetup")}
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
