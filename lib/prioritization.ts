import { ActivityFeed, ActivitySource, BoardColumn, User, UserSettings } from "@prisma/client";

type ScoredTask = {
  title: string;
  source: ActivitySource;
  effortMinutes: number;
  dueAt: Date | null;
  column: BoardColumn;
  link: string | null;
  confidence: number;
  why: string;
  score: number;
};

type BoardTask = Omit<ScoredTask, "score">;

const URGENCY_HINTS = ["asap", "urgent", "eod", "blocking", "today", "now"];

export function buildTaskBoard(
  user: User,
  settings: UserSettings,
  activities: ActivityFeed[]
): BoardTask[] {
  const now = new Date();
  const dedupedActivities = dedupeActivities(activities);
  const mergedKeywords = Array.from(
    new Set([...URGENCY_HINTS, ...settings.keywords.map((k) => k.toLowerCase())])
  );

  const weighted = dedupedActivities.map((activity) => {
    const dueScore = calcDueScore(activity.dueAt, now);
    const urgencyScore = calcUrgencyScore(activity, mergedKeywords);
    const stakeholderScore = calcStakeholderScore(activity, settings.execSenders);
    const dependencyScore = calcMeetingDependencyScore(activity, now);
    const sourceScore = calcSourceWeight(activity.source, settings);

    const roleBoost =
      /automation|agent|ai|workflow|enablement/i.test(
        `${activity.title} ${activity.body ?? ""}`
      )
        ? 0.14
        : 0;

    const score =
      sourceScore + dueScore + urgencyScore + stakeholderScore + dependencyScore + roleBoost;

    const confidence = Math.max(0.45, Math.min(0.99, score));

    const effortMinutes = estimateEffort(activity);

    const whyParts = [
      activity.author ? `from ${activity.author}` : "",
      dueScore > 0.15 ? "has a near deadline" : "active signal",
      urgencyScore > 0.12 ? "contains urgency language" : "",
      stakeholderScore > 0.12 ? "from a key stakeholder" : "",
      dependencyScore > 0.12 ? "is tied to an upcoming meeting" : "",
      roleBoost > 0 ? `matches ${user.roleTitle} focus` : ""
    ].filter(Boolean);

    return {
      title: activity.title,
      source: activity.source,
      effortMinutes,
      dueAt: activity.dueAt,
      link: activity.url,
      confidence,
      why: whyParts.join("; "),
      score,
      column: pickColumn(score, activity.dueAt, now)
    } satisfies ScoredTask;
  });

  const sorted = weighted.sort((a, b) => b.score - a.score);
  const bounded = sorted.slice(0, Math.max(settings.taskMin, Math.min(settings.taskMax, 20)));

  return bounded.map(({ score: _score, ...task }) => task);
}

function dedupeActivities(activities: ActivityFeed[]) {
  const seen = new Set<string>();
  const unique: ActivityFeed[] = [];

  const ordered = [...activities].sort((a, b) => b.eventAt.getTime() - a.eventAt.getTime());

  for (const activity of ordered) {
    const key = buildActivityKey(activity);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(activity);
  }

  return unique;
}

function buildActivityKey(activity: ActivityFeed) {
  if (activity.source === "JIRA" || activity.source === "MANUAL") {
    return `${activity.source}:${normalizeKey(activity.sourceId)}`;
  }

  const title = normalizeKey(activity.title);
  const author = normalizeKey(activity.author);
  const channel = normalizeKey(activity.channel);

  if (!title) {
    return `${activity.source}:${normalizeKey(activity.sourceId)}`;
  }

  return `${activity.source}:${title}:${author}:${channel}`;
}

function normalizeKey(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function calcSourceWeight(source: ActivitySource, settings: UserSettings) {
  switch (source) {
    case "MANUAL":
      return 0.95; // Highest priority for manually curated tasks
    case "SLACK":
      return settings.slackWeight;
    case "OUTLOOK_EMAIL":
      return settings.emailWeight;
    case "OUTLOOK_CALENDAR":
      return settings.calendarWeight;
    case "JIRA":
      return 0.32;
    default:
      return 0.2;
  }
}

function calcDueScore(dueAt: Date | null, now: Date) {
  if (!dueAt) return 0.08;
  const diffMs = dueAt.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours <= 0) return 0.28;
  if (diffHours <= 2) return 0.24;
  if (diffHours <= 8) return 0.18;
  if (diffHours <= 24) return 0.12;
  return 0.06;
}

function calcUrgencyScore(activity: ActivityFeed, keywords: string[]) {
  const text = `${activity.title} ${activity.body ?? ""}`.toLowerCase();
  const hits = keywords.reduce((acc, keyword) => acc + (text.includes(keyword) ? 1 : 0), 0);

  let score = Math.min(0.22, hits * 0.08);
  if (activity.isMention) score += 0.05;
  if (activity.isDm) score += 0.05;
  if (activity.isFlagged) score += 0.05;
  return Math.min(0.3, score);
}

function calcStakeholderScore(activity: ActivityFeed, execSenders: string[]) {
  if (!activity.author) return 0;
  const loweredAuthor = activity.author.toLowerCase();
  const isKey = execSenders.some((sender) => loweredAuthor.includes(sender.toLowerCase()));
  return isKey ? 0.2 : 0.04;
}

function calcMeetingDependencyScore(activity: ActivityFeed, now: Date) {
  if (activity.source !== "OUTLOOK_CALENDAR") return 0;
  const dueAt = activity.dueAt;
  if (!dueAt) return 0.07;

  const hours = (dueAt.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hours <= 0) return 0.16;
  if (hours <= 3) return 0.14;
  if (hours <= 8) return 0.11;
  return 0.06;
}

function estimateEffort(activity: ActivityFeed) {
  const sourceBase: Record<ActivitySource, number> = {
    SLACK: 12,
    OUTLOOK_EMAIL: 18,
    OUTLOOK_CALENDAR: 25,
    JIRA: 22,
    MANUAL: 20
  };

  const text = `${activity.title} ${activity.body ?? ""}`;
  const sizeAdjust = Math.min(20, Math.round(text.length / 45));

  return sourceBase[activity.source] + sizeAdjust;
}

function pickColumn(score: number, dueAt: Date | null, now: Date): BoardColumn {
  if (dueAt && dueAt.getTime() < now.getTime()) {
    return "NOW";
  }

  if (score >= 0.78) return "NOW";
  if (score >= 0.58) return "NEXT";
  return "WAITING";
}
