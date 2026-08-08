import { UserRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { setActorContext } from "@/lib/auth/request-context";
import { getRequiredDimensions } from "@/lib/calculations/required-dimensions-registry";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors/app-error";
import { LockedBOQError } from "@/lib/domain/boq-guards";
import { createClient } from "@/lib/repositories/client-repository";
import { lockBOQ, updateBOQItem } from "@/lib/repositories/boq-repository";
import { runBOQVerification } from "@/lib/repositories/verification-repository";
import {
  applyVoiceBOQCommand,
  proposeVoiceCommand,
} from "@/lib/services/voice-boq-command-service";
import { createProjectWithDefaultBoq } from "@/lib/services/project-service";
import { OpenAITranscriptionProvider } from "@/lib/voice/openai-transcription-provider";
import {
  interpretVoiceCommand,
  interpretVoiceCommandDeterministically,
} from "@/lib/voice/voice-command-interpreter";
import {
  assertVoiceMultipartContentLength,
  MAX_VOICE_AUDIO_BYTES,
  MAX_VOICE_MULTIPART_BYTES,
  validateVoiceAudioFile,
  type TranscriptionProvider,
} from "@/lib/voice/transcription-provider";
import { transcribeProjectVoice } from "@/lib/voice/voice-transcription-service";
import {
  boqVoiceCommandProposalSchema,
  unsignedBoqVoiceCommandProposalSchema,
  voiceApplyRequestSchema,
} from "@/lib/voice/voice-types";
import {
  createVoiceProposalToken,
  deriveVoiceProposalSigningKey,
  verifyVoiceProposalToken,
} from "@/lib/voice/voice-proposal-token";
import { grantUnlimitedPlanForTests } from "./helpers/grant-unlimited-plan";

const RUN_ID = `${Date.now()}-${process.pid}`;
const TEST_PROPOSAL_SIGNING_KEY = "voice-test-session-derived-signing-key-00000001";
const TEST_PROPOSAL_BINDING = {
  actorUserId: "00000000-0000-4000-8000-000000000001",
  companyId: "00000000-0000-4000-8000-000000000002",
  projectId: "00000000-0000-4000-8000-000000000003",
};

function unsignedQuantityProposal() {
  return unsignedBoqVoiceCommandProposalSchema.parse({
    commandType: "SET_BOQ_QUANTITY",
    targetType: "BOQ_ITEM",
    targetId: "00000000-0000-4000-8000-000000000004",
    field: "quantity",
    oldValue: 12,
    newValue: 25,
    unit: "m2",
    transcript: "change this quantity to 25 square metres",
    humanSummary: "Change quantity from 12 m2 to 25 m2.",
    requiresConfirmation: true,
    warnings: [],
  });
}

describe("Release 1 voice audio and deterministic command parsing", () => {
  it("accepts the five supported extension/MIME pairs and rejects mismatches", () => {
    const supported = [
      ["voice.webm", "audio/webm"],
      ["voice.wav", "audio/wav"],
      ["voice.mp3", "audio/mpeg"],
      ["voice.m4a", "audio/mp4"],
      ["voice.ogg", "audio/ogg"],
    ] as const;
    for (const [name, type] of supported) {
      expect(validateVoiceAudioFile({ name, type, size: 100 }).mimeType).toBe(type);
    }
    expect(() => validateVoiceAudioFile({ name: "voice.exe", type: "audio/webm", size: 100 })).toThrowError(
      expect.objectContaining({ code: "VOICE_AUDIO_TYPE_UNSUPPORTED" }),
    );
    expect(() => validateVoiceAudioFile({ name: "voice.webm", type: "audio/mpeg", size: 100 })).toThrowError(
      expect.objectContaining({ code: "VOICE_AUDIO_TYPE_UNSUPPORTED" }),
    );
  });

  it("enforces the conservative 10MB audio limit before reading bytes", () => {
    expect(() => validateVoiceAudioFile({
      name: "voice.wav",
      type: "audio/wav",
      size: MAX_VOICE_AUDIO_BYTES + 1,
    })).toThrowError(expect.objectContaining({ code: "VOICE_AUDIO_TOO_LARGE", status: 413 }));
  });

  it("rejects oversized multipart Content-Length before body parsing while retaining the file limit", () => {
    expect(() => assertVoiceMultipartContentLength(String(MAX_VOICE_MULTIPART_BYTES))).not.toThrow();
    expect(() => assertVoiceMultipartContentLength(String(MAX_VOICE_MULTIPART_BYTES + 1))).toThrowError(
      expect.objectContaining({ code: "VOICE_AUDIO_TOO_LARGE", status: 413 }),
    );
    expect(() => assertVoiceMultipartContentLength("not-a-number")).toThrowError(
      expect.objectContaining({ code: "INVALID_CONTENT_LENGTH", status: 400 }),
    );
    expect(() => assertVoiceMultipartContentLength(null)).toThrowError(
      expect.objectContaining({ code: "CONTENT_LENGTH_REQUIRED", status: 411 }),
    );
  });

  it("binds a signed proposal to its canonical payload and rejects tampering", () => {
    const unsigned = unsignedQuantityProposal();
    const proposalToken = createVoiceProposalToken(unsigned, TEST_PROPOSAL_BINDING, {
      signingKey: TEST_PROPOSAL_SIGNING_KEY,
      nowMs: 1_000,
      ttlMs: 5_000,
    });
    const signed = boqVoiceCommandProposalSchema.parse({ ...unsigned, proposalToken });
    if (signed.commandType !== "SET_BOQ_QUANTITY") throw new Error("Expected a quantity proposal.");
    expect(() => verifyVoiceProposalToken(signed, TEST_PROPOSAL_BINDING, {
      signingKey: TEST_PROPOSAL_SIGNING_KEY,
      nowMs: 2_000,
    })).not.toThrow();
    expect(() => verifyVoiceProposalToken({ ...signed, newValue: 999 }, TEST_PROPOSAL_BINDING, {
      signingKey: TEST_PROPOSAL_SIGNING_KEY,
      nowMs: 2_000,
    })).toThrowError(expect.objectContaining({ code: "VOICE_PROPOSAL_INVALID" }));
  });

  it("binds proposal tokens to the actor, company, canonical project, and active session", () => {
    const unsigned = unsignedQuantityProposal();
    const sessionKey = deriveVoiceProposalSigningKey("test-session-token-a");
    const signed = boqVoiceCommandProposalSchema.parse({
      ...unsigned,
      proposalToken: createVoiceProposalToken(unsigned, TEST_PROPOSAL_BINDING, {
        signingKey: sessionKey,
        nowMs: 1_000,
        ttlMs: 5_000,
      }),
    });
    if (signed.commandType !== "SET_BOQ_QUANTITY") throw new Error("Expected a quantity proposal.");
    const invalidBindings = [
      { ...TEST_PROPOSAL_BINDING, actorUserId: "00000000-0000-4000-8000-000000000011" },
      { ...TEST_PROPOSAL_BINDING, companyId: "00000000-0000-4000-8000-000000000012" },
      { ...TEST_PROPOSAL_BINDING, projectId: "00000000-0000-4000-8000-000000000013" },
    ];
    for (const binding of invalidBindings) {
      expect(() => verifyVoiceProposalToken(signed, binding, {
        signingKey: sessionKey,
        nowMs: 2_000,
      })).toThrowError(expect.objectContaining({ code: "VOICE_PROPOSAL_INVALID" }));
    }
    expect(() => verifyVoiceProposalToken(signed, TEST_PROPOSAL_BINDING, {
      signingKey: deriveVoiceProposalSigningKey("test-session-token-b"),
      nowMs: 2_000,
    })).toThrowError(expect.objectContaining({ code: "VOICE_PROPOSAL_INVALID" }));
  });

  it("expires signed proposals and requires the quantity unit in apply requests", () => {
    const unsigned = unsignedQuantityProposal();
    const signed = boqVoiceCommandProposalSchema.parse({
      ...unsigned,
      proposalToken: createVoiceProposalToken(unsigned, TEST_PROPOSAL_BINDING, {
        signingKey: TEST_PROPOSAL_SIGNING_KEY,
        nowMs: 1_000,
        ttlMs: 500,
      }),
    });
    if (signed.commandType !== "SET_BOQ_QUANTITY") throw new Error("Expected a quantity proposal.");
    expect(() => verifyVoiceProposalToken(signed, TEST_PROPOSAL_BINDING, {
      signingKey: TEST_PROPOSAL_SIGNING_KEY,
      nowMs: 1_500,
    })).toThrowError(expect.objectContaining({ code: "VOICE_PROPOSAL_EXPIRED", status: 409 }));
    const { unit: _unit, ...withoutUnit } = signed;
    expect(voiceApplyRequestSchema.safeParse({ confirmed: true, proposal: withoutUnit }).success).toBe(false);
  });

  it("returns a controlled configuration error without an OpenAI key", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const provider = new OpenAITranscriptionProvider({ apiKey: "", fetchImpl });
    await expect(provider.transcribe({
      bytes: new Uint8Array([1, 2, 3]).buffer,
      fileName: "voice.wav",
      mimeType: "audio/wav",
    })).rejects.toMatchObject({ code: "VOICE_TRANSCRIPTION_NOT_CONFIGURED", status: 503 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("uses native multipart fetch and returns no provider secret", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ text: "change wall height to 3.6 metres" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const provider = new OpenAITranscriptionProvider({
      apiKey: "test-secret-key",
      model: "gpt-4o-mini-transcribe",
      fetchImpl,
    });
    const result = await provider.transcribe({
      bytes: new Uint8Array([1, 2, 3]).buffer,
      fileName: "voice.webm",
      mimeType: "audio/webm",
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0][0]).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect(fetchImpl.mock.calls[0][1]?.body).toBeInstanceOf(FormData);
    expect(result).toEqual({
      transcript: "change wall height to 3.6 metres",
      provider: "openai",
      model: "gpt-4o-mini-transcribe",
    });
    expect(JSON.stringify(result)).not.toContain("test-secret-key");
  });

  it("parses wall height and wastage against the canonical dimension registry", async () => {
    const wall = getRequiredDimensions("WALL_AREA")!;
    await expect(interpretVoiceCommand("change wall height to 3.6 metres", {
      type: "DIMENSION_CALCULATION",
      dimensions: wall.inputs,
    })).resolves.toMatchObject({
      commandType: "SET_DIMENSION",
      dimensionKey: "wallHeight",
      newValue: 3.6,
      unit: "m",
    });
    await expect(interpretVoiceCommand("set wastage to 5 percent", {
      type: "DIMENSION_CALCULATION",
      dimensions: wall.inputs,
    })).resolves.toMatchObject({
      commandType: "SET_DIMENSION",
      dimensionKey: "wastagePercentage",
      newValue: 5,
      unit: "%",
    });
  });

  it("parses supported BOQ quantity and description commands", async () => {
    await expect(interpretVoiceCommand("change this quantity to 25 square metres", { type: "BOQ_ITEM" })).resolves.toMatchObject({
      commandType: "SET_BOQ_QUANTITY",
      field: "quantity",
      newValue: 25,
      unit: "m2",
    });
    await expect(interpretVoiceCommand("change description to acoustic gypsum partition", { type: "BOQ_ITEM" })).resolves.toMatchObject({
      commandType: "SET_BOQ_DESCRIPTION",
      field: "description",
      newValue: "acoustic gypsum partition",
    });
  });

  it("does not guess ambiguous instructions or advertise unsupported execution", async () => {
    const dimensions = getRequiredDimensions("WALL_AREA")!.inputs;
    await expect(interpretVoiceCommand("change it to 3.6", {
      type: "DIMENSION_CALCULATION",
      dimensions,
    })).rejects.toMatchObject({ code: "VOICE_COMMAND_AMBIGUOUS" });
    await expect(interpretVoiceCommand("lock this BOQ", { type: "BOQ_ITEM" })).rejects.toMatchObject({
      code: "VOICE_COMMAND_NOT_SUPPORTED",
    });
    expect(interpretVoiceCommandDeterministically("lock this BOQ", { type: "BOQ_ITEM" }).status).toBe("unsupported");
  });

  it("requires an explicit confirmed BOQ proposal for the apply contract", () => {
    expect(voiceApplyRequestSchema.safeParse({ confirmed: false, proposal: {} }).success).toBe(false);
    expect(voiceApplyRequestSchema.safeParse({
      confirmed: true,
      proposal: {
        commandType: "SET_DIMENSION",
        targetType: "DIMENSION",
        field: "value",
        dimensionKey: "wallHeight",
        oldValue: 3.4,
        newValue: 3.6,
        transcript: "change wall height to 3.6 metres",
        humanSummary: "Change Wall Height.",
        requiresConfirmation: true,
        warnings: [],
      },
    }).success).toBe(false);
  });
});

describe("Release 1 voice proposal/apply integration (real local Postgres)", () => {
  let companyAId: string;
  let companyBId: string;
  let userAId: string;
  let userBId: string;
  let projectAId: string;
  let projectASlug: string;
  let projectBId: string;
  let projectBSlug: string;
  let boqAId: string;
  let itemAId: string;
  let lockProjectId: string;
  let lockItemId: string;

  const actorA = (): CurrentActor => ({
    userId: userAId,
    companyId: companyAId,
    role: UserRole.COMPANY_OWNER,
    fullName: "Voice Owner A",
    email: `voice-owner-a-${RUN_ID}@example.com`,
  });
  const actorB = (): CurrentActor => ({
    userId: userBId,
    companyId: companyBId,
    role: UserRole.COMPANY_OWNER,
    fullName: "Voice Owner B",
    email: `voice-owner-b-${RUN_ID}@example.com`,
  });

  beforeAll(async () => {
    const [companyA, companyB] = await Promise.all([
      prisma.company.create({ data: { legalName: `Voice Co A ${RUN_ID}`, tradeName: "Voice Co A", email: `voice-a-${RUN_ID}@example.com` } }),
      prisma.company.create({ data: { legalName: `Voice Co B ${RUN_ID}`, tradeName: "Voice Co B", email: `voice-b-${RUN_ID}@example.com` } }),
    ]);
    companyAId = companyA.id;
    companyBId = companyB.id;
    await Promise.all([grantUnlimitedPlanForTests(companyAId), grantUnlimitedPlanForTests(companyBId)]);
    const construction = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
    await prisma.companyIndustryEngine.createMany({
      data: [
        { companyId: companyAId, industryEngineId: construction.id, enabled: true },
        { companyId: companyBId, industryEngineId: construction.id, enabled: true },
      ],
    });
    const [userA, userB] = await Promise.all([
      prisma.user.create({ data: { companyId: companyAId, email: `voice-owner-a-${RUN_ID}@example.com`, passwordHash: "test-only", fullName: "Voice Owner A", role: UserRole.COMPANY_OWNER, isActive: true, emailVerifiedAt: new Date() } }),
      prisma.user.create({ data: { companyId: companyBId, email: `voice-owner-b-${RUN_ID}@example.com`, passwordHash: "test-only", fullName: "Voice Owner B", role: UserRole.COMPANY_OWNER, isActive: true, emailVerifiedAt: new Date() } }),
    ]);
    userAId = userA.id;
    userBId = userB.id;
    const [clientA, clientB] = await Promise.all([
      createClient(companyAId, { name: "Voice Client A", email: `voice-client-a-${RUN_ID}@example.com` }),
      createClient(companyBId, { name: "Voice Client B", email: `voice-client-b-${RUN_ID}@example.com` }),
    ]);
    const [createdA, createdB] = await Promise.all([
      createProjectWithDefaultBoq(actorA(), {
        clientId: clientA.id,
        industryEngineId: "construction",
        reference: `VOICE-A-${RUN_ID}`,
        name: "Voice Project A",
        location: "Dubai",
        currency: "AED",
        taxRate: "5",
        language: "English",
      }),
      createProjectWithDefaultBoq(actorB(), {
        clientId: clientB.id,
        industryEngineId: "construction",
        reference: `VOICE-B-${RUN_ID}`,
        name: "Voice Project B",
        location: "Dubai",
        currency: "AED",
        taxRate: "5",
        language: "English",
      }),
    ]);
    projectAId = createdA.project.databaseId;
    projectASlug = createdA.project.id;
    projectBId = createdB.project.databaseId;
    projectBSlug = createdB.project.id;
    boqAId = createdA.boq.databaseId;
    const item = await prisma.bOQItem.create({
      data: {
        companyId: companyAId,
        sectionId: createdA.boq.sections[0].id,
        itemNumber: 1,
        itemCode: `VOICE-ITEM-${RUN_ID}`,
        category: "Partitions",
        description: "Standard gypsum partition",
        quantity: 12,
        unit: "m2",
        unitCost: 10,
        marginPercentage: 10,
        landedCost: 10,
        sellingRate: 11,
        totalAmount: 132,
        notes: "Initial note",
        sortOrder: 1,
      },
    });
    itemAId = item.id;

    const lockClient = await createClient(companyAId, { name: "Voice Lock Client", email: `voice-lock-client-${RUN_ID}@example.com` });
    const lockedProject = await createProjectWithDefaultBoq(actorA(), {
      clientId: lockClient.id,
      industryEngineId: "construction",
      reference: `VOICE-LOCK-${RUN_ID}`,
      name: "Voice Locked Project",
      location: "Dubai",
      currency: "AED",
      taxRate: "5",
      language: "English",
    });
    lockProjectId = lockedProject.project.databaseId;
    const lockItem = await prisma.bOQItem.create({
      data: {
        companyId: companyAId,
        sectionId: lockedProject.boq.sections[0].id,
        itemNumber: 1,
        itemCode: `VOICE-LOCK-ITEM-${RUN_ID}`,
        category: "General",
        description: "Locked item",
        quantity: 5,
        unit: "m2",
        unitCost: 10,
        marginPercentage: 10,
        landedCost: 10,
        sellingRate: 11,
        totalAmount: 55,
        sortOrder: 1,
      },
    });
    lockItemId = lockItem.id;
    await runBOQVerification(companyAId, lockedProject.boq.databaseId);
    await lockBOQ(companyAId, lockedProject.boq.databaseId, actorA().fullName, userAId);
  });

  afterAll(async () => {
    if (!companyAId || !companyBId) {
      await prisma.$disconnect();
      return;
    }
    await prisma.auditLog.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.verificationException.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.bOQRevisionSnapshot.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.bOQItemOption.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.bOQItem.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.bOQSection.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.bOQ.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.project.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.client.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.companyIndustryEngine.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.companySoftwareSubscription.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.user.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await prisma.company.deleteMany({ where: { id: { in: [companyAId, companyBId] } } });
    await prisma.$disconnect();
  });

  it("resolves the project tenant before transcription and never persists raw audio", async () => {
    const provider: TranscriptionProvider = {
      transcribe: vi.fn().mockResolvedValue({ transcript: "set quantity to 20", provider: "openai", model: "test-model" }),
    };
    const beforeFiles = await prisma.projectFile.count({ where: { companyId: companyAId } });
    const beforeAudits = await prisma.auditLog.count({ where: { companyId: companyAId } });
    const result = await transcribeProjectVoice(
      actorA(),
      projectASlug,
      new File([new Uint8Array([1, 2, 3])], "voice.wav", { type: "audio/wav" }),
      provider,
    );
    expect(result.transcript).toBe("set quantity to 20");
    expect(await prisma.projectFile.count({ where: { companyId: companyAId } })).toBe(beforeFiles);
    expect(await prisma.auditLog.count({ where: { companyId: companyAId } })).toBe(beforeAudits);
    await expect(transcribeProjectVoice(
      actorB(),
      projectAId,
      new File([new Uint8Array([1])], "voice.wav", { type: "audio/wav" }),
      provider,
    )).rejects.toThrow(NotFoundError);
  });

  it("builds canonical dimension proposals without persisting a calculation or audit", async () => {
    const beforeCalculations = await prisma.quantityCalculation.count({ where: { companyId: companyAId } });
    const beforeAudits = await prisma.auditLog.count({ where: { companyId: companyAId } });
    const proposal = await proposeVoiceCommand(actorA(), projectASlug, "change wall height to 3.6 metres", {
      type: "DIMENSION_CALCULATION",
      calculationType: "WALL_AREA",
      dimensionValues: [
        { key: "wallLength", label: "Untrusted label", unit: "m", required: true, value: 10, source: "manual_professional_input", confidence: 100, reviewStatus: "MANUAL_ENTRY" },
        { key: "wallHeight", label: "Untrusted label", unit: "m", required: true, value: 3.4, source: "manual_professional_input", confidence: 100, reviewStatus: "MANUAL_ENTRY" },
      ],
    });
    expect(proposal).toMatchObject({
      commandType: "SET_DIMENSION",
      dimensionKey: "wallHeight",
      oldValue: 3.4,
      newValue: 3.6,
      requiresConfirmation: true,
    });
    expect(proposal.humanSummary).toContain("Wall Height");
    expect(await prisma.quantityCalculation.count({ where: { companyId: companyAId } })).toBe(beforeCalculations);
    expect(await prisma.auditLog.count({ where: { companyId: companyAId } })).toBe(beforeAudits);
  });

  it("returns tenant-safe current BOQ values and proposal performs zero mutation", async () => {
    const before = await prisma.bOQItem.findUniqueOrThrow({ where: { id: itemAId } });
    const proposal = await proposeVoiceCommand(actorA(), projectAId, "change this quantity to 25 square metres", {
      type: "BOQ_ITEM",
      itemId: itemAId,
    }, { proposalSigningKey: TEST_PROPOSAL_SIGNING_KEY });
    expect(proposal).toMatchObject({ oldValue: 12, newValue: 25, unit: "m2", requiresConfirmation: true });
    const after = await prisma.bOQItem.findUniqueOrThrow({ where: { id: itemAId } });
    expect(after.quantity.equals(before.quantity)).toBe(true);

    await expect(proposeVoiceCommand(actorB(), projectBSlug, "change this quantity to 99 square metres", {
      type: "BOQ_ITEM",
      itemId: itemAId,
    }, { proposalSigningKey: TEST_PROPOSAL_SIGNING_KEY })).rejects.toThrow(NotFoundError);
  });

  it("applies only the confirmed field through the safe BOQ updater and writes an atomic voice audit without raw audio", async () => {
    const proposal = await proposeVoiceCommand(actorA(), projectAId, "change this quantity to 25 square metres", {
      type: "BOQ_ITEM",
      itemId: itemAId,
    }, { proposalSigningKey: TEST_PROPOSAL_SIGNING_KEY });
    if (proposal.commandType !== "SET_BOQ_QUANTITY") throw new Error("Expected a quantity proposal.");
    setActorContext(actorA());
    const updated = await applyVoiceBOQCommand(
      actorA(),
      projectAId,
      { confirmed: true, proposal },
      { proposalSigningKey: TEST_PROPOSAL_SIGNING_KEY },
    );
    const stored = await prisma.bOQItem.findUniqueOrThrow({ where: { id: itemAId } });
    expect(stored.quantity.toNumber()).toBe(25);
    expect(updated.id).toBe(boqAId);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { companyId: companyAId, entityId: itemAId, action: "VOICE_BOQ_CHANGE_APPLIED" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit.userId).toBe(userAId);
    expect(audit.payloadJson).toMatchObject({
      transcript: "change this quantity to 25 square metres",
      field: "quantity",
      oldValue: 12,
      newValue: 25,
      actorUserId: userAId,
    });
    expect(JSON.stringify(audit.payloadJson)).not.toMatch(/audio|base64|bytes/i);
  });

  it("rejects a tampered client proposal before any BOQ mutation or voice audit", async () => {
    const proposal = await proposeVoiceCommand(actorA(), projectAId, "change this quantity to 27 square metres", {
      type: "BOQ_ITEM",
      itemId: itemAId,
    }, { proposalSigningKey: TEST_PROPOSAL_SIGNING_KEY });
    if (proposal.commandType !== "SET_BOQ_QUANTITY") throw new Error("Expected a quantity proposal.");
    const beforeAudits = await prisma.auditLog.count({
      where: { companyId: companyAId, entityId: itemAId, action: "VOICE_BOQ_CHANGE_APPLIED" },
    });
    await expect(applyVoiceBOQCommand(
      actorA(),
      projectAId,
      { confirmed: true, proposal: { ...proposal, newValue: 999 } },
      { proposalSigningKey: TEST_PROPOSAL_SIGNING_KEY },
    )).rejects.toMatchObject({ code: "VOICE_PROPOSAL_INVALID" });
    expect((await prisma.bOQItem.findUniqueOrThrow({ where: { id: itemAId } })).quantity.toNumber()).toBe(25);
    expect(await prisma.auditLog.count({
      where: { companyId: companyAId, entityId: itemAId, action: "VOICE_BOQ_CHANGE_APPLIED" },
    })).toBe(beforeAudits);
  });

  it("always stale-checks the signed quantity unit before applying", async () => {
    const proposal = await proposeVoiceCommand(actorA(), projectAId, "change this quantity to 30 square metres", {
      type: "BOQ_ITEM",
      itemId: itemAId,
    }, { proposalSigningKey: TEST_PROPOSAL_SIGNING_KEY });
    if (proposal.commandType !== "SET_BOQ_QUANTITY") throw new Error("Expected a quantity proposal.");
    await updateBOQItem(companyAId, itemAId, { unit: "m3" });
    await expect(applyVoiceBOQCommand(
      actorA(),
      projectAId,
      { confirmed: true, proposal },
      { proposalSigningKey: TEST_PROPOSAL_SIGNING_KEY },
    )).rejects.toMatchObject({ code: "VOICE_PROPOSAL_STALE" });
    const stored = await prisma.bOQItem.findUniqueOrThrow({ where: { id: itemAId } });
    expect(stored.quantity.toNumber()).toBe(25);
    expect(stored.unit).toBe("m3");
  });

  it("rejects a stale old-to-new proposal inside updateBOQItem's fresh field guard", async () => {
    const proposal = await proposeVoiceCommand(actorA(), projectAId, "change description to acoustic gypsum partition", {
      type: "BOQ_ITEM",
      itemId: itemAId,
    }, { proposalSigningKey: TEST_PROPOSAL_SIGNING_KEY });
    if (proposal.commandType !== "SET_BOQ_DESCRIPTION") throw new Error("Expected a description proposal.");
    await updateBOQItem(companyAId, itemAId, { description: "Changed by another editor" });
    await expect(applyVoiceBOQCommand(
      actorA(),
      projectAId,
      { confirmed: true, proposal },
      { proposalSigningKey: TEST_PROPOSAL_SIGNING_KEY },
    )).rejects.toMatchObject({
      code: "VOICE_PROPOSAL_STALE",
    });
    expect((await prisma.bOQItem.findUniqueOrThrow({ where: { id: itemAId } })).description).toBe("Changed by another editor");
  });

  it("allows read-only proposal on a locked BOQ but rejects the confirmed persisted change", async () => {
    const proposal = await proposeVoiceCommand(actorA(), lockProjectId, "change notes to verified by voice", {
      type: "BOQ_ITEM",
      itemId: lockItemId,
    }, { proposalSigningKey: TEST_PROPOSAL_SIGNING_KEY });
    if (proposal.commandType !== "SET_BOQ_NOTES") throw new Error("Expected a notes proposal.");
    await expect(applyVoiceBOQCommand(
      actorA(),
      lockProjectId,
      { confirmed: true, proposal },
      { proposalSigningKey: TEST_PROPOSAL_SIGNING_KEY },
    )).rejects.toThrow(LockedBOQError);
    expect((await prisma.bOQItem.findUniqueOrThrow({ where: { id: lockItemId } })).notes).toBe("");
  });
});
