import { PlatformRole, type SimulationMode } from "@prisma/client";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { exitSimulation, getSimulationStatus, startOrChangeSimulation } from "@/lib/services/platform-simulation-service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const SIMULATION_MODES = ["TRIAL_ACTIVE", "TRIAL_EXPIRED", "FREE", "PRO", "SINGLE_BOQ_UNLOCKED"] as const;
const startSimulationSchema = z.object({
  mode: z.enum(SIMULATION_MODES),
  targetBoqId: z.string().uuid().optional(),
});

export async function GET() {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    return apiSuccess(await getSimulationStatus(actor));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const body = await request.json();
    const { mode, targetBoqId } = startSimulationSchema.parse(body);
    const session = await startOrChangeSimulation(actor, mode as SimulationMode, targetBoqId);
    return apiSuccess(session);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE() {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    await exitSimulation(actor);
    return apiSuccess({ exited: true });
  } catch (error) {
    return handleApiError(error);
  }
}
