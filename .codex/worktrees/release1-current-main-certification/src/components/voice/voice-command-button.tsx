"use client";

import { forwardRef, useCallback, useEffect, useId, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import type { VoiceCommandContext, VoiceCommandProposal, VoiceTranscriptionResult } from "@/lib/voice/voice-types";

export type VoiceCommandButtonContext = VoiceCommandContext;

export type VoiceCommandButtonProps = {
  projectId: string;
  context: VoiceCommandButtonContext;
  onProposal: (proposal: VoiceCommandProposal) => void | Promise<void>;
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
  disabledReason?: string;
  compact?: boolean;
  ariaLabel?: string;
  className?: string;
};

type VoiceCapturePhase = "IDLE" | "REQUESTING_PERMISSION" | "RECORDING" | "TRANSCRIBING" | "INTERPRETING";

const MAX_RECORDING_DURATION_MS = 30_000;

const RECORDER_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
] as const;

export function selectVoiceRecorderMimeType(
  isTypeSupported: (mimeType: string) => boolean,
): string | null {
  return RECORDER_MIME_CANDIDATES.find((mimeType) => isTypeSupported(mimeType)) ?? null;
}

export function getVoiceRecordingExtension(mimeType: string): "webm" | "ogg" | "m4a" | "mp3" | "wav" {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes("ogg")) return "ogg";
  if (normalized.includes("mp4") || normalized.includes("m4a")) return "m4a";
  if (normalized.includes("mpeg") || normalized.includes("mp3")) return "mp3";
  if (normalized.includes("wav")) return "wav";
  return "webm";
}

function phaseLabel(phase: VoiceCapturePhase, recordingSeconds: number): string {
  switch (phase) {
    case "REQUESTING_PERMISSION":
      return "Requesting microphone access…";
    case "RECORDING":
      return `Recording ${recordingSeconds}s — activate to stop`;
    case "TRANSCRIBING":
      return "Transcribing voice instruction…";
    case "INTERPRETING":
      return "Preparing a structured change proposal…";
    default:
      return "Use voice";
  }
}

function stopStreamTracks(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export const VoiceCommandButton = forwardRef<HTMLButtonElement, VoiceCommandButtonProps>(function VoiceCommandButton(
  {
    projectId,
    context,
    onProposal,
    onBusyChange,
    disabled = false,
    disabledReason,
    compact = false,
    ariaLabel = "Record a voice instruction",
    className = "",
  },
  forwardedRef,
) {
  const generatedId = useId().replace(/:/g, "");
  const statusId = `voice-command-status-${generatedId}`;
  const disabledReasonId = `voice-command-disabled-${generatedId}`;
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const maximumDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const [phase, setPhase] = useState<VoiceCapturePhase>("IDLE");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [statusMessage, setStatusMessage] = useState("Voice is ready.");
  const [error, setError] = useState<string | null>(null);

  const clearCaptureTimers = useCallback(() => {
    if (maximumDurationTimerRef.current) clearTimeout(maximumDurationTimerRef.current);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    maximumDurationTimerRef.current = null;
    elapsedTimerRef.current = null;
  }, []);

  const releaseCapture = useCallback(() => {
    clearCaptureTimers();
    stopStreamTracks(streamRef.current);
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, [clearCaptureTimers]);

  const finishInteraction = useCallback(() => {
    if (mountedRef.current) {
      setPhase("IDLE");
      setRecordingSeconds(0);
    }
    onBusyChange?.(false);
  }, [onBusyChange]);

  const failInteraction = useCallback((message: string) => {
    releaseCapture();
    if (mountedRef.current) {
      setError(message);
      setStatusMessage("Voice instruction failed.");
    }
    finishInteraction();
  }, [finishInteraction, releaseCapture]);

  const submitRecording = useCallback(async (blob: Blob, mimeType: string) => {
    if (blob.size === 0) {
      failInteraction("No audio was captured. Check the microphone and try again.");
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      if (mountedRef.current) {
        setPhase("TRANSCRIBING");
        setStatusMessage("Transcribing voice instruction…");
      }
      const extension = getVoiceRecordingExtension(mimeType);
      const formData = new FormData();
      formData.set("file", new File([blob], `voice-instruction.${extension}`, { type: mimeType }));
      const transcription = await apiClient.postForm<VoiceTranscriptionResult>(
        `/api/projects/${encodeURIComponent(projectId)}/voice/transcribe`,
        formData,
        controller.signal,
      );

      if (mountedRef.current) {
        setPhase("INTERPRETING");
        setStatusMessage("Preparing a structured change proposal…");
      }
      const proposal = await apiClient.post<VoiceCommandProposal>(
        `/api/projects/${encodeURIComponent(projectId)}/voice/propose`,
        { transcript: transcription.transcript, context },
        controller.signal,
      );
      await onProposal(proposal);
      if (mountedRef.current) setStatusMessage("Voice proposal ready for review.");
      finishInteraction();
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      failInteraction(getApiErrorMessage(caught));
    } finally {
      abortControllerRef.current = null;
    }
  }, [context, failInteraction, finishInteraction, onProposal, projectId]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    clearCaptureTimers();
    setStatusMessage("Preparing the recording for transcription…");
    recorder.stop();
  }, [clearCaptureTimers]);

  const startRecording = useCallback(async () => {
    if (disabled || phase !== "IDLE") return;
    setError(null);
    setStatusMessage("Requesting microphone access…");
    setPhase("REQUESTING_PERMISSION");
    onBusyChange?.(true);

    if (
      typeof window === "undefined"
      || !window.isSecureContext
      || !navigator.mediaDevices?.getUserMedia
      || typeof MediaRecorder === "undefined"
    ) {
      failInteraction("Voice recording is not supported in this browser or connection. Use a secure, current browser.");
      return;
    }

    const mimeType = selectVoiceRecorderMimeType((candidate) => MediaRecorder.isTypeSupported(candidate));
    if (!mimeType) {
      failInteraction("This browser cannot record a supported audio format. Use manual entry or a current browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      if (!mountedRef.current) {
        stopStreamTracks(stream);
        return;
      }

      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        recorder.onstop = null;
        failInteraction("The browser could not complete the recording. Check the microphone and try again.");
      };
      recorder.onstop = () => {
        const recordedType = recorder.mimeType || mimeType;
        const blob = new Blob(chunksRef.current, { type: recordedType });
        releaseCapture();
        void submitRecording(blob, recordedType);
      };
      recorder.start();
      setRecordingSeconds(0);
      setPhase("RECORDING");
      setStatusMessage("Recording. Activate the button again to stop.");
      elapsedTimerRef.current = setInterval(() => {
        if (mountedRef.current) setRecordingSeconds((seconds) => seconds + 1);
      }, 1_000);
      maximumDurationTimerRef.current = setTimeout(() => {
        if (recorder.state === "recording") {
          setStatusMessage("Maximum recording length reached. Preparing transcription…");
          recorder.stop();
        }
      }, MAX_RECORDING_DURATION_MS);
    } catch (caught) {
      const message = caught instanceof DOMException && caught.name === "NotAllowedError"
        ? "Microphone permission was denied. Allow microphone access or continue with manual entry."
        : "The microphone is unavailable. Check the browser permission and connected microphone.";
      failInteraction(message);
    }
  }, [disabled, failInteraction, onBusyChange, phase, releaseCapture, submitRecording]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
      const recorder = recorderRef.current;
      if (recorder) {
        recorder.ondataavailable = null;
        recorder.onerror = null;
        recorder.onstop = null;
        if (recorder.state === "recording") recorder.stop();
      }
      releaseCapture();
    };
  }, [releaseCapture]);

  const isRecording = phase === "RECORDING";
  const isBusy = phase !== "IDLE";
  const displayedLabel = phaseLabel(phase, recordingSeconds);
  const buttonDisabled = disabled || (isBusy && !isRecording);

  return (
    <div className={`inline-flex flex-col items-start gap-1.5 ${className}`.trim()}>
      <button
        ref={forwardedRef}
        type="button"
        onClick={isRecording ? stopRecording : () => void startRecording()}
        disabled={buttonDisabled}
        aria-label={isRecording ? "Stop voice recording" : ariaLabel}
        aria-pressed={isRecording}
        aria-describedby={`${statusId}${disabled && disabledReason ? ` ${disabledReasonId}` : ""}`}
        title={disabled ? disabledReason : undefined}
        className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 disabled:cursor-not-allowed disabled:opacity-50 ${
          isRecording
            ? "border-rose-500 bg-rose-600 text-white hover:bg-rose-500"
            : "border-slate-700 bg-slate-900 text-slate-100 hover:border-blue-500 hover:bg-slate-800"
        }`}
      >
        {isRecording ? <Square className="h-4 w-4" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
        <span className={compact && !isRecording ? "sr-only" : ""}>{displayedLabel}</span>
      </button>
      <span id={statusId} role="status" aria-live="polite" className={compact && !error ? "sr-only" : "text-xs text-slate-400"}>
        {statusMessage}
      </span>
      {disabled && disabledReason ? <span id={disabledReasonId} className="sr-only">{disabledReason}</span> : null}
      {error ? <span role="alert" className="max-w-xs text-xs text-rose-300">{error}</span> : null}
    </div>
  );
});

VoiceCommandButton.displayName = "VoiceCommandButton";

export default VoiceCommandButton;
