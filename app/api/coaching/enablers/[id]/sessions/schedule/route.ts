import { NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { scheduleSessionsInOutlook } from "@/lib/coaching";
import { ok, serverError } from "@/lib/http";
import { coachingScheduleSchema } from "@/lib/schemas";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const params = await context.params;
    const payload = coachingScheduleSchema.parse(await request.json().catch(() => ({})));

    const sessions = await scheduleSessionsInOutlook({
      userId: user.id,
      strategicEnablerId: params.id,
      sessionIds: payload.sessionIds
    });

    return ok({ sessions });
  } catch (error) {
    return serverError(error);
  }
}
