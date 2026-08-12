import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  getVoiceRecordingExtension,
  selectVoiceRecorderMimeType,
} from "../src/components/voice/voice-command-button";
import {
  applyConfirmedDimensionVoiceProposal,
  formatVoiceProposalValue,
} from "../src/components/voice/voice-proposal-card";
import type { VoiceDimensionValue } from "../src/lib/voice/voice-types";
import {
  getVoiceBOQFieldLabel,
  isPersistedItemId,
} from "../src/components/boq/boq-editor";
import { FEATURE_HINT_REGISTRY } from "../src/components/guidance/feature-hint";

const source = (relativePath: string) => readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");

describe("Release 1 voice command UI", () => {
  it("selects a server-supported MediaRecorder type in deterministic browser-preference order", () => {
    expect(selectVoiceRecorderMimeType((mime) => mime === "audio/ogg;codecs=opus" || mime === "audio/mp4"))
      .toBe("audio/ogg;codecs=opus");
    expect(selectVoiceRecorderMimeType((mime) => mime === "audio/mp4")).toBe("audio/mp4");
    expect(selectVoiceRecorderMimeType(() => false)).toBeNull();

    expect(getVoiceRecordingExtension("audio/webm;codecs=opus")).toBe("webm");
    expect(getVoiceRecordingExtension("audio/ogg;codecs=opus")).toBe("ogg");
    expect(getVoiceRecordingExtension("audio/mp4")).toBe("m4a");
    expect(getVoiceRecordingExtension("audio/mpeg")).toBe("mp3");
    expect(getVoiceRecordingExtension("audio/wav")).toBe("wav");
  });

  it("applies a confirmed dimension proposal to local form state without mutating the prior state", () => {
    const dimensions: VoiceDimensionValue[] = [
      {
        key: "wallLength",
        label: "Wall Length",
        unit: "m",
        required: true,
        value: 24.8,
        source: "extracted_entity",
        confidence: 92,
        reviewStatus: "PREFILLED",
      },
      {
        key: "wallHeight",
        label: "Wall Height",
        unit: "m",
        required: true,
        value: 3.4,
        source: "manual_professional_input",
        confidence: 100,
        reviewStatus: "MANUAL_ENTRY",
      },
    ];

    const updated = applyConfirmedDimensionVoiceProposal(dimensions, "wallHeight", 3.6);
    expect(updated).not.toBe(dimensions);
    expect(updated[0]).toBe(dimensions[0]);
    expect(updated[1]).toMatchObject({
      key: "wallHeight",
      value: 3.6,
      source: "manual_professional_input",
      confidence: 100,
      reviewStatus: "MANUAL_ENTRY",
    });
    expect(dimensions[1].value).toBe(3.4);
  });

  it("keeps dimension voice confirmation local and preserves the existing calculation gates", () => {
    const panel = source("src/components/boq/quantity-calculation-panel.tsx");
    expect(panel).toContain("setDimensionValues(pendingVoiceProposal.proposedValues)");
    expect(panel).not.toContain("/voice/apply");
    // CANVA-HUMAN-JOURNEY-FINAL relabeled the buttons ("Yes — Use X unit")
    // but the underlying two-stage save-then-confirm governance gate is
    // unchanged — assert on the functions, not the exact button copy.
    expect(panel).toContain("void saveCalculation()");
    expect(panel).toContain("void confirmCalculation()");
    expect(source("src/components/voice/voice-proposal-card.tsx")).toContain("Affected calculation preview");
  });

  it("records transient audio with explicit cleanup and sends only transcribe then propose", () => {
    const button = source("src/components/voice/voice-command-button.tsx");
    expect(button).toContain("navigator.mediaDevices.getUserMedia");
    expect(button).toContain("new MediaRecorder");
    expect(button).toContain('formData.set("file"');
    expect(button).toContain("/voice/transcribe");
    expect(button).toContain("/voice/propose");
    expect(button).toContain("track.stop()");
    expect(button).toContain("abortControllerRef.current?.abort()");
    expect(button).not.toContain("/voice/apply");
    expect(button).not.toMatch(/localStorage|sessionStorage|createObjectURL/);
  });

  it("only enables BOQ voice on persisted rows and requires an explicit governed apply confirmation", () => {
    expect(isPersistedItemId("4d675343-6e22-4786-92e5-c68ab3d1a4c2")).toBe(true);
    expect(isPersistedItemId("section-item-1234")).toBe(false);
    expect(getVoiceBOQFieldLabel("quantity")).toBe("Quantity");
    expect(getVoiceBOQFieldLabel("notes")).toBe("Notes");
    expect(getVoiceBOQFieldLabel("item")).toBe("BOQ item");

    const editor = source("src/components/boq/boq-editor.tsx");
    expect(editor).toContain("isPersistedItemId(item.id)");
    expect(editor).toContain("hasUnsavedChanges");
    expect(editor).toContain("Save the draft before using voice");
    expect(editor).toContain("/voice/apply");
    expect(editor).toContain("{ confirmed: true, proposal: pendingVoiceProposal.proposal }");
    expect(editor).toContain("onVoiceApplied(updated)");
    expect(editor).toContain('context={{ type: "BOQ_SECTION", sectionId: section.id }}');
    expect(editor).toContain('"ADD_BOQ_ITEM"');
    expect(editor).toContain('"DELETE_BOQ_ITEM"');
    expect(editor).toContain("pendingVoiceProposal && firstSection");
    expect(editor).not.toContain(
      "pendingVoiceProposal?.sectionId === firstSection?.id && pendingVoiceProposal.proposal",
    );
  });

  it("keeps voice discoverable before it is safe to use", () => {
    const editor = source("src/components/boq/boq-editor.tsx");
    expect(editor).toContain("Voice can add a reviewed draft item to a BOQ section.");
    expect(editor).toContain("Save this BOQ item before using voice.");
    expect(editor).toContain("!isPersistedItemId(item.id)");
    expect(editor).not.toContain("\n                              compact\n");

    const addItemModal = source("src/components/boq/add-item-from-source-modal.tsx");
    expect(addItemModal).toContain(
      "Voice input appears inside the measurement panel after you select a supported calculation type.",
    );
  });

  it("renders explicit old-to-new values and advertises voice only as a supported input method", () => {
    expect(formatVoiceProposalValue(3.6, "m")).toBe("3.6 m");
    expect(formatVoiceProposalValue(null, "m")).toBe("Not set m");
    expect(FEATURE_HINT_REGISTRY.VOICE_GUIDANCE).toEqual({
      id: "VOICE_GUIDANCE",
      title: "Voice measurement input",
      description: "Use voice to enter or correct supported BOQ measurements.",
      availability: "AVAILABLE",
    });
    const serialized = JSON.stringify(FEATURE_HINT_REGISTRY.VOICE_GUIDANCE);
    expect(serialized).not.toMatch(/assistant|approval|locking|issuing/i);
  });
});
