import { NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { completeCoachingSession } from "@/lib/coaching";
import { ok, serverError } from "@/lib/http";
import { coachingSessionCompleteSchema } from "@/lib/schemas";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const params = await context.params;
    const payload = coachingSessionCompleteSchema.parse(await request.json().catch(() => ({})));

    const session = await completeCoachingSession({
      userId: user.id,
      sessionId: params.id,
      outcomeNotes: payload.outcomeNotes,
      nextSteps: payload.nextSteps,
      homeworkAssigned: payload.homeworkAssigned,
      autoCreateJiraHomework: payload.autoCreateJiraHomework
    });

    return ok({ session });
  } catch (error) {
    return serverError(error);
  }
}
