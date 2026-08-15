"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mic, Square } from "lucide-react";
import { apiClient, ApiClientError, getApiErrorMessage, type ApiErrorPayload } from "@/lib/api/client";
import { useTranslations } from "@/lib/i18n/locale-provider";
import type { TranslationKey } from "@/lib/i18n/translate";
import { TAYQAN_HIRE_PLANS } from "@/lib/tayqan/tayqan-commerce";
import type { VoiceTranscriptionResult } from "@/lib/voice/voice-types";
import {
  getVoiceRecordingExtension,
  selectVoiceRecorderMimeType,
} from "@/components/voice/voice-command-button";
import { TayqanWorkOrderPanel, type TayqanWorkOrderState } from "@/components/tayqan/tayqan-work-order-panel";

type HireState = {
  accessMode:
    | "PAID"
    | "INTERNAL_ADMIN"
    | null;

  projectQuota: {
    maxProjects: number | null;
    usedProjects: number;
    remainingProjects: number | null;
    currentProjectAssigned: boolean;
    canAssignCurrentProject: boolean;
  } | null;

  entitlement: {
    id: string;
    plan: "DAY" | "WEEK" | "MONTHLY";
    status: string;
    priceCode: string;
    startsAt: string | null;
    expiresAt: string | null;
  } | null;
  session: {
    id: string;
    status: string;
    boqId: string | null;
    desiredDeliverable: string | null;
    measurementStandard: string | null;
    includeRates: boolean | null;
    pricingBasis: string | null;
    exclusions: string | null;
    deadlineText: string | null;
    specialInstructions: string | null;
    authoritativeSourcePolicy: string | null;
    workerRunId: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  messages: Array<{
    id: string;
    role: "TAYQAN" | "USER" | "SYSTEM";
    message: string;
    structuredData: unknown;
    createdAt: string;
  }>;
  question: {
    key: string;
    i18nKey: string;
    inputType: "choice" | "text" | "action";
    options?: Array<{ value: string; label?: string; labelKey?: string }>;
    vars?: Record<string, string | number>;
    actionHref?: string;
  } | null;
  snapshot: {
    project: { id: string; slug: string; name: string; reference: string };
    boqs: Array<{ id: string; title: string; revisionNumber: number }>;
    files: Array<{ id: string; originalName: string; classification: string; revisionNumber: string | null }>;
    extractedEntityCount: number;
    confirmedEntityCount: number;
  };
};

type CheckoutResult = { checkoutSessionId: string; checkoutUrl: string };

type TayqanVoicePhase =
  | "IDLE"
  | "REQUESTING"
  | "RECORDING"
  | "TRANSCRIBING";

type TayqanQuestionOption =
  NonNullable<
    NonNullable<HireState["question"]>["options"]
  >[number];

type StartResult = TayqanWorkOrderState;

function structuredRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeTayqanVoiceChoice(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[_/\-]+/g, " ")
    .replace(/[^\p{L}\p{N}%]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveTayqanVoiceChoice(
  transcript: string,
  options: readonly TayqanQuestionOption[],
  translate: (key: TranslationKey) => string,
): string | null {
  const spoken = normalizeTayqanVoiceChoice(transcript);

  if (!spoken) return null;

  const matches = options.filter((option) => {
    const candidates = [
      option.value,
      option.label ?? "",
      option.labelKey
        ? translate(option.labelKey as TranslationKey)
        : "",
    ]
      .map(normalizeTayqanVoiceChoice)
      .filter(Boolean);

    return candidates.some(
      (candidate) =>
        spoken === candidate
        || (
          spoken.length >= 3
          && candidate.includes(spoken)
        )
        || (
          candidate.length >= 3
          && spoken.includes(candidate)
        ),
    );
  });

  return matches.length === 1
    ? matches[0].value
    : null;
}

function makeIdempotencyKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `tayqan-start-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function TayqanHireExperience({
  projectId,
  selectedBoqId,
  onWorkerStarted,
}: {
  projectId: string;
  selectedBoqId: string | null;
  onWorkerStarted: () => void | Promise<void>;
}) {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const checkoutState = searchParams.get("checkout");

  const [state, setState] = useState<HireState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutPrice, setCheckoutPrice] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [answering, setAnswering] = useState(false);

  const [voicePhase, setVoicePhase] =
    useState<TayqanVoicePhase>("IDLE");

  const [voiceError, setVoiceError] =
    useState<string | null>(null);

  const [voiceTranscript, setVoiceTranscript] =
    useState<string | null>(null);

  const voiceRecorderRef =
    useRef<MediaRecorder | null>(null);

  const voiceStreamRef =
    useRef<MediaStream | null>(null);

  const voiceChunksRef =
    useRef<Blob[]>([]);

  const voiceTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );

  const voiceMountedRef =
    useRef(true);

  const [starting, setStarting] = useState(false);
  const [startResult, setStartResult] = useState<StartResult | null>(null);

  const stateUrl = useMemo(() => {
    const params = selectedBoqId ? `?boqId=${encodeURIComponent(selectedBoqId)}` : "";
    return `/api/projects/${encodeURIComponent(projectId)}/tayqan${params}`;
  }, [projectId, selectedBoqId]);

  const load = useCallback(async () => {
    try {
      const next = await apiClient.get<HireState>(stateUrl);
      setState(next);
      setError(null);
      return next;
    } catch (loadError) {
      setError(getApiErrorMessage(loadError));
      return null;
    } finally {
      setLoading(false);
    }
  }, [stateUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (checkoutState !== "success" || state?.entitlement) return;
    const timer = window.setInterval(() => {
      void load();
    }, 2000);
    return () => window.clearInterval(timer);
  }, [checkoutState, state?.entitlement, load]);

  const clearVoiceTimeout = useCallback(() => {
    if (voiceTimeoutRef.current) {
      clearTimeout(voiceTimeoutRef.current);
      voiceTimeoutRef.current = null;
    }
  }, []);

  const releaseVoiceCapture = useCallback(() => {
    clearVoiceTimeout();

    voiceStreamRef.current
      ?.getTracks()
      .forEach((track) => track.stop());

    voiceStreamRef.current = null;
    voiceRecorderRef.current = null;
    voiceChunksRef.current = [];
  }, [clearVoiceTimeout]);

  useEffect(() => {
    voiceMountedRef.current = true;

    return () => {
      voiceMountedRef.current = false;

      const recorder =
        voiceRecorderRef.current;

      if (
        recorder
        && recorder.state === "recording"
      ) {
        recorder.onstop = null;
        recorder.stop();
      }

      releaseVoiceCapture();
    };
  }, [releaseVoiceCapture]);

  useEffect(() => {
    setVoiceError(null);
    setVoiceTranscript(null);
  }, [state?.question?.key]);

  const beginCheckout = async (priceCode: string) => {
    setCheckoutPrice(priceCode);
    setError(null);
    try {
      const result = await apiClient.post<CheckoutResult>("/api/tayqan/checkout", {
        priceCode,
        projectId,
        ...(selectedBoqId ? { boqId: selectedBoqId } : {}),
      });
      window.location.assign(result.checkoutUrl);
    } catch (checkoutError) {
      setError(getApiErrorMessage(checkoutError));
      setCheckoutPrice(null);
    }
  };

  const submitAnswer = async (value?: string) => {
    if (!state?.session || !state.question) return;
    const nextAnswer = (value ?? answer).trim();
    if (!nextAnswer) return;
    setAnswering(true);
    setError(null);
    try {
      const next = await apiClient.post<HireState>(
        `/api/projects/${encodeURIComponent(projectId)}/tayqan/intake`,
        {
          sessionId: state.session.id,
          questionKey: state.question.key,
          answer: nextAnswer,
        },
      );
      setState(next);
      setAnswer("");
    } catch (answerError) {
      setError(getApiErrorMessage(answerError));
    } finally {
      setAnswering(false);
    }
  };

  const transcribeVoiceAnswer =
    async (
      blob: Blob,
      mimeType: string,
    ) => {

      if (blob.size === 0) {
        if (voiceMountedRef.current) {
          setVoiceError(
            t("tayqan.hire.voiceEmpty"),
          );
          setVoicePhase("IDLE");
        }
        return;
      }

      const activeQuestion =
        state?.question;

      if (
        !activeQuestion
        || (
          activeQuestion.inputType !== "choice"
          && activeQuestion.inputType !== "text"
        )
      ) {
        if (voiceMountedRef.current) {
          setVoicePhase("IDLE");
        }
        return;
      }

      setVoicePhase("TRANSCRIBING");
      setVoiceError(null);

      try {
        const extension =
          getVoiceRecordingExtension(
            mimeType,
          );

        const formData =
          new FormData();

        formData.set(
          "file",
          new File(
            [blob],
            `tayqan-intake.${extension}`,
            { type: mimeType },
          ),
        );

        const result =
          await apiClient.postForm<
            VoiceTranscriptionResult
          >(
            `/api/projects/${encodeURIComponent(projectId)}/voice/transcribe`,
            formData,
          );

        if (!voiceMountedRef.current) {
          return;
        }

        const transcript =
          result.transcript.trim();

        if (!transcript) {
          setVoiceError(
            t("tayqan.hire.voiceEmpty"),
          );
          return;
        }

        setVoiceTranscript(transcript);

        if (
          activeQuestion.inputType === "text"
        ) {
          // Voice fills the SAME existing manual
          // answer box so the user can review/edit
          // it before sending.
          setAnswer(transcript);
          return;
        }

        const matchedValue =
          resolveTayqanVoiceChoice(
            transcript,
            activeQuestion.options ?? [],
            (key) => t(key),
          );

        if (!matchedValue) {
          // Never invent which choice the user meant.
          setVoiceError(
            t(
              "tayqan.hire.voiceChoiceNoMatch",
              { transcript },
            ),
          );
          return;
        }

        setVoiceTranscript(null);

        // A uniquely matched voice choice travels
        // through the exact SAME existing intake
        // endpoint and server validation.
        await submitAnswer(
          matchedValue,
        );
      }
      catch (caught) {
        if (voiceMountedRef.current) {
          setVoiceError(
            getApiErrorMessage(caught),
          );
        }
      }
      finally {
        if (voiceMountedRef.current) {
          setVoicePhase("IDLE");
        }
      }
    };

  const stopVoiceAnswer = () => {
    const recorder =
      voiceRecorderRef.current;

    if (
      !recorder
      || recorder.state !== "recording"
    ) {
      return;
    }

    clearVoiceTimeout();
    recorder.stop();
  };

  const startVoiceAnswer =
    async () => {

      if (
        answering
        || voicePhase !== "IDLE"
      ) {
        return;
      }

      setVoiceError(null);
      setVoiceTranscript(null);

      if (
        typeof window === "undefined"
        || !window.isSecureContext
        || !navigator.mediaDevices
          ?.getUserMedia
        || typeof MediaRecorder ===
          "undefined"
      ) {
        setVoiceError(
          t(
            "tayqan.hire.voiceUnavailable",
          ),
        );
        return;
      }

      const mimeType =
        selectVoiceRecorderMimeType(
          (candidate) =>
            MediaRecorder.isTypeSupported(
              candidate,
            ),
        );

      if (!mimeType) {
        setVoiceError(
          t(
            "tayqan.hire.voiceUnavailable",
          ),
        );
        return;
      }

      setVoicePhase("REQUESTING");

      try {
        const stream =
          await navigator.mediaDevices
            .getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
              },
            });

        if (!voiceMountedRef.current) {
          stream
            .getTracks()
            .forEach(
              (track) => track.stop(),
            );
          return;
        }

        voiceStreamRef.current =
          stream;

        voiceChunksRef.current = [];

        const recorder =
          new MediaRecorder(
            stream,
            { mimeType },
          );

        voiceRecorderRef.current =
          recorder;

        recorder.ondataavailable =
          (event) => {
            if (event.data.size > 0) {
              voiceChunksRef.current.push(
                event.data,
              );
            }
          };

        recorder.onerror = () => {
          recorder.onstop = null;

          releaseVoiceCapture();

          if (voiceMountedRef.current) {
            setVoiceError(
              t(
                "tayqan.hire.voiceRecordingFailed",
              ),
            );

            setVoicePhase("IDLE");
          }
        };

        recorder.onstop = () => {
          const recordedType =
            recorder.mimeType
            || mimeType;

          const blob =
            new Blob(
              voiceChunksRef.current,
              { type: recordedType },
            );

          releaseVoiceCapture();

          void transcribeVoiceAnswer(
            blob,
            recordedType,
          );
        };

        recorder.start();

        setVoicePhase("RECORDING");

        voiceTimeoutRef.current =
          setTimeout(() => {
            const active =
              voiceRecorderRef.current;

            if (
              active?.state ===
              "recording"
            ) {
              active.stop();
            }
          }, 30_000);
      }
      catch {
        releaseVoiceCapture();

        if (voiceMountedRef.current) {
          setVoiceError(
            t(
              "tayqan.hire.voicePermissionFailed",
            ),
          );

          setVoicePhase("IDLE");
        }
      }
    };

  const startWork = async () => {
    if (!state?.session) return;
    setStarting(true);
    setError(null);
    const idempotencyKey = makeIdempotencyKey();
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/tayqan/start`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({ sessionId: state.session.id }),
        },
      );
      const payload = (await response.json()) as
        | { ok: true; data: StartResult }
        | { ok: false; error: ApiErrorPayload };
      if (!response.ok || !payload.ok) {
        throw new ApiClientError(
          !payload.ok
            ? payload.error
            : { code: "REQUEST_FAILED", message: "Could not start TAYQAN." },
          response.status,
        );
      }
      setStartResult(payload.data);
      await load();
      if (payload.data.qaWorkerRunId) {
        await onWorkerStarted();
      }
    } catch (startError) {
      setError(getApiErrorMessage(startError));
    } finally {
      setStarting(false);
    }
  };

  const renderMessage = (message: HireState["messages"][number]) => {
    const structured = structuredRecord(message.structuredData);
    const key = structured?.i18nKey;
    if (typeof key === "string") {
      const vars = structured?.vars;
      return t(
        key as TranslationKey,
        vars && typeof vars === "object" && !Array.isArray(vars)
          ? (vars as Record<string, string | number>)
          : undefined,
      );
    }
    return message.message;
  };

  if (loading && !state) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-sm text-slate-300">
        {t("tayqan.loading")}
      </div>
    );
  }

  if (!state) {
    return (
      <div className="rounded-[32px] border border-rose-900 bg-rose-950/10 p-8">
        <p className="text-sm text-rose-300">{error ?? t("tayqan.unavailable")}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-xl border border-slate-700 px-4 py-2 text-sm text-white"
        >
          {t("tayqan.hire.retry")}
        </button>
      </div>
    );
  }

  if (!state.entitlement) {
    return (
      <div className="space-y-5 rounded-[32px] border border-slate-800 bg-slate-950 p-6 sm:p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-400">
            {t("tayqan.hire.pricingEyebrow")}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            {t("tayqan.hire.pricingTitle")}
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            {t("tayqan.hire.pricingDescription")}
          </p>
        </div>

        {checkoutState === "success" && (
          <div className="rounded-2xl border border-cyan-800 bg-cyan-950/20 px-4 py-3 text-sm text-cyan-100">
            {t("tayqan.hire.confirmingPayment")}
          </div>
        )}

        {checkoutState === "cancelled" && (
          <div className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-300">
            {t("tayqan.hire.checkoutCancelled")}
          </div>
        )}

        {error && <p className="text-sm text-rose-300">{error}</p>}

        <div className="grid gap-4 lg:grid-cols-3">
          {TAYQAN_HIRE_PLANS.map((plan) => {
            const badgeKey =
              plan.badge === "MOST_POPULAR"
                ? "tayqan.hire.mostPopular"
                : plan.badge === "DIGITAL_QS"
                  ? "tayqan.hire.digitalQs"
                  : null;
            const durationKey =
              plan.plan === "DAY"
                ? "tayqan.hire.dayDuration"
                : plan.plan === "WEEK"
                  ? "tayqan.hire.weekDuration"
                  : "tayqan.hire.monthDuration";
            const billingKey =
              plan.checkoutMode === "payment"
                ? "tayqan.hire.oneTime"
                : "tayqan.hire.recurring";

            return (
              <div
                key={plan.priceCode}
                className={[
                  "relative flex flex-col rounded-3xl border p-5",
                  plan.plan === "WEEK"
                    ? "border-cyan-500 bg-cyan-950/20"
                    : "border-slate-800 bg-slate-900/60",
                ].join(" ")}
              >
                {badgeKey && (
                  <span className="mb-3 w-fit rounded-full border border-cyan-600 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300">
                    {t(badgeKey as TranslationKey)}
                  </span>
                )}
                <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                <p className="mt-3 text-3xl font-semibold text-white">
                  AED {(plan.amountMinor / 100).toLocaleString("en-AE")}
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  {t(durationKey as TranslationKey)} · {t(billingKey as TranslationKey)}
                </p>

                {plan.maxDistinctProjects !== null && (
                  <p className="mt-2 text-xs font-semibold text-cyan-300">
                    {t(
                      "tayqan.hire.dayProjectAllowance",
                      {
                        count:
                          plan.maxDistinctProjects,
                      },
                    )}
                  </p>
                )}

                <button
                  type="button"
                  disabled={checkoutPrice !== null}
                  onClick={() => void beginCheckout(plan.priceCode)}
                  className="mt-6 rounded-2xl border border-cyan-500 bg-cyan-600 px-5 py-3 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
                >
                  {checkoutPrice === plan.priceCode
                    ? t("tayqan.hire.redirecting")
                    : t("tayqan.hire.hireMe")}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const internalAdminAccess =
    state.accessMode ===
    "INTERNAL_ADMIN";

  const limitedQuota =
    state.projectQuota
    && state.projectQuota.maxProjects
      !== null
      ? state.projectQuota
      : null;

  if (
    limitedQuota
    && !limitedQuota
      .canAssignCurrentProject
  ) {
    return (
      <div className="space-y-5 rounded-[32px] border border-amber-700 bg-slate-950 p-6 sm:p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-400">
            {t(
              "tayqan.hire.projectLimitReachedTitle",
            )}
          </p>

          <h2 className="mt-2 text-2xl font-semibold text-white">
            {t(
              "tayqan.hire.projectLimitReachedTitle",
            )}
          </h2>

          <p className="mt-3 max-w-3xl text-sm text-slate-300">
            {t(
              "tayqan.hire.projectLimitReachedDescription",
              {
                max:
                  limitedQuota.maxProjects ?? 0,
                used:
                  limitedQuota.usedProjects,
              },
            )}
          </p>
        </div>

        <div className="rounded-2xl border border-amber-900 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          {t(
            "tayqan.hire.projectUsage",
            {
              used:
                limitedQuota.usedProjects,
              max:
                limitedQuota.maxProjects ?? 0,
              remaining:
                limitedQuota.remainingProjects
                ?? 0,
            },
          )}
        </div>

        <Link
          href="/projects?tayqan=assign"
          className="inline-flex rounded-2xl border border-cyan-600 bg-cyan-600 px-5 py-3 text-sm font-semibold text-white hover:bg-cyan-500"
        >
          {t(
            "tayqan.hire.chooseAssignedProject",
          )}
        </Link>
      </div>
    );
  }

  const question = state.question;
  const ready = state.session?.status === "READY";
  const workStarted = state.session?.status === "WORK_STARTED" || Boolean(startResult);

  const voiceBusy =
    voicePhase !== "IDLE";

  const voiceLabel =
    voicePhase === "REQUESTING"
      ? t("tayqan.hire.voiceRequesting")
      : voicePhase === "RECORDING"
        ? t("tayqan.hire.voiceStop")
        : voicePhase === "TRANSCRIBING"
          ? t(
              "tayqan.hire.voiceTranscribing",
            )
          : t("tayqan.hire.voiceStart");

  const voiceButtonDisabled =
    answering
    || voicePhase === "REQUESTING"
    || voicePhase === "TRANSCRIBING";

  return (
    <div className="space-y-5 rounded-[32px] border border-cyan-900 bg-slate-950 p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-400">
            {t(
              internalAdminAccess
                ? "tayqan.hire.internalAdminEyebrow"
                : "tayqan.hire.activeEyebrow",
            )}
          </p>

          <h2 className="mt-2 text-2xl font-semibold text-white">
            {t(
              internalAdminAccess
                ? "tayqan.hire.internalAdminTitle"
                : "tayqan.hire.activeTitle",
            )}
          </h2>
        </div>
        {state.entitlement.expiresAt && (
          <div className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs text-slate-300">
            {t("tayqan.hire.activeUntil")}:{" "}
            {new Date(state.entitlement.expiresAt).toLocaleString()}
          </div>
        )}
      </div>

      {internalAdminAccess && (
        <div className="rounded-2xl border border-emerald-800 bg-emerald-950/20 px-4 py-3 text-sm font-medium text-emerald-100">
          {t(
            "tayqan.hire.internalAdminAccess",
          )}
        </div>
      )}

      {!internalAdminAccess
        && limitedQuota
        && (
          <div className="rounded-2xl border border-cyan-900 bg-cyan-950/20 px-4 py-3 text-sm text-cyan-100">
            {t(
              "tayqan.hire.projectUsage",
              {
                used:
                  limitedQuota.usedProjects,
                max:
                  limitedQuota.maxProjects ?? 0,
                remaining:
                  limitedQuota.remainingProjects
                  ?? 0,
              },
            )}
          </div>
        )}

      {error && <p className="text-sm text-rose-300">{error}</p>}

      <div className="space-y-3 rounded-3xl border border-slate-800 bg-slate-900/60 p-4">
        {state.messages.map((message) => (
          <div
            key={message.id}
            className={[
              "max-w-[92%] rounded-2xl px-4 py-3 text-sm",
              message.role === "USER"
                ? "ms-auto bg-cyan-700 text-white"
                : "me-auto border border-slate-700 bg-slate-950 text-slate-200",
            ].join(" ")}
          >
            {renderMessage(message)}
          </div>
        ))}

        {question?.inputType === "choice" && (
          <div className="me-auto max-w-[92%] rounded-2xl border border-cyan-900 bg-cyan-950/10 p-4">
            <p className="text-sm text-cyan-100">
              {t(question.i18nKey as TranslationKey, question.vars)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(question.options ?? []).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={answering || voiceBusy}
                  onClick={() => void submitAnswer(option.value)}
                  className="rounded-xl border border-cyan-700 bg-slate-950 px-3 py-2 text-xs font-medium text-cyan-100 hover:bg-cyan-950 disabled:opacity-50"
                >
                  {option.labelKey
                    ? t(option.labelKey as TranslationKey)
                    : option.label ?? option.value}
                </button>
              ))}
            </div>

            <div className="mt-3 border-t border-cyan-900/60 pt-3">
              <button
                type="button"
                disabled={voiceButtonDisabled}
                onClick={() => {
                  if (
                    voicePhase ===
                    "RECORDING"
                  ) {
                    stopVoiceAnswer();
                  }
                  else {
                    void startVoiceAnswer();
                  }
                }}
                aria-label={voiceLabel}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-cyan-700 hover:text-cyan-100 disabled:opacity-50"
              >
                {voicePhase === "RECORDING" ? (
                  <Square className="h-3.5 w-3.5" />
                ) : (
                  <Mic className="h-3.5 w-3.5" />
                )}

                {voiceLabel}
              </button>

              {voiceError && (
                <p className="mt-2 text-xs text-amber-300">
                  {voiceError}
                </p>
              )}

              {voiceTranscript && voiceError && (
                <p className="mt-1 text-xs text-slate-500">
                  {voiceTranscript}
                </p>
              )}
            </div>
          </div>
        )}

        {question?.inputType === "text" && (
          <div className="me-auto w-full max-w-2xl rounded-2xl border border-cyan-900 bg-cyan-950/10 p-4">
            <p className="text-sm text-cyan-100">
              {t(question.i18nKey as TranslationKey, question.vars)}
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={answer}
                disabled={answering || voiceBusy}
                onChange={(event) => setAnswer(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void submitAnswer();
                  }
                }}
                placeholder={t("tayqan.hire.answerPlaceholder")}
                className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600"
              />
              <button
                type="button"
                disabled={voiceButtonDisabled}
                onClick={() => {
                  if (
                    voicePhase ===
                    "RECORDING"
                  ) {
                    stopVoiceAnswer();
                  }
                  else {
                    void startVoiceAnswer();
                  }
                }}
                aria-label={voiceLabel}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-semibold text-slate-200 hover:border-cyan-700 hover:text-cyan-100 disabled:opacity-50"
              >
                {voicePhase === "RECORDING" ? (
                  <Square className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}

                <span className="sm:hidden">
                  {voiceLabel}
                </span>
              </button>

              <button
                type="button"
                disabled={
                  answering
                  || voiceBusy
                  || !answer.trim()
                }
                onClick={() => void submitAnswer()}
                className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {answering
                  ? t("tayqan.hire.sending")
                  : t("tayqan.hire.send")}
              </button>
            </div>

            {voiceError && (
              <p className="mt-2 text-xs text-amber-300">
                {voiceError}
              </p>
            )}

            {voicePhase === "TRANSCRIBING" && (
              <p className="mt-2 text-xs text-cyan-300">
                {t(
                  "tayqan.hire.voiceTranscribing",
                )}
              </p>
            )}
          </div>
        )}

        {question?.inputType === "action" && question.actionHref && (
          <div className="me-auto max-w-[92%] rounded-2xl border border-amber-800 bg-amber-950/10 p-4">
            <p className="text-sm text-amber-100">
              {t(question.i18nKey as TranslationKey, question.vars)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={question.actionHref}
                className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white"
              >
                {question.key === "upload_sources"
                  ? t("tayqan.hire.openFiles")
                  : t("tayqan.hire.openBoq")}
              </Link>
              <button
                type="button"
                onClick={() => void load()}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200"
              >
                {t("tayqan.hire.checkAgain")}
              </button>
            </div>
          </div>
        )}
      </div>

      {ready && !workStarted && (
        <button
          type="button"
          disabled={starting}
          onClick={() => void startWork()}
          className="rounded-2xl border border-emerald-500 bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {starting ? t("tayqan.hire.starting") : t("tayqan.hire.startWork")}
        </button>
      )}

      {workStarted && state.session && (
        <TayqanWorkOrderPanel
          projectId={projectId}
          sessionId={state.session.id}
          initialState={startResult}
          onQaStarted={onWorkerStarted}
        />
      )}
    </div>
  );
}
