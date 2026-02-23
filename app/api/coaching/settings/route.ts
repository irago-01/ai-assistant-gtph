import { CoachingCadence, Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getOrCreateCoachingSettings, updateCoachingSettings } from "@/lib/coaching";
import { ok, serverError } from "@/lib/http";
import { coachingSettingsSchema } from "@/lib/schemas";

export async function GET() {
  try {
    const user = await getCurrentUser();
    const settings = await getOrCreateCoachingSettings(user.id);
    return ok({ settings });
  } catch (error) {
    return serverError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const payload = coachingSettingsSchema.parse(await request.json());

    const settings = await updateCoachingSettings(user.id, {
      rubricJson: payload.rubricJson as Prisma.InputJsonValue,
      promptingFundamentalsWeight: payload.promptingFundamentalsWeight,
      workflowAutomationWeight: payload.workflowAutomationWeight,
      toolSelectionEvaluationWeight: payload.toolSelectionEvaluationWeight,
      dataKnowledgeRetrievalWeight: payload.dataKnowledgeRetrievalWeight,
      responsibleAiRiskAwarenessWeight: payload.responsibleAiRiskAwarenessWeight,
      deliveryImplementationWeight: payload.deliveryImplementationWeight,
      cadenceDefault: payload.cadenceDefault as CoachingCadence,
      sessionDurationDefault: payload.sessionDurationDefault,
      reminderHoursBefore: payload.reminderHoursBefore,
      defaultAgendaTemplates: payload.defaultAgendaTemplates,
      autoConfluenceLog: payload.autoConfluenceLog,
      autoCreateHomeworkJira: payload.autoCreateHomeworkJira
    });

    return ok({ settings });
  } catch (error) {
    return serverError(error);
  }
}
