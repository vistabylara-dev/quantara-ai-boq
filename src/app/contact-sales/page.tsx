"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function ContactSalesPage() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    workEmail: "",
    companyType: "Main Contractor",
    constructionDiscipline: "General",
    currentBoqProcess: "",
    monthlyVolume: "1-5",
    requiredInputs: "",
    requiredOutputs: "",
    numberOfUsers: "1-5",
    integrationRequirements: "",
    preferredContactMethod: "Email",
    consent: false,
  });
  
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json() as any;
        throw new Error(data.message || "Something went wrong.");
      }

      setStatus("success");
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(err.message);
    }
  };

  if (status === "success") {
    return (
      <div className="min-h-[70vh] flex items-center justify-center py-24 px-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center shadow-lg">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl font-bold">✓</div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Thank you.</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8">
            Your request has been securely recorded. Our team will contact you using the details provided.
          </p>
          <Link href="/" className="inline-block bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white px-6 py-3 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            Return to Homepage
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030508] py-24">
      <div className="max-w-5xl mx-auto px-4">
        <div className="mb-8">
          <Link href="/" className="text-blue-600 hover:underline flex items-center gap-2 text-sm font-medium">
            ← Back to Home
          </Link>
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-start">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-6">Contact Sales</h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">
              Discuss enterprise implementation, custom integrations, or get answers to security and compliance questions for your BOQ workflows.
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800/50">
              <h3 className="font-bold text-slate-900 dark:text-white mb-2">Why contact sales?</h3>
              <ul className="space-y-3 text-slate-700 dark:text-slate-300">
                <li className="flex gap-2"><span className="text-blue-500">✓</span> Custom pricing for large estimating teams</li>
                <li className="flex gap-2"><span className="text-blue-500">✓</span> Security & compliance reviews</li>
                <li className="flex gap-2"><span className="text-blue-500">✓</span> Dedicated onboarding and training support</li>
              </ul>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Talk to an Expert</h2>
            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">First Name</label>
                  <input id="firstName" required value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} type="text" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label htmlFor="lastName" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Last Name</label>
                  <input id="lastName" required value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} type="text" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-blue-500" />
                </div>
              </div>
              
              <div>
                <label htmlFor="workEmail" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Work Email</label>
                <input id="workEmail" required value={formData.workEmail} onChange={e => setFormData({...formData, workEmail: e.target.value})} type="email" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-blue-500" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="companyType" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Company Type</label>
                  <select id="companyType" aria-label="Company Type" value={formData.companyType} onChange={e => setFormData({...formData, companyType: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-blue-500 appearance-none">
                    <option value="Main Contractor">Main Contractor</option>
                    <option value="Subcontractor">Subcontractor</option>
                    <option value="Consultancy">Consultancy</option>
                    <option value="Developer">Developer</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="constructionDiscipline" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Construction Discipline</label>
                  <input id="constructionDiscipline" required value={formData.constructionDiscipline} onChange={e => setFormData({...formData, constructionDiscipline: e.target.value})} type="text" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-blue-500" />
                </div>
              </div>

              <div>
                <label htmlFor="currentBoqProcess" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Current BOQ Process</label>
                <input id="currentBoqProcess" required value={formData.currentBoqProcess} onChange={e => setFormData({...formData, currentBoqProcess: e.target.value})} type="text" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-blue-500" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="monthlyVolume" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Avg Monthly BOQ Volume</label>
                  <select id="monthlyVolume" aria-label="Average Monthly Volume" value={formData.monthlyVolume} onChange={e => setFormData({...formData, monthlyVolume: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-blue-500 appearance-none">
                    <option value="1-5">1-5</option>
                    <option value="6-20">6-20</option>
                    <option value="21-50">21-50</option>
                    <option value="50+">50+</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="numberOfUsers" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Number of Users</label>
                  <select id="numberOfUsers" aria-label="Number of Users" value={formData.numberOfUsers} onChange={e => setFormData({...formData, numberOfUsers: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-blue-500 appearance-none">
                    <option value="1-5">1-5</option>
                    <option value="6-20">6-20</option>
                    <option value="21-50">21-50</option>
                    <option value="50+">50+</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="requiredInputs" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Required Input Formats</label>
                  <input id="requiredInputs" value={formData.requiredInputs} onChange={e => setFormData({...formData, requiredInputs: e.target.value})} type="text" placeholder="e.g. PDF, CAD" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label htmlFor="requiredOutputs" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Required Output Formats</label>
                  <input id="requiredOutputs" value={formData.requiredOutputs} onChange={e => setFormData({...formData, requiredOutputs: e.target.value})} type="text" placeholder="e.g. Excel, PDF" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="integrationRequirements" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Integration Req.</label>
                  <input id="integrationRequirements" value={formData.integrationRequirements} onChange={e => setFormData({...formData, integrationRequirements: e.target.value})} type="text" placeholder="e.g. ERP" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label htmlFor="preferredContactMethod" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Preferred Contact</label>
                  <select id="preferredContactMethod" aria-label="Preferred Contact Method" value={formData.preferredContactMethod} onChange={e => setFormData({...formData, preferredContactMethod: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-blue-500 appearance-none">
                    <option value="Email">Email</option>
                    <option value="Phone">Phone</option>
                  </select>
                </div>
              </div>

              <div className="flex items-start gap-3 mt-4 pt-2">
                <input 
                  type="checkbox" 
                  id="consent" 
                  required
                  checked={formData.consent}
                  onChange={(e) => setFormData({...formData, consent: e.target.checked})}
                  className="mt-1 h-4 w-4 rounded border-slate-800 bg-slate-900 text-blue-600 focus:ring-blue-500/20 focus:ring-offset-slate-950" 
                />
                <label htmlFor="consent" className="text-xs text-slate-500">
                  I consent to the collection and processing of my information in accordance with the <Link href="/privacy" className="text-blue-600 dark:text-blue-400 underline">Privacy Policy</Link>.
                </label>
              </div>

              {status === "error" && (
                <div className="text-rose-500 text-sm font-medium p-3 bg-rose-50 dark:bg-rose-900/20 rounded-lg mt-2">
                  {errorMessage}
                </div>
              )}

              <button disabled={status === "submitting"} type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-4 rounded-xl transition-colors disabled:opacity-70 mt-4">
                {status === "submitting" ? "Submitting..." : "Talk to an Expert"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
