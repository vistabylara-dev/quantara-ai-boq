"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { formatCurrency } from "@/lib/formatting/currency";

type ViewOption = { id: string; label: string; description: string; specification: string; rate: number; isSelected: boolean };
type ViewItem = {
  id: string;
  itemNumber: number;
  itemCode: string;
  description: string;
  specification: string;
  quantity: number;
  unit: string;
  unitRate: number | null;
  totalAmount: number;
  roomOrZone: string;
  drawingReference: string;
  options: ViewOption[];
};
type ViewSection = { code: string; title: string; description: string; items: ViewItem[]; sectionTotal: number | null };
type ViewTotals = { subtotal: number; discountPercentage: number; discountAmount: number; taxableAmount: number; taxRate: number; taxAmount: number; grandTotal: number };
type ProposalView = {
  company: { legalName: string; tradeName: string; logoUrl: string | null; address: string | null; email: string; phone: string | null; website: string | null; taxRegistrationNumber: string | null };
  client: { name: string; companyName: string | null };
  project: { name: string; reference: string; location: string; currency: string; industry: string };
  boq: { title: string; revision: string; revisionNumber: number; sections: ViewSection[]; totals: ViewTotals; termsText: string; exclusionsText: string };
  settings: {
    showUnitRates: boolean;
    showSectionTotals: boolean;
    allowOptionSelection: boolean;
    allowComments: boolean;
    allowDocumentDownload: boolean;
    requireApprovalName: boolean;
    requireApprovalEmail: boolean;
    showTerms: boolean;
    showExclusions: boolean;
  };
};
type ProposalDocument = { id: string; type: string; fileName: string | null; fileSize: number | null };
type ProposalSummary = { status: string; clientComment: string | null; documents: ProposalDocument[] };

type Props = { token: string; initialView: ProposalView; initialProposal: ProposalSummary };

export default function ProposalClientView({ token, initialView, initialProposal }: Props) {
  const router = useRouter();
  const [view, setView] = useState(initialView);
  const [proposal, setProposal] = useState(initialProposal);

  const [comment, setComment] = useState("");
  const [commentSubmitted, setCommentSubmitted] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [revisionName, setRevisionName] = useState("");
  const [revisionEmail, setRevisionEmail] = useState("");
  const [revisionComment, setRevisionComment] = useState("");

  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [approvalName, setApprovalName] = useState("");
  const [approvalEmail, setApprovalEmail] = useState("");
  const [confirmReview, setConfirmReview] = useState(false);

  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectName, setRejectName] = useState("");
  const [rejectEmail, setRejectEmail] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const currency = view.project.currency;

  const selectOption = useCallback(
    async (itemId: string, optionId: string | null) => {
      setBusy(`option:${itemId}`);
      setError(null);
      try {
        const result = await apiClient.post<{ view: ProposalView }>(`/api/public/proposals/${token}/options`, { boqItemId: itemId, optionId });
        setView(result.view);
      } catch (err) {
        setError(getApiErrorMessage(err));
      } finally {
        setBusy(null);
      }
    },
    [token],
  );

  const submitComment = useCallback(async () => {
    setBusy("comment");
    setError(null);
    try {
      await apiClient.post(`/api/public/proposals/${token}/comments`, { comment });
      setCommentSubmitted(true);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }, [comment, token]);

  const submitRevisionRequest = useCallback(async () => {
    setBusy("revision");
    setError(null);
    try {
      await apiClient.post(`/api/public/proposals/${token}/request-revision`, {
        name: revisionName,
        email: revisionEmail,
        comment: revisionComment,
      });
      router.push(`/proposal/${token}/revision-requested`);
    } catch (err) {
      setError(getApiErrorMessage(err));
      setBusy(null);
    }
  }, [revisionComment, revisionEmail, revisionName, router, token]);

  const submitApproval = useCallback(async () => {
    setBusy("approve");
    setError(null);
    try {
      await apiClient.post(`/api/public/proposals/${token}/approve`, {
        approvalName,
        approvalEmail,
        confirmReview,
      });
      router.push(`/proposal/${token}/approved`);
    } catch (err) {
      setError(getApiErrorMessage(err));
      setBusy(null);
    }
  }, [approvalEmail, approvalName, confirmReview, router, token]);

  const submitRejection = useCallback(async () => {
    setBusy("reject");
    setError(null);
    try {
      await apiClient.post(`/api/public/proposals/${token}/reject`, {
        name: rejectName,
        email: rejectEmail,
        reason: rejectReason,
      });
      setProposal((current) => ({ ...current, status: "REJECTED" }));
      setShowRejectForm(false);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }, [rejectEmail, rejectName, rejectReason, token]);

  const downloadUrl = useCallback((documentId: string) => `/api/public/proposals/${token}/documents/${documentId}`, [token]);

  const isDecided = useMemo(() => ["APPROVED", "REJECTED", "REVISION_REQUESTED"].includes(proposal.status), [proposal.status]);

  if (proposal.status === "REJECTED") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-lg font-semibold text-slate-900">This proposal was declined.</p>
        <p className="mt-2 text-sm text-slate-500">If this was a mistake, please contact {view.company.email} directly.</p>
      </div>
    );
  }

  const companyDetailLines = [
    view.company.address,
    view.company.email,
    view.company.phone,
    view.company.website,
    view.company.taxRegistrationNumber ? `TRN: ${view.company.taxRegistrationNumber}` : null,
  ].filter((line): line is string => Boolean(line));

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Bill of Quantities · Revision {view.boq.revision}</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">{view.project.name}</h1>
            <p className="mt-1 text-sm text-slate-500">{view.project.reference} · {view.project.location} · {view.project.industry}</p>
          </div>
          {view.company.logoUrl && (
            <img
              src={view.company.logoUrl}
              alt={`${view.company.tradeName || view.company.legalName} logo`}
              className="h-14 w-auto max-w-[160px] shrink-0 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm text-slate-600 sm:grid-cols-3">
          <div><p className="text-slate-400">Prepared for</p><p className="text-slate-900">{view.client.companyName ?? view.client.name}</p></div>
          <div>
            <p className="text-slate-400">Prepared by</p>
            <p className="text-slate-900">{view.company.tradeName || view.company.legalName}</p>
            {companyDetailLines.length > 0 && (
              <p className="mt-0.5 text-xs text-slate-500">{companyDetailLines.join(" · ")}</p>
            )}
          </div>
          <div><p className="text-slate-400">Currency</p><p className="text-slate-900">{currency}</p></div>
        </div>
      </section>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

      {view.boq.sections.map((section) => (
        <section key={section.code} className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-slate-900">{section.code} · {section.title}</h2>
          {section.description && <p className="mt-1 text-sm text-slate-500">{section.description}</p>}

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-700">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="py-2 pr-3">Item</th>
                  <th className="py-2 pr-3">Description</th>
                  <th className="py-2 pr-3">Qty</th>
                  <th className="py-2 pr-3">Unit</th>
                  {view.settings.showUnitRates && <th className="py-2 pr-3">Rate</th>}
                  <th className="py-2 pr-3">Amount</th>
                </tr>
              </thead>
              <tbody>
                {section.items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 align-top">
                    <td className="py-3 pr-3 text-slate-500">{item.itemCode || item.itemNumber}</td>
                    <td className="py-3 pr-3">
                      <p className="font-medium text-slate-900">{item.description}</p>
                      {item.specification && <p className="text-xs text-slate-500">{item.specification}</p>}
                      {view.settings.allowOptionSelection && item.options.length > 0 && (
                        <select
                          value={item.options.find((option) => option.isSelected)?.id ?? ""}
                          onChange={(event) => void selectOption(item.id, event.target.value || null)}
                          disabled={busy === `option:${item.id}` || isDecided}
                          className="mt-2 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                        >
                          <option value="">Standard specification</option>
                          {item.options.map((option) => (
                            <option key={option.id} value={option.id}>{option.label} · {formatCurrency(option.rate, currency)}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="py-3 pr-3">{item.quantity}</td>
                    <td className="py-3 pr-3">{item.unit}</td>
                    {view.settings.showUnitRates && <td className="py-3 pr-3">{item.unitRate !== null ? formatCurrency(item.unitRate, currency) : "—"}</td>}
                    <td className="py-3 pr-3 font-medium text-slate-900">{formatCurrency(item.totalAmount, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {view.settings.showSectionTotals && section.sectionTotal !== null && (
            <p className="mt-3 text-right text-sm font-semibold text-slate-900">Section total: {formatCurrency(section.sectionTotal, currency)}</p>
          )}
        </section>
      ))}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-slate-900">Summary</h2>
        <div className="mt-4 space-y-2 text-sm text-slate-700">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(view.boq.totals.subtotal, currency)}</span></div>
          {view.boq.totals.discountAmount > 0 && (
            <div className="flex justify-between"><span>Discount ({view.boq.totals.discountPercentage}%)</span><span>-{formatCurrency(view.boq.totals.discountAmount, currency)}</span></div>
          )}
          <div className="flex justify-between"><span>Taxable amount</span><span>{formatCurrency(view.boq.totals.taxableAmount, currency)}</span></div>
          <div className="flex justify-between"><span>Tax ({view.boq.totals.taxRate}%)</span><span>{formatCurrency(view.boq.totals.taxAmount, currency)}</span></div>
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900"><span>Grand total</span><span>{formatCurrency(view.boq.totals.grandTotal, currency)}</span></div>
        </div>
      </section>

      {(view.settings.showTerms || view.settings.showExclusions) && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          {view.settings.showTerms && (
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Terms</h3>
              <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{view.boq.termsText}</p>
            </div>
          )}
          {view.settings.showExclusions && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-slate-900">Exclusions</h3>
              <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{view.boq.exclusionsText}</p>
            </div>
          )}
        </section>
      )}

      {proposal.documents.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-slate-900">Documents</h2>
          <div className="mt-3 space-y-2">
            {proposal.documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-2 text-sm">
                <span className="text-slate-700">{doc.type} — {doc.fileName ?? "document"}</span>
                {view.settings.allowDocumentDownload ? (
                  <a href={downloadUrl(doc.id)} className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">Download</a>
                ) : (
                  <span className="text-xs text-slate-400">Download disabled</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {!isDecided && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-slate-900">Your response</h2>

          {view.settings.allowComments && !commentSubmitted && (
            <div className="mt-4">
              <label className="block text-sm text-slate-600">
                Add a comment (optional)
                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
                />
              </label>
              <button
                type="button"
                onClick={() => void submitComment()}
                disabled={busy === "comment" || !comment.trim()}
                className="mt-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {busy === "comment" ? "Submitting…" : "Submit comment"}
              </button>
            </div>
          )}
          {commentSubmitted && <p className="mt-4 text-sm text-emerald-600">Comment submitted.</p>}

          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={() => setShowApprovalForm((v) => !v)} className="rounded-xl border border-emerald-600 bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500">
              Approve proposal
            </button>
            <button type="button" onClick={() => setShowRevisionForm((v) => !v)} className="rounded-xl border border-orange-300 bg-orange-50 px-5 py-2.5 text-sm font-semibold text-orange-700 hover:bg-orange-100">
              Request revision
            </button>
            <button type="button" onClick={() => setShowRejectForm((v) => !v)} className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              Decline
            </button>
          </div>

          {showApprovalForm && (
            <div className="mt-4 space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              {view.settings.requireApprovalName && (
                <input value={approvalName} onChange={(e) => setApprovalName(e.target.value)} placeholder="Your name" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              )}
              {view.settings.requireApprovalEmail && (
                <input value={approvalEmail} onChange={(e) => setApprovalEmail(e.target.value)} placeholder="Your email" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              )}
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={confirmReview} onChange={(e) => setConfirmReview(e.target.checked)} />
                I have reviewed this proposal and approve it as presented.
              </label>
              <button
                type="button"
                onClick={() => void submitApproval()}
                disabled={busy === "approve" || !confirmReview || (view.settings.requireApprovalName && !approvalName.trim()) || (view.settings.requireApprovalEmail && !approvalEmail.trim())}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {busy === "approve" ? "Submitting…" : "Confirm approval"}
              </button>
            </div>
          )}

          {showRevisionForm && (
            <div className="mt-4 space-y-3 rounded-xl border border-orange-200 bg-orange-50 p-4">
              <input value={revisionName} onChange={(e) => setRevisionName(e.target.value)} placeholder="Your name" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input value={revisionEmail} onChange={(e) => setRevisionEmail(e.target.value)} placeholder="Your email" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <textarea value={revisionComment} onChange={(e) => setRevisionComment(e.target.value)} placeholder="What would you like changed?" rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <button
                type="button"
                onClick={() => void submitRevisionRequest()}
                disabled={busy === "revision" || !revisionName.trim() || !revisionEmail.trim() || !revisionComment.trim()}
                className="rounded-xl bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-50"
              >
                {busy === "revision" ? "Submitting…" : "Submit revision request"}
              </button>
            </div>
          )}

          {showRejectForm && (
            <div className="mt-4 space-y-3 rounded-xl border border-slate-300 bg-slate-50 p-4">
              <input value={rejectName} onChange={(e) => setRejectName(e.target.value)} placeholder="Your name" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input value={rejectEmail} onChange={(e) => setRejectEmail(e.target.value)} placeholder="Your email" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for declining" rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <button
                type="button"
                onClick={() => void submitRejection()}
                disabled={busy === "reject" || !rejectName.trim() || !rejectEmail.trim() || !rejectReason.trim()}
                className="rounded-xl bg-slate-700 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-600 disabled:opacity-50"
              >
                {busy === "reject" ? "Submitting…" : "Confirm decline"}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
