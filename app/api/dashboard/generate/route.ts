import { ActivitySource, EventType } from "@prisma/client";
import { NextRequest } from "next/server";

import { logAnalytics } from "@/lib/analytics";
import { getCurrentUser } from "@/lib/auth";
import { ok, serverError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { buildTaskBoard } from "@/lib/prioritization";
import { generateBoardSchema } from "@/lib/schemas";
import { syncRecentSignals } from "@/lib/activity-sync";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const payload = await request.json().catch(() => ({}));
    const parsed = generateBoardSchema.parse(payload);
    const settings = user.settings;

    if (!settings) {
      throw new Error("User settings missing");
    }

    const activities = await syncRecentSignals(user, settings, parsed.windowHours);
    const slackOnlyActivities = activities.filter(
      (activity) => activity.source === ActivitySource.SLACK && (activity.isMention || activity.isDm)
    );
    const candidateTasks = buildTaskBoard(user, settings, slackOnlyActivities);
    const limited = candidateTasks.slice(0, settings.taskMax);

    const board = await prisma.taskBoard.create({
      data: {
        userId: user.id,
        windowStart: new Date(Date.now() - parsed.windowHours * 60 * 60 * 1000),
        windowEnd: new Date(),
        totalTasks: limited.length,
        tasks: {
          create: limited.map((task) => ({
            userId: user.id,
            title: task.title,
            source: task.source,
            effortMinutes: task.effortMinutes,
            dueAt: task.dueAt,
            column: task.column,
            link: task.link,
            confidence: task.confidence,
            why: task.why
          }))
        }
      },
      include: {
        tasks: {
          orderBy: {
            confidence: "desc"
          }
        }
      }
    });

    await logAnalytics(user.id, EventType.TASKS_GENERATED, board.tasks.length, {
      boardId: board.id
    });

    await logAnalytics(
      user.id,
      EventType.TIME_SAVED,
      Math.round(board.tasks.reduce((acc, task) => acc + task.effortMinutes, 0) * 0.3),
      {
        boardId: board.id
      }
    );

    return ok({ board });
  } catch (error) {
    return serverError(error);
  }
}
