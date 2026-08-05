import React from "react";
import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Quantara | Vista By Lara",
  description: "Learn about Quantara, an AI-assisted BOQ software for construction professionals, developed by Vista By Lara.",
  alternates: { canonical: "https://quantara.vistabylara.com/about" },
};

export default function AboutPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://quantara.vistabylara.com"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "About",
        "item": "https://quantara.vistabylara.com/about"
      }
    ]
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="max-w-3xl mx-auto py-24 px-4 flex-1">
        <nav className="mb-8 text-sm" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2 text-slate-500">
            <li>
              <Link href="/" className="hover:text-slate-900 transition-colors">Home</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-slate-900 font-medium" aria-current="page">About</li>
          </ol>
        </nav>
        
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">About Quantara</h1>
          <p className="text-lg text-slate-700 dark:text-slate-300">
            Quantara is a software solution designed to support quantity surveyors, estimators, and construction professionals by bringing structured data workflows to Bill of Quantities (BOQ) management.
          </p>
        </div>

        <div className="space-y-12">
          <section>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Developed by Vista By Lara</h2>
            <p className="text-slate-700 dark:text-slate-300">
              Quantara is developed by Vista By Lara. Our mission is to reduce the massive administrative burden placed on construction professionals, allowing them to focus on commercial analysis, risk management, and strategic decision-making.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Our Approach</h2>
            <p className="text-slate-700 dark:text-slate-300">
              We believe that software should support the professional, not replace them. Construction pricing is complex and carries high commercial risk. Quantara focuses on extracting, organizing, and securing project records while strictly requiring human review and professional judgment before any data is used for commercial purposes.
            </p>
          </section>
          
          <section>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Contact Us</h2>
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-xl">
              <ul className="space-y-2 text-slate-700 dark:text-slate-300">
                <li><strong>Email:</strong> <a href="mailto:solution@vistabylara.com" className="text-blue-600 hover:underline">solution@vistabylara.com</a></li>
                <li><strong>Telephone:</strong> <a href="tel:+971507994292" className="text-blue-600 hover:underline">+971 50 799 4292</a></li>
                <li><strong>WhatsApp:</strong> <a href="https://wa.me/971507994292" className="text-blue-600 hover:underline">+971 50 799 4292</a></li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
