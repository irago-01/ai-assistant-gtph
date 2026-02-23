import { EventType } from "@prisma/client";
import { NextRequest } from "next/server";

import { logAnalytics } from "@/lib/analytics";
import { getCurrentUser } from "@/lib/auth";
import { ok, serverError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { enqueueSlackPost } from "@/lib/queue";
import { slackScheduleSchema } from "@/lib/schemas";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const payload = await request.json();
    const parsed = slackScheduleSchema.parse(payload);

    const draft = await prisma.slackDraft.findFirst({
      where: {
        id: parsed.draftId,
        userId: user.id
      }
    });

    if (!draft) {
      throw new Error("Draft not found");
    }

    const scheduledFor = new Date(parsed.scheduledFor);
    const queueJobId = await enqueueSlackPost({
      draftId: draft.id,
      userId: user.id,
      channels: parsed.channels,
      message: draft.content,
      scheduledFor
    });

    const updated = await prisma.slackDraft.update({
      where: {
        id: draft.id
      },
      data: {
        channels: parsed.channels,
        scheduledFor,
        recurrence: parsed.recurrence,
        approvalRequired: parsed.approvalRequired,
        status: parsed.approvalRequired ? "NEEDS_APPROVAL" : "SCHEDULED",
        queueJobId
      }
    });

    await logAnalytics(user.id, EventType.POST_SCHEDULED, 1, {
      draftId: draft.id
    });

    return ok({ draft: updated });
  } catch (error) {
    return serverError(error);
  }
}
