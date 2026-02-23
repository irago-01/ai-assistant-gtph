import { CoachingCadence } from "@prisma/client";
import { NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { generateCoachingSessions } from "@/lib/coaching";
import { ok, serverError } from "@/lib/http";
import { coachingSessionGenerateSchema } from "@/lib/schemas";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const params = await context.params;
    const payload = coachingSessionGenerateSchema.parse(
      await request.json().catch(() => ({}))
    );

    const sessions = await generateCoachingSessions({
      userId: user.id,
      strategicEnablerId: params.id,
      count: payload.count,
      cadence: payload.cadence ? (payload.cadence as CoachingCadence) : undefined,
      durationMinutes: payload.durationMinutes,
      startDate: payload.startDate
    });

    return ok({ sessions }, 201);
  } catch (error) {
    return serverError(error);
  }
}
