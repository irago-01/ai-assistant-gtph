import { NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { generateCoachingPlan } from "@/lib/coaching";
import { ok, serverError } from "@/lib/http";
import { coachingPlanGenerateSchema } from "@/lib/schemas";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const params = await context.params;
    const payload = coachingPlanGenerateSchema.parse(await request.json().catch(() => ({})));

    const plan = await generateCoachingPlan({
      userId: user.id,
      strategicEnablerId: params.id,
      targetOverallScore: payload.targetOverallScore,
      focusDimensions: payload.focusDimensions
    });

    return ok({ plan }, 201);
  } catch (error) {
    return serverError(error);
  }
}
