import { NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getOrCreateCoachingSettings, recalculateOverallFromScores } from "@/lib/coaching";
import { ok, serverError } from "@/lib/http";
import { coachingAssessmentSchema } from "@/lib/schemas";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const payload = coachingAssessmentSchema.parse(await request.json());
    const settings = await getOrCreateCoachingSettings(user.id);

    const overallScore = recalculateOverallFromScores({
      settings,
      scores: {
        promptingFundamentals: payload.promptingFundamentals,
        workflowAutomation: payload.workflowAutomation,
        toolSelectionEvaluation: payload.toolSelectionEvaluation,
        dataKnowledgeRetrieval: payload.dataKnowledgeRetrieval,
        responsibleAiRiskAwareness: payload.responsibleAiRiskAwareness,
        deliveryImplementation: payload.deliveryImplementation
      }
    });

    return ok({ overallScore });
  } catch (error) {
    return serverError(error);
  }
}
