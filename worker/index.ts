import { queueJobs, getQueue, registerPeriodicSync } from "../lib/queue";
import { prisma } from "../lib/prisma";
import { runPostSessionAutomation } from "../lib/coaching";

async function bootstrap() {
  const queue = await getQueue();
  await registerPeriodicSync();

  await queue.work(queueJobs.QUEUE_SLACK_POST, async ([job]) => {
    const payload = job.data as {
      draftId: string;
      userId: string;
      channels: string[];
      message: string;
      scheduledFor: string;
    };

    const draft = await prisma.slackDraft.findFirst({
      where: {
        id: payload.draftId,
        userId: payload.userId
      }
    });

    if (!draft) {
      return;
    }

    if (draft.approvalRequired && draft.status === "NEEDS_APPROVAL") {
      await prisma.auditLog.create({
        data: {
          userId: payload.userId,
          action: "slack.post.pending_approval",
          entityType: "slack_draft",
          entityId: payload.draftId,
          metadata: {
            channels: payload.channels
          }
        }
      });
      return;
    }

    await prisma.slackDraft.update({
      where: {
        id: payload.draftId
      },
      data: {
        status: "SENT"
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: payload.userId,
        action: "slack.post.sent",
        entityType: "slack_draft",
        entityId: payload.draftId,
        metadata: {
          channels: payload.channels,
          sentAt: new Date().toISOString()
        }
      }
    });
  });

  await queue.work(queueJobs.QUEUE_PERIODIC_SYNC, async ([job]) => {
    const periodicPayload = (job.data as { reason?: string } | undefined) ?? {};
    const users = await prisma.user.findMany({
      include: {
        settings: true
      }
    });

    for (const user of users) {
      if (!user.settings) continue;

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "sync.periodic.poll",
          entityType: "activity_feed",
          entityId: user.id,
          metadata: {
            reason: periodicPayload.reason ?? "scheduled-poll",
            at: new Date().toISOString()
          }
        }
      });
    }
  });

  await queue.work(queueJobs.QUEUE_COACHING_REMINDER, async ([job]) => {
    const payload = job.data as {
      sessionId: string;
      userId: string;
      strategicEnablerId: string;
      strategicEnablerName: string;
      strategicEnablerSlackHandle: string;
      plannedDateTime: string;
      reminderAt: string;
    };

    await prisma.auditLog.create({
      data: {
        userId: payload.userId,
        action: "coaching.reminder.sent",
        entityType: "coaching_session",
        entityId: payload.sessionId,
        metadata: {
          channel: "slack_dm_and_outlook",
          slackHandle: payload.strategicEnablerSlackHandle,
          plannedDateTime: payload.plannedDateTime,
          reminderAt: payload.reminderAt
        }
      }
    });

    await prisma.activityFeed.createMany({
      data: [
        {
          userId: payload.userId,
          source: "SLACK",
          sourceId: `coaching-reminder-slack-${payload.sessionId}`,
          title: `Reminder sent to ${payload.strategicEnablerName} for upcoming 1:1`,
          body: `Slack DM sent to ${payload.strategicEnablerSlackHandle} 24h before session.`,
          eventAt: new Date(),
          dueAt: new Date(payload.plannedDateTime),
          isUnread: false,
          isFlagged: false,
          isMention: false,
          isDm: true,
          isStarred: false
        },
        {
          userId: payload.userId,
          source: "OUTLOOK_CALENDAR",
          sourceId: `coaching-reminder-outlook-${payload.sessionId}`,
          title: `Outlook reminder for coaching session with ${payload.strategicEnablerName}`,
          body: "Calendar reminder created from Work OS coaching automation.",
          eventAt: new Date(),
          dueAt: new Date(payload.plannedDateTime),
          isUnread: false,
          isFlagged: false,
          isMention: false,
          isDm: false,
          isStarred: false
        }
      ],
      skipDuplicates: true
    });
  });

  await queue.work(queueJobs.QUEUE_COACHING_POST_SESSION, async ([job]) => {
    const payload = job.data as {
      sessionId: string;
      userId: string;
      strategicEnablerId: string;
      strategicEnablerName: string;
      homeworkAssigned: string;
      plannedDateTime: string;
      autoCreateHomeworkJira: boolean;
      autoConfluenceLog: boolean;
    };

    await runPostSessionAutomation({
      sessionId: payload.sessionId,
      userId: payload.userId,
      strategicEnablerId: payload.strategicEnablerId,
      strategicEnablerName: payload.strategicEnablerName,
      homeworkAssigned: payload.homeworkAssigned,
      plannedDateTime: new Date(payload.plannedDateTime),
      autoCreateHomeworkJira: payload.autoCreateHomeworkJira,
      autoConfluenceLog: payload.autoConfluenceLog
    });
  });

  console.log("Work OS worker running");
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
