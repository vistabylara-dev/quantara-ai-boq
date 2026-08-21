"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";

type ReportView = {
  company: { legalName: string; tradeName: string; address: string | null; email: string; phone: string | null; website: string | null };
  client: { name: string; companyName: string | null };
  project: { name: string; reference: string; location: string; currency: string; industry: string };
  report: { id: string; name: string; templateName: string; documentType: string | null; fileName: string | null; fileSize: number | null; completedAt: string | null };
  settings: {
    allowComments: boolean;
    allowDocumentDownload: boolean;
    requireApprovalName: boolean;
    requireApprovalEmail: boolean;
  };
};
type ProposalSummary = { status: string; clientComment: string | null };

type Props = { token: string; initialView: ReportView; initialProposal: ProposalSummary };

/**
 * Technical-report equivalent of ProposalClientView (see that file for the full BOQ portal). No
 * pricing/options/totals here — a GeneratedTechnicalReport is a single immutable document, so this
 * view is a summary + document card + the same source-agnostic comment/approve/reject/revision
 * actions the BOQ portal uses.
 */
export default function TechnicalReportClientView({ token, initialView, initialProposal }: Props) {
  const router = useRouter();
  const [view] = useState(initialView);
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
      await apiClient.post(`/api/public/proposals/${token}/request-revision`, { name: revisionName, email: revisionEmail, comment: revisionComment });
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
      await apiClient.post(`/api/public/proposals/${token}/approve`, { approvalName, approvalEmail, confirmReview });
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
      await apiClient.post(`/api/public/proposals/${token}/reject`, { name: rejectName, email: rejectEmail, reason: rejectReason });
      setProposal((current) => ({ ...current, status: "REJECTED" }));
      setShowRejectForm(false);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }, [rejectEmail, rejectName, rejectReason, token]);

  const downloadUrl = `/api/public/proposals/${token}/documents/${view.report.id}`;
  const isDecided = useMemo(() => ["APPROVED", "REJECTED", "REVISION_REQUESTED"].includes(proposal.status), [proposal.status]);

  if (proposal.status === "REJECTED") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-lg font-semibold text-slate-900">This proposal was declined.</p>
        <p className="mt-2 text-sm text-slate-500">If this was a mistake, please contact {view.company.email} directly.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Technical Report</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">{view.project.name}</h1>
        <p className="mt-1 text-sm text-slate-500">{view.project.reference} · {view.project.location} · {view.project.industry}</p>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm text-slate-600 sm:grid-cols-3">
          <div><p className="text-slate-400">Prepared for</p><p className="text-slate-900">{view.client.companyName ?? view.client.name}</p></div>
          <div><p className="text-slate-400">Prepared by</p><p className="text-slate-900">{view.company.tradeName || view.company.legalName}</p></div>
          <div><p className="text-slate-400">Report template</p><p className="text-slate-900">{view.report.templateName}</p></div>
        </div>
      </section>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-slate-900">{view.report.name}</h2>
        <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm">
          <span className="text-slate-700">{view.report.documentType ?? "Document"} — {view.report.fileName ?? "report"}</span>
          {view.settings.allowDocumentDownload ? (
            <a href={downloadUrl} className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">Download</a>
          ) : (
            <span className="text-xs text-slate-400">Download disabled</span>
          )}
        </div>
      </section>

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
              Acknowledge / Approve
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
                I have reviewed this report and approve it as presented.
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
