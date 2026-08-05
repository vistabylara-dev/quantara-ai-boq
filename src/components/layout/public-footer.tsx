import React from "react";
import Link from "next/link";

export default function PublicFooter() {
  return (
    <footer className="py-12 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
          <div className="col-span-1 lg:col-span-2">
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
          </div>
          
          <div className="col-span-1">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4">Product</h3>
            <ul className="space-y-3 text-sm text-slate-500 dark:text-slate-400">
              <li><Link href="/features" className="hover:text-slate-900 dark:hover:text-white">Features</Link></li>
              <li><Link href="/about" className="hover:text-slate-900 dark:hover:text-white">About</Link></li>
              <li><Link href="/resources" className="hover:text-slate-900 dark:hover:text-white">Resources</Link></li>
              <li><Link href="/register" className="hover:text-slate-900 dark:hover:text-white">Request Early Access</Link></li>
              <li><Link href="/contact-sales" className="hover:text-slate-900 dark:hover:text-white">Contact Sales</Link></li>
            </ul>
          </div>

          <div className="col-span-1">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4">BOQ Resources</h3>
            <ul className="space-y-3 text-sm text-slate-500 dark:text-slate-400">
              <li><Link href="/ai-boq-software" className="hover:text-slate-900 dark:hover:text-white">AI BOQ Software</Link></li>
              <li><Link href="/boq-software" className="hover:text-slate-900 dark:hover:text-white">BOQ Software</Link></li>
              <li><Link href="/construction-estimating-software" className="hover:text-slate-900 dark:hover:text-white">Construction Estimating Software</Link></li>
              <li><Link href="/pdf-boq-extraction" className="hover:text-slate-900 dark:hover:text-white">PDF BOQ Extraction</Link></li>
              <li><Link href="/quantity-surveying-software" className="hover:text-slate-900 dark:hover:text-white">Quantity Surveying Software</Link></li>
            </ul>
          </div>
          
          <div className="col-span-1">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4">Legal</h3>
            <ul className="space-y-3 text-sm text-slate-500 dark:text-slate-400">
              <li><Link href="/security" className="hover:text-slate-900 dark:hover:text-white">Security</Link></li>
              <li><Link href="/privacy" className="hover:text-slate-900 dark:hover:text-white">Privacy</Link></li>
              <li><Link href="/terms" className="hover:text-slate-900 dark:hover:text-white">Terms</Link></li>
              <li><Link href="/data-processing" className="hover:text-slate-900 dark:hover:text-white">Data Processing</Link></li>
              <li><Link href="/cookie-policy" className="hover:text-slate-900 dark:hover:text-white">Cookie Policy</Link></li>
              <li><Link href="/acceptable-use" className="hover:text-slate-900 dark:hover:text-white">Acceptable Use</Link></li>
              <li><Link href="/subprocessors" className="hover:text-slate-900 dark:hover:text-white">Subprocessors</Link></li>
            </ul>
          </div>
          
          <div className="col-span-1">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4">Quantara Support</h3>
            <ul className="space-y-3 text-sm text-slate-500 dark:text-slate-400 mb-4">
              <li>Email: <a href="mailto:solution@vistabylara.com" className="hover:text-slate-900 dark:hover:text-white">solution@vistabylara.com</a></li>
              <li>Telephone: <a href="tel:+971507994292" className="hover:text-slate-900 dark:hover:text-white">+971 50 799 4292</a></li>
              <li>WhatsApp: <a href="https://wa.me/971507994292" className="hover:text-slate-900 dark:hover:text-white">+971 50 799 4292</a></li>
            </ul>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Support requests can be submitted 24 hours a day. Response times may vary during Controlled Early Access.
            </p>
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
