"use client";

import React, { useState } from "react";
import Link from "next/link";
import PublicFooter from "@/components/layout/public-footer";


export default function ContactSalesPage() {
  const [formData, setFormData] = useState({
    fullName: "",
    businessEmail: "",
    companyName: "",
    country: "",
    role: "",
    companyType: "Main Contractor",
    constructionDiscipline: "",
    monthlyVolume: "1-5",
    currentBoqProcess: "",
    requiredInputs: "",
    requiredOutputs: "",
    numberOfUsers: "1-5",
    preferredContactMethod: "Email",
    message: "",
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
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Thank you. Your request has been received.</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8">
            Our team will review the information and contact you using the details provided.
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
      <div className="max-w-6xl mx-auto px-4">
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
            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800/50 mb-8">
              <h3 className="font-bold text-slate-900 dark:text-white mb-4">Contact details</h3>
              <ul className="space-y-3 text-slate-700 dark:text-slate-300">
                <li className="flex gap-2"><strong>Telephone:</strong> <a href="tel:+971507994292" className="text-blue-600 hover:underline">+971 50 799 4292</a></li>
                <li className="flex gap-2"><strong>WhatsApp:</strong> <a href="https://wa.me/971507994292" className="text-blue-600 hover:underline">+971 50 799 4292</a></li>
                <li className="flex gap-2"><strong>Email:</strong> <a href="mailto:solution@vistabylara.com" className="text-blue-600 hover:underline">solution@vistabylara.com</a></li>
              </ul>
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
                Support requests can be submitted 24 hours a day. Response times may vary during Controlled Early Access.
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Talk to an Expert</h2>
            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="fullName" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Full name</label>
                  <input id="fullName" required value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} type="text" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label htmlFor="businessEmail" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Business email</label>
                  <input id="businessEmail" required value={formData.businessEmail} onChange={e => setFormData({...formData, businessEmail: e.target.value})} type="email" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-blue-500" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="companyName" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Company name</label>
                  <input id="companyName" required value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} type="text" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label htmlFor="country" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Country</label>
                  <input id="country" required value={formData.country} onChange={e => setFormData({...formData, country: e.target.value})} type="text" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="role" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Role</label>
                  <input id="role" required value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} type="text" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label htmlFor="companyType" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Company type</label>
                  <select id="companyType" required value={formData.companyType} onChange={e => setFormData({...formData, companyType: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-blue-500 appearance-none">
                    <option value="Main Contractor">Main Contractor</option>
                    <option value="Subcontractor">Subcontractor</option>
                    <option value="Consultancy">Consultancy</option>
                    <option value="Developer">Developer</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="constructionDiscipline" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Construction discipline</label>
                  <input id="constructionDiscipline" required value={formData.constructionDiscipline} onChange={e => setFormData({...formData, constructionDiscipline: e.target.value})} type="text" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label htmlFor="monthlyVolume" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Approximate monthly BOQ volume</label>
                  <input id="monthlyVolume" required value={formData.monthlyVolume} onChange={e => setFormData({...formData, monthlyVolume: e.target.value})} type="text" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-blue-500" />
                </div>
              </div>

              <div>
                <label htmlFor="currentBoqProcess" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Current BOQ process</label>
                <input id="currentBoqProcess" required value={formData.currentBoqProcess} onChange={e => setFormData({...formData, currentBoqProcess: e.target.value})} type="text" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-blue-500" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="requiredInputs" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Required input formats</label>
                  <input id="requiredInputs" required value={formData.requiredInputs} onChange={e => setFormData({...formData, requiredInputs: e.target.value})} type="text" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label htmlFor="requiredOutputs" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Required output formats</label>
                  <input id="requiredOutputs" required value={formData.requiredOutputs} onChange={e => setFormData({...formData, requiredOutputs: e.target.value})} type="text" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="numberOfUsers" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Number of intended users</label>
                  <input id="numberOfUsers" required value={formData.numberOfUsers} onChange={e => setFormData({...formData, numberOfUsers: e.target.value})} type="text" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label htmlFor="preferredContactMethod" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Preferred contact method</label>
                  <select id="preferredContactMethod" required aria-label="Preferred Contact Method" value={formData.preferredContactMethod} onChange={e => setFormData({...formData, preferredContactMethod: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-blue-500 appearance-none">
                    <option value="Email">Email</option>
                    <option value="Phone">Phone</option>
                    <option value="WhatsApp">WhatsApp</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="message" className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Message</label>
                <textarea id="message" required value={formData.message} onChange={e => setFormData({...formData, message: e.target.value})} rows={3} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 outline-none focus:border-blue-500 resize-none"></textarea>
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
                  Privacy consent: I agree that Quantara may process my information to respond to this request.
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
      <PublicFooter />
    </div>
  );
}
