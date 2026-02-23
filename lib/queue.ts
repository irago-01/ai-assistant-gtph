import PgBoss from "pg-boss";

const QUEUE_SLACK_POST = "slack-post";
const QUEUE_PERIODIC_SYNC = "periodic-sync";
const QUEUE_COACHING_REMINDER = "coaching-reminder";
const QUEUE_COACHING_POST_SESSION = "coaching-post-session";
const ALL_QUEUES = [
  QUEUE_SLACK_POST,
  QUEUE_PERIODIC_SYNC,
  QUEUE_COACHING_REMINDER,
  QUEUE_COACHING_POST_SESSION
];

let boss: PgBoss | null = null;

export async function getQueue() {
  if (!boss) {
    boss = new PgBoss({
      connectionString: process.env.DATABASE_URL,
      schema: "public"
    });
    await boss.start();
    await ensureQueues(boss);
  }

  return boss;
}

async function ensureQueues(queue: PgBoss) {
  for (const queueName of ALL_QUEUES) {
    try {
      await queue.createQueue(queueName);
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      const alreadyExists =
        message.includes("exists") || message.includes("duplicate");

      if (!alreadyExists) {
        throw error;
      }
    }
  }
}

export async function enqueueSlackPost(payload: {
  draftId: string;
  userId: string;
  channels: string[];
  message: string;
  scheduledFor: Date;
}) {
  const queue = await getQueue();
  const jobId = await queue.send(QUEUE_SLACK_POST, payload, {
    startAfter: payload.scheduledFor,
    retryLimit: 3,
    retryDelay: 10,
    singletonKey: `draft:${payload.draftId}`
  });

  return jobId;
}

export async function registerPeriodicSync() {
  const queue = await getQueue();
  await queue.schedule(QUEUE_PERIODIC_SYNC, "*/15 * * * *", {
    reason: "scheduled-poll"
  });
}

export async function enqueueCoachingReminder(payload: {
  sessionId: string;
  userId: string;
  strategicEnablerId: string;
  strategicEnablerName: string;
  strategicEnablerSlackHandle: string;
  plannedDateTime: Date;
  reminderAt: Date;
}) {
  const queue = await getQueue();
  const jobId = await queue.send(QUEUE_COACHING_REMINDER, payload, {
    startAfter: payload.reminderAt,
    retryLimit: 3,
    retryDelay: 10,
    singletonKey: `coaching-reminder:${payload.sessionId}`
  });

  return jobId;
}

export async function enqueuePostSessionAutomation(payload: {
  sessionId: string;
  userId: string;
  strategicEnablerId: string;
  strategicEnablerName: string;
  homeworkAssigned: string;
  plannedDateTime: Date;
  autoCreateHomeworkJira: boolean;
  autoConfluenceLog: boolean;
}) {
  const queue = await getQueue();
  const jobId = await queue.send(QUEUE_COACHING_POST_SESSION, payload, {
    retryLimit: 2,
    retryDelay: 5,
    singletonKey: `coaching-post-session:${payload.sessionId}`
  });

  return jobId;
}

export const queueJobs = {
  QUEUE_SLACK_POST,
  QUEUE_PERIODIC_SYNC,
  QUEUE_COACHING_REMINDER,
  QUEUE_COACHING_POST_SESSION
};
