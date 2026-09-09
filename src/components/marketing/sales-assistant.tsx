"use client";

import { useRef, useState } from "react";
import { usePathname } from "next/navigation";

export default function SalesAssistant() {
  const pathname = usePathname();
  const ar = pathname.startsWith("/ar");
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [answer, setAnswer] = useState<{ message: string; href: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const prefix = ar ? "/ar" : "";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current || !message.trim()) return;
    submitting.current = true;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/sales-agent/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: crypto.randomUUID(), message, locale: ar ? "ar" : "en", history }),
      });
      const body = await response.json() as { ok: boolean; data: { message: string; href: string } };
      if (!response.ok || !body.ok) throw new Error("Unavailable");
      setAnswer(body.data);
      setHistory((previous) => [...previous, message.slice(0, 500)].slice(-4));
      setMessage("");
    } catch {
      setError(ar ? "تعذرت الإجابة الآن. يمكنك الاطلاع على الخطط أو التواصل مع المبيعات أدناه." : "I could not answer just now. You can still compare plans or contact sales below.");
    } finally { setBusy(false); submitting.current = false; }
  }

  return (
    <section dir={ar ? "rtl" : "ltr"} aria-labelledby="sales-advisor-title" className="mx-auto my-10 w-full max-w-4xl rounded-2xl border border-cyan-900 bg-slate-950 p-6 text-white">
      <h2 id="sales-advisor-title" className="text-2xl font-semibold">{ar ? "هل كوانتارا مناسبة لفريقك؟" : "Is Quantara right for your team?"}</h2>
      <p className="mt-2 text-sm text-slate-300">{ar ? "مساعد المبيعات الآلي يساعدك في اختيار الخطوة التالية. قد يعالج OpenAI رسالتك. لا تُدخل معلومات سرية." : "Our automated sales advisor helps you choose your next step. OpenAI may process your message. Please leave out confidential information."} <a className="underline" href={`${prefix}/privacy`}>{ar ? "الخصوصية" : "Privacy"}</a></p>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <label htmlFor="sales-question" className="block font-medium">{ar ? "ما الذي يحتاج فريقك إلى إنجازه؟" : "What does your team need to accomplish?"}</label>
        <textarea id="sales-question" required maxLength={1500} value={message} onChange={(event) => setMessage(event.target.value)} className="min-h-24 w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-white" />
        <button disabled={busy} className="min-h-11 rounded-lg bg-cyan-300 px-5 py-2 font-semibold text-slate-950 disabled:opacity-50">{busy ? (ar ? "جارٍ الرد…" : "Preparing answer…") : (ar ? "اسأل المساعد" : "Ask the advisor")}</button>
      </form>
      <div aria-live="polite" className="mt-4 whitespace-pre-line text-slate-200">
        {error || answer?.message}
      </div>
      {answer && <a href={answer.href} className="mt-4 inline-block font-semibold text-cyan-300 underline">{ar ? "استكشف هذه الخطوة" : "Explore this next step"}</a>}
      <nav aria-label={ar ? "خطوات الشراء" : "Buying options"} className="mt-5 flex flex-wrap gap-5 text-cyan-300">
        <a className="underline" href={`${prefix}/pricing`}>{ar ? "قارن الخطط" : "Compare plans"}</a>
        <a className="underline" href={`${prefix}/register`}>{ar ? "إنشاء حساب" : "Create account"}</a>
        <a className="underline" href={`${prefix}/contact-sales`}>{ar ? "تحدث مع لارا" : "Talk to Lara"}</a>
      </nav>
    </section>
  );
}
