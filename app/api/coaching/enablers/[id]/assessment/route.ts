import { NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { createProficiencyAssessment } from "@/lib/coaching";
import { ok, serverError } from "@/lib/http";
import { coachingAssessmentSchema } from "@/lib/schemas";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const params = await context.params;
    const payload = coachingAssessmentSchema.parse(await request.json());

    const assessment = await createProficiencyAssessment({
      userId: user.id,
      strategicEnablerId: params.id,
      assessmentDate: payload.assessmentDate,
      assessor: payload.assessor,
      scores: {
        promptingFundamentals: payload.promptingFundamentals,
        workflowAutomation: payload.workflowAutomation,
        toolSelectionEvaluation: payload.toolSelectionEvaluation,
        dataKnowledgeRetrieval: payload.dataKnowledgeRetrieval,
        responsibleAiRiskAwareness: payload.responsibleAiRiskAwareness,
        deliveryImplementation: payload.deliveryImplementation
      },
      evidenceLinks: payload.evidenceLinks,
      strengths: payload.strengths,
      gaps: payload.gaps
    });

    return ok({ assessment }, 201);
  } catch (error) {
    return serverError(error);
  }
}
