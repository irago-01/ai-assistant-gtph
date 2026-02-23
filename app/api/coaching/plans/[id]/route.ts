import { NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { ok, serverError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { coachingPlanUpdateSchema } from "@/lib/schemas";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const params = await context.params;
    const payload = coachingPlanUpdateSchema.parse(await request.json());

    const existing = await prisma.coachingPlan.findFirst({
      where: {
        id: params.id,
        userId: user.id
      }
    });

    if (!existing) {
      throw new Error("Coaching plan not found");
    }

    const plan = await prisma.coachingPlan.update({
      where: {
        id: existing.id
      },
      data: payload
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "coaching.plan.updated",
        entityType: "coaching_plan",
        entityId: plan.id,
        metadata: {
          strategicEnablerId: plan.strategicEnablerId
        }
      }
    });

    return ok({ plan });
  } catch (error) {
    return serverError(error);
  }
}
