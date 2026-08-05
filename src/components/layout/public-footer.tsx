import React from "react";
import Link from "next/link";
import { publicNavigation, legalNavigation } from "@/config/public-navigation";

export default function PublicFooter() {
  const getSectionItems = (sectionLabel: string) => {
    const section = publicNavigation.find(s => s.label === sectionLabel);
    if (!section) return [];
    // Flatten all items from all groups in the section for the footer
    return section.groups.flatMap(g => g.items);
  };

  const platformItems = getSectionItems("Platform");
  const solutionsItems = getSectionItems("Solutions");
  const resourcesItems = getSectionItems("Resources");
  const comparisonsItems = getSectionItems("Comparisons");
  const regionalItems = getSectionItems("Regional");
  const companyItems = getSectionItems("Company");

  return (
    <footer className="py-12 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-8 mb-12">
          
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-4 lg:col-span-2">
            <Link href="/" className="font-bold text-xl tracking-tight text-slate-900 dark:text-white flex items-center gap-2 mb-6" aria-label="Quantara Home">
              <img src="/logo.png" alt="Quantara Logo" className="w-8 h-8 rounded-lg shadow-sm" />
              Quantara
            </Link>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 font-medium max-w-sm">
              Quantara is developed and operated by Vista By Lara, a technology business focused on AI-assisted tools for construction, project, design and business workflows.
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-sm">
              Quantara is an AI-assisted BOQ and construction-estimating platform in Controlled Early Access.
            </p>
            
            <div className="mt-8 space-y-2 text-sm text-slate-500 dark:text-slate-400">
              <p>Email: <a href="mailto:solution@vistabylara.com" className="hover:text-slate-900 dark:hover:text-white">solution@vistabylara.com</a></p>
              <p>Telephone: <a href="tel:+971507994292" className="hover:text-slate-900 dark:hover:text-white">+971 50 799 4292</a></p>
              <p>WhatsApp: <a href="https://wa.me/971507994292" className="hover:text-slate-900 dark:hover:text-white">+971 50 799 4292</a></p>
            </div>
          </div>
          
          {/* Platform */}
          <div className="col-span-1">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4">Platform</h3>
            <ul className="space-y-3 text-sm text-slate-500 dark:text-slate-400">
              {platformItems.slice(0, 7).map((item, index) => (
                <li key={index}><Link href={item.href} className="hover:text-slate-900 dark:hover:text-white">{item.label}</Link></li>
              ))}
            </ul>
          </div>

          {/* Solutions & Comparisons */}
          <div className="col-span-1">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4">Solutions</h3>
            <ul className="space-y-3 text-sm text-slate-500 dark:text-slate-400 mb-8">
              {solutionsItems.slice(0, 5).map((item, index) => (
                <li key={index}><Link href={item.href} className="hover:text-slate-900 dark:hover:text-white">{item.label}</Link></li>
              ))}
            </ul>
            
            <h3 className="font-bold text-slate-900 dark:text-white mb-4">Comparisons</h3>
            <ul className="space-y-3 text-sm text-slate-500 dark:text-slate-400">
              {comparisonsItems.slice(0, 5).map((item, index) => (
                <li key={index}><Link href={item.href} className="hover:text-slate-900 dark:hover:text-white">{item.label}</Link></li>
              ))}
            </ul>
          </div>
          
          {/* Resources */}
          <div className="col-span-1">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4">Resources</h3>
            <ul className="space-y-3 text-sm text-slate-500 dark:text-slate-400">
              {resourcesItems.slice(0, 8).map((item, index) => (
                <li key={index}><Link href={item.href} className="hover:text-slate-900 dark:hover:text-white">{item.label}</Link></li>
              ))}
            </ul>
          </div>
          
          {/* Regional */}
          <div className="col-span-1">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4">Regional</h3>
            <ul className="space-y-3 text-sm text-slate-500 dark:text-slate-400">
              {regionalItems.slice(0, 7).map((item, index) => (
                <li key={index}><Link href={item.href} className="hover:text-slate-900 dark:hover:text-white">{item.label}</Link></li>
              ))}
            </ul>
          </div>
          
          {/* Company & Legal */}
          <div className="col-span-1 lg:col-span-2 grid grid-cols-2 lg:grid-cols-1 gap-8">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white mb-4">Enterprise Software</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                Custom Quantara software implementation for companies requiring tailored workflows, integrations, branding, deployment, migration, onboarding or advanced operational requirements.
              </p>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mb-2">
                Starting from AED 15,000
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
                Final scope and pricing are provided through a custom quotation following a requirements review.
              </p>
              <Link href="/contact-sales" className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                Contact Sales &rarr;
              </Link>
            </div>

            <div>
              <h3 className="font-bold text-slate-900 dark:text-white mb-4">Company</h3>
              <ul className="space-y-3 text-sm text-slate-500 dark:text-slate-400">
                {companyItems.map((item, index) => (
                  <li key={index}><Link href={item.href} className="hover:text-slate-900 dark:hover:text-white">{item.label}</Link></li>
                ))}
                <li><Link href="/site-map" className="hover:text-slate-900 dark:hover:text-white">HTML Sitemap</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white mb-4">Legal</h3>
              <ul className="space-y-3 text-sm text-slate-500 dark:text-slate-400">
                {legalNavigation.map((item, index) => (
                  <li key={index}><Link href={item.href} className="hover:text-slate-900 dark:hover:text-white">{item.label}</Link></li>
                ))}
              </ul>
            </div>
          </div>
          
        </div>
        
        <div className="pt-8 border-t border-slate-200 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400 flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            &copy; 2026 Quantara. Operated by Vista By Lara. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}
