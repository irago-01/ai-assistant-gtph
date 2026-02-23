import { EventType, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function logAnalytics(
  userId: string,
  eventType: EventType,
  numericValue: number,
  metadata?: Record<string, unknown>
) {
  await prisma.analyticsEvent.create({
    data: {
      userId,
      eventType,
      numericValue,
      metadata: metadata as Prisma.InputJsonValue | undefined
    }
  });
}

export async function getAnalyticsSummary(userId: string) {
  const events = await prisma.analyticsEvent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  let timeSaved = 0;
  let postsScheduled = 0;

  for (const event of events) {
    if (event.eventType === "TIME_SAVED") timeSaved += event.numericValue;
    if (event.eventType === "POST_SCHEDULED") postsScheduled += event.numericValue;
  }

  // Get count from latest board instead of cumulative sum
  const latestBoard = await prisma.taskBoard.findFirst({
    where: { userId },
    orderBy: { generatedAt: "desc" },
    include: { tasks: true }
  });

  const tasksGenerated = latestBoard?.tasks.length || 0;

  return {
    timeSavedMinutes: Math.round(timeSaved),
    tasksGenerated,
    postsScheduled: Math.round(postsScheduled)
  };
}
