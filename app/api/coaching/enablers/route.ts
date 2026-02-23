import { NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { createStrategicEnabler, listStrategicEnablers } from "@/lib/coaching";
import { ok, serverError } from "@/lib/http";
import { strategicEnablerCreateSchema } from "@/lib/schemas";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const { searchParams } = request.nextUrl;

    const team = searchParams.get("team") ?? undefined;
    const scoreMin = searchParams.get("scoreMin");
    const scoreMax = searchParams.get("scoreMax");
    const needsPlan = searchParams.get("needsPlan");
    const overdueAssessment = searchParams.get("overdueAssessment");

    const parsedMin = scoreMin ? Number(scoreMin) : undefined;
    const parsedMax = scoreMax ? Number(scoreMax) : undefined;

    const rows = await listStrategicEnablers(user.id, {
      team,
      scoreMin: typeof parsedMin === "number" && !Number.isNaN(parsedMin) ? parsedMin : undefined,
      scoreMax: typeof parsedMax === "number" && !Number.isNaN(parsedMax) ? parsedMax : undefined,
      needsPlan: needsPlan === "true",
      overdueAssessment: overdueAssessment === "true"
    });

    return ok({ enablers: rows });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const payload = strategicEnablerCreateSchema.parse(await request.json());

    const enabler = await createStrategicEnabler({
      userId: user.id,
      ...payload
    });

    return ok({ enabler }, 201);
  } catch (error) {
    return serverError(error);
  }
}
