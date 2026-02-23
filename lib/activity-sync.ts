import { ActivityFeed, ActivitySource, ConnectionStatus, Prisma, User, UserSettings } from "@prisma/client";
import { subHours } from "date-fns";

import { decryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

const FALLBACK_SOURCES = {
  slack: false,
  outlook: false
};
const SLACK_FALLBACK_SOURCE_IDS = ["fallback-slack-mention", "fallback-slack-dm"];
const OUTLOOK_FALLBACK_SOURCE_IDS = [
  "fallback-outlook-meeting-prep",
  "fallback-outlook-flagged-email"
];
const ALL_FALLBACK_SOURCE_IDS = [...SLACK_FALLBACK_SOURCE_IDS, ...OUTLOOK_FALLBACK_SOURCE_IDS];
const LEGACY_FALLBACK_SOURCE_PREFIXES = [
  "slack-mention-",
  "slack-dm-",
  "meeting-prep-",
  "email-flagged-",
  "seed-slack-",
  "seed-email-",
  "seed-calendar-"
];

type GeneratedActivity = {
  userId: string;
  source: ActivitySource;
  sourceId: string;
  title: string;
  body: string | null;
  url: string | null;
  author: string | null;
  channel: string | null;
  priorityHint: number;
  dueAt: Date | null;
  eventAt: Date;
  metadata?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  isUnread: boolean;
  isFlagged: boolean;
  isMention: boolean;
  isDm: boolean;
  isStarred: boolean;
};

type SlackAuthTestResponse = {
  ok: boolean;
  error?: string;
  user_id?: string;
  team?: string;
};

type SlackConversation = {
  id: string;
  name?: string;
  is_im?: boolean;
  is_member?: boolean;
};

type SlackConversationsResponse = {
  ok: boolean;
  error?: string;
  channels?: SlackConversation[];
  response_metadata?: {
    next_cursor?: string;
  };
};

type SlackMessage = {
  ts?: string;
  text?: string;
  user?: string;
  subtype?: string;
  thread_ts?: string;
};

type SlackHistoryResponse = {
  ok: boolean;
  error?: string;
  messages?: SlackMessage[];
};

type SlackUserInfoResponse = {
  ok: boolean;
  error?: string;
  user?: {
    id?: string;
    name?: string;
    real_name?: string;
    profile?: {
      display_name?: string;
      real_name?: string;
      real_name_normalized?: string;
    };
  };
};

function isLikelySlackUserToken(token: string) {
  return token.startsWith("xoxp-") || token.startsWith("xwfp-") || token.startsWith("xoxs-");
}

const ACTION_PATTERNS = [
  /\b(can you|could you|please|pls|need to|we need to|i need you to)\b/i,
  /\b(todo|to-do|action item|follow up|follow-up|next step|next steps)\b/i,
  /\b(review|approve|reply|update|prepare|draft|schedule|investigate|fix|ship|deploy|share)\b/i,
  /\b(deadline|due|blocker|blocked|unblock)\b/i,
  /\b(by|before)\s+(eod|end of day|today|tomorrow|\d{1,2}(:\d{2})?\s?(am|pm))\b/i
];

const IGNORE_PATTERNS = [
  /^(\+1|thanks!?|thank you!?|ok!?|okay!?|got it!?|noted\.?)$/i,
  /^(good morning|good afternoon|good evening|hi there|hi|hello|hey)(!|\.|\s|,|$)/i,
  /^hi\s+from\b/i, // "Hi from Cape Town"
  /^(greetings|morning|afternoon|evening)(!|\.|\s|$)/i,
  /^fyi[!. ]*$/i,
  /\b(how are you|how's it going|what's up|how have you been|how do you do)\b/i,
  /^(just saying|just checking in|checking in|touching base|following up on)(!|\.|\s|$)/i,
  /^(congrats|congratulations|awesome|great|nice|cool|sweet|sounds good|perfect|excellent)(!|\.|\s|$)/i,
  /^(welcome|welcome back|see you|bye|goodbye|later|cheers|take care)(!|\.|\s|$)/i,
  /^(yes|yep|yeah|yup|no|nope|nah|sure|alright|right)(!|\.|\s|$)/i,
  /^(lol|haha|hehe|lmao)(!|\.|\s|$)/i,
  /^(thank|thanks)\b/i // Catches "thanks", "thank you", etc at start
];

const TASK_PREFIX_PATTERNS = [
  /^(can you|could you|would you|please|pls|kindly)\s+/i,
  /^(i need you to|need you to|need to)\s+/i,
  /^(action item|todo|to-do|next step|follow up|follow-up)\s*[:\-]?\s*/i
];

// Strong request patterns - require explicit requests DIRECTED AT the user
const REQUEST_PATTERNS = [
  /\b(please|pls)\s+(help|assist|provide|send|share|review|approve|check|fix|create|update|look|give|let me know)\b/i,
  /\b(can you|could you|would you|will you)\s+(help|assist|provide|send|share|review|approve|check|fix|create|update|look|give|let me know)\b/i,
  /\b(need you to|want you to|asking you to|requesting you to|would like you to)\s+\w/i,
  /\b(i need|we need)\s+(your|you to)\b/i, // "I need your help", "I need you to"
  /\b(send|share|provide|give)\s+(me|us)\s+(the|your|a|an|some)\b/i,
  /\b(help|assist)\s+(me|us)\s+(with|to)\b/i,
  /\bwaiting (on|for) (you|your)\b/i,
  /\b(approve|review|check|verify|look at)\s+(the|this|my|our|these)\b/i,
  /\b(let me know|tell me|inform me|update me)\b/i,
  /\b(do you have|can i get|could i get)\b/i
];

const TASK_TRIGGER_PATTERNS = [
  /\b(please|pls|can you|could you|would you|need you to|action item|todo|next step)\b/i,
  /\b(review|approve|reply|update|prepare|draft|schedule|investigate|fix|ship|deploy|share|send|confirm|create|document)\b/i,
  /\b(by|before)\s+(eod|end of day|today|tomorrow|\d{1,2}(:\d{2})?\s?(am|pm))\b/i,
  /\b(deadline|due|urgent|asap|blocking|blocker)\b/i
];

const ENGLISH_COMMON_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "can",
  "deadline",
  "deploy",
  "done",
  "due",
  "for",
  "from",
  "has",
  "have",
  "in",
  "is",
  "it",
  "need",
  "next",
  "now",
  "on",
  "please",
  "priority",
  "reply",
  "review",
  "schedule",
  "share",
  "task",
  "the",
  "this",
  "to",
  "today",
  "tomorrow",
  "update",
  "urgent",
  "we",
  "with",
  "you"
]);

const TAGALOG_TO_ENGLISH: Array<[RegExp, string]> = [
  [/\bpaki\b/gi, "please"],
  [/\bpakisuyo\b/gi, "please"],
  [/\bkailangan\b/gi, "need"],
  [/\bngayon\b/gi, "today"],
  [/\bbukas\b/gi, "tomorrow"],
  [/\bmamaya\b/gi, "later"],
  [/\bagad\b/gi, "immediately"],
  [/\bsalamat\b/gi, "thanks"],
  [/\bpa-?review\b/gi, "review"],
  [/\bpa-?approve\b/gi, "approve"],
  [/\bpa-?update\b/gi, "update"]
];

const englishTranslationCache = new Map<string, string>();
const slackUserDisplayCache = new Map<string, string>();

export async function syncRecentSignals(
  user: User,
  settings: UserSettings,
  windowHours = 24 * 30
): Promise<ActivityFeed[]> {
  const windowStart = subHours(new Date(), windowHours);
  const recentSlackCount = await prisma.activityFeed.count({
    where: buildRealSignalWhere(user.id, ActivitySource.SLACK, windowStart)
  });
  const liveSlackSignals = await buildSlackSignalsFromConnection(user.id, settings, windowStart);

  const shouldBackfillSlack =
    FALLBACK_SOURCES.slack && recentSlackCount === 0 && liveSlackSignals.length === 0;
  const generated = [...liveSlackSignals, ...(shouldBackfillSlack ? buildSlackSignals(user.id, settings) : [])];

  await prisma.$transaction(async (tx) => {
    await tx.activityFeed.deleteMany({
      where: {
        userId: user.id,
        source: ActivitySource.SLACK,
        eventAt: {
          gte: windowStart
        }
      }
    });

    await tx.activityFeed.deleteMany({
      where: {
        userId: user.id,
        OR: LEGACY_FALLBACK_SOURCE_PREFIXES.map((prefix) => ({
          sourceId: {
            startsWith: prefix
          }
        }))
      }
    });

    for (const entry of generated) {
      await tx.activityFeed.upsert({
        where: {
          userId_source_sourceId: {
            userId: entry.userId,
            source: entry.source,
            sourceId: entry.sourceId
          }
        },
        update: {
          title: entry.title,
          body: entry.body,
          url: entry.url,
          author: entry.author,
          channel: entry.channel,
          priorityHint: entry.priorityHint,
          dueAt: entry.dueAt,
          eventAt: entry.eventAt,
          metadata: entry.metadata,
          isUnread: entry.isUnread,
          isFlagged: entry.isFlagged,
          isMention: entry.isMention,
          isDm: entry.isDm,
          isStarred: entry.isStarred
        },
        create: entry
      });
    }

    if (!shouldBackfillSlack) {
      await tx.activityFeed.deleteMany({
        where: {
          userId: user.id,
          source: ActivitySource.SLACK,
          sourceId: {
            in: SLACK_FALLBACK_SOURCE_IDS
          }
        }
      });
    }

    await tx.activityFeed.deleteMany({
      where: {
        userId: user.id,
        source: {
          in: [ActivitySource.OUTLOOK_CALENDAR, ActivitySource.OUTLOOK_EMAIL, ActivitySource.JIRA]
        }
      }
    });
  });

  return prisma.activityFeed.findMany({
    where: {
      userId: user.id,
      eventAt: {
        gte: windowStart
      },
      OR: [
        {
          source: {
            not: ActivitySource.SLACK
          }
        },
        {
          source: ActivitySource.SLACK,
          OR: [
            {
              isMention: true
            },
            {
              isDm: true
            }
          ]
        }
      ]
    },
    orderBy: {
      eventAt: "desc"
    },
    take: 120
  });
}

function buildSlackSignals(userId: string, settings: UserSettings): GeneratedActivity[] {
  const now = new Date();
  const channels = settings.keyChannels.length > 0 ? settings.keyChannels : ["#general"];

  return [
    {
      userId,
      source: ActivitySource.SLACK,
      sourceId: "fallback-slack-mention",
      title: "Respond to product VP mention on automation blockers",
      body: "ASAP: team needs unblock before EOD deployment window.",
      url: "https://slack.com/app_redirect?channel=automation",
      author: settings.keyPeople[0] ?? "vp-product@company.com",
      channel: channels[0],
      priorityHint: 0.93,
      dueAt: new Date(now.getTime() + 1000 * 60 * 120),
      eventAt: subHours(now, 2),
      metadata: {
        type: "mention",
        tags: ["urgent", "delivery"]
      },
      isUnread: true,
      isFlagged: true,
      isMention: true,
      isDm: false,
      isStarred: true
    },
    {
      userId,
      source: ActivitySource.SLACK,
      sourceId: "fallback-slack-dm",
      title: "Draft update for #ai-enablement weekly sync",
      body: "Need concise summary + CTA for adoption metrics.",
      url: "https://slack.com/app_redirect?channel=ai-enablement",
      author: "team-lead@company.com",
      channel: channels[1] ?? channels[0],
      priorityHint: 0.72,
      dueAt: new Date(now.getTime() + 1000 * 60 * 300),
      eventAt: subHours(now, 4),
      metadata: {
        type: "dm",
        tags: ["communication"]
      },
      isUnread: true,
      isFlagged: false,
      isMention: false,
      isDm: true,
      isStarred: false
    }
  ];
}

async function buildSlackSignalsFromConnection(
  userId: string,
  settings: UserSettings,
  windowStart: Date
): Promise<GeneratedActivity[]> {
  const connection = await prisma.integrationConnection.findUnique({
    where: {
      userId_provider: {
        userId,
        provider: "SLACK"
      }
    }
  });

  if (
    !connection ||
    connection.status !== ConnectionStatus.CONNECTED ||
    !connection.encryptedAccessToken
  ) {
    return [];
  }

  const tokenSecret = process.env.APP_ENCRYPTION_KEY;
  if (!tokenSecret) {
    return [];
  }

  let token: string;
  try {
    token = decryptToken(connection.encryptedAccessToken, tokenSecret);
  } catch {
    await prisma.integrationConnection.update({
      where: {
        id: connection.id
      },
      data: {
        status: ConnectionStatus.DISCONNECTED,
        scopes: [],
        accountName: null,
        encryptedAccessToken: null,
        encryptedRefreshToken: null,
        tokenExpiresAt: null
      }
    });
    return [];
  }

  // Clean up legacy demo tokens so UI no longer reports a false "connected" state.
  if (token.startsWith("demo_access_slack_")) {
    await prisma.integrationConnection.update({
      where: {
        id: connection.id
      },
      data: {
        status: ConnectionStatus.DISCONNECTED,
        scopes: [],
        accountName: null,
        encryptedAccessToken: null,
        encryptedRefreshToken: null,
        tokenExpiresAt: null
      }
    });
    return [];
  }

  if (token.startsWith("xoxb-")) {
    throw new Error(
      "Slack is connected with a bot token. Reconnect Slack to grant user-token scopes for DM and mention reads."
    );
  }

  try {
    const auth = await slackGet<SlackAuthTestResponse>(token, "auth.test");
    const mentionTargetUserId = resolveMentionTargetUserId({
      configured: process.env.SLACK_TARGET_USER_ID,
      connectionAccountId: connection.accountId,
      accountName: connection.accountName,
      authUserId: auth.user_id,
      token
    });
    const myUserId = mentionTargetUserId ?? auth.user_id?.trim().toUpperCase() ?? null;
    const useMentionFallback = !mentionTargetUserId;
    if (useMentionFallback) {
      console.warn(
        "Slack direct mention filtering is using fallback (any explicit @mention). Set SLACK_TARGET_USER_ID for strict personal filtering."
      );
    }
    const conversations = await listSlackConversations(token);
    const selectedConversations = pickSlackConversations(conversations, settings);
    const candidateConversations =
      selectedConversations.length > 0
        ? selectedConversations
        : conversations.filter((conversation) => conversation.is_im || conversation.is_member);
    const prioritizedConversations = [...candidateConversations].sort((a, b) => {
      const aScore = a.is_im ? 0 : 1;
      const bScore = b.is_im ? 0 : 1;
      return aScore - bScore;
    });
    if (candidateConversations.length === 0) {
      return [];
    }

    const oldest = Math.floor(windowStart.getTime() / 1000).toString();
    const urgencyRegex = /asap|urgent|eod|blocking|today|now/i;
    const signals: GeneratedActivity[] = [];
    const historyErrors: string[] = [];

    for (const conversation of prioritizedConversations.slice(0, 20)) {
      let history: SlackHistoryResponse;
      try {
        history = await slackGet<SlackHistoryResponse>(token, "conversations.history", {
          channel: conversation.id,
          oldest,
          limit: "120",
          inclusive: "true"
        });
      } catch (error) {
        // Continue collecting from other channels/DMs if one channel is inaccessible.
        if (error instanceof Error) {
          historyErrors.push(error.message);
        }
        console.warn(
          "Slack channel history skipped",
          conversation.id,
          error instanceof Error ? error.message : error
        );
        continue;
      }

      for (const message of history.messages ?? []) {
        if (!message.ts || !message.text) continue;
        if (message.subtype && message.subtype !== "thread_broadcast") continue;

        const eventAt = new Date(Number.parseFloat(message.ts) * 1000);
        if (Number.isNaN(eventAt.getTime())) continue;

        const rawText = compactSlackText(message.text);
        if (!rawText) continue;

        const mentionedUserIds = extractMentionedUserIds(rawText);
        const isMention = mentionTargetUserId
          ? mentionedUserIds.includes(mentionTargetUserId)
          : mentionedUserIds.length > 0;
        const isDm = Boolean(conversation.is_im);
        const senderId = message.user?.trim().toUpperCase() ?? null;
        const isDirectDmToMe = isDm && Boolean(senderId) && (!myUserId || senderId !== myUserId);
        if (!isMention && !isDirectDmToMe) {
          continue;
        }

        const text = await normalizeTextToEnglish(rawText);
        const isFlagged = urgencyRegex.test(text);
        const senderName = await resolveSlackUserDisplayName(token, senderId);

        // Use AI to classify if this is a real work task
        const { classifyMessageAsTask } = await import("./ai-task-classifier");
        const aiClassification = await classifyMessageAsTask(text, {
          isMention,
          isDm: isDirectDmToMe,
          sender: senderName ?? undefined
        });

        // Skip if AI determines it's not a task (unless flagged as urgent)
        if (!aiClassification.isTask && !isFlagged) {
          continue;
        }

        // Use AI-generated task title
        const taskTitle = aiClassification.taskTitle || buildTaskTitleFromText(text);
        if (!taskTitle || taskTitle.length < 10) {
          continue;
        }

        const channelLabel = conversation.is_im
          ? "DM"
          : conversation.name
            ? `#${conversation.name}`
            : "Slack";

        // Build title (max 100 characters)
        const maxTitleLength = 100;
        let title = taskTitle;
        if (title.length > maxTitleLength) {
          title = title.slice(0, maxTitleLength - 3).trimEnd() + '...';
        }

        signals.push({
          userId,
          source: ActivitySource.SLACK,
          sourceId: `${conversation.id}:${message.ts}`,
          title,
          body: text,
          url: null,
          author: senderName,
          channel: channelLabel,
          priorityHint: Math.min(0.95, aiClassification.confidence * 0.9),
          dueAt: null,
          eventAt,
          metadata: {
            taskReason: aiClassification.reason,
            matchedRules: [],
            type: conversation.is_im ? "dm" : "channel",
            conversationId: conversation.id,
            rawTs: message.ts,
            mentionTargetUserId: mentionTargetUserId ?? null,
            mentionMatchMode: mentionTargetUserId ? "strict-target-user" : "fallback-any-mention",
            mentionedUserIds,
            isDirectDmToMe,
            aiTaskTitle: aiClassification.taskTitle,
            aiConfidence: aiClassification.confidence,
            ...(text === rawText ? {} : { originalText: rawText })
          },
          isUnread: true,
          isFlagged,
          isMention,
          isDm: isDirectDmToMe,
          isStarred: false
        });
      }
    }

    if (signals.length === 0 && historyErrors.length > 0) {
      const normalized = Array.from(
        new Set(
          historyErrors
            .map((message) => {
              if (message.includes("missing_scope")) return "missing_scope";
              if (message.includes("not_in_channel")) return "not_in_channel";
              if (message.includes("not_allowed_token_type")) return "not_allowed_token_type";
              return "history_unavailable";
            })
        )
      );
      throw new Error(
        `Slack messages could not be read (${normalized.join(", ")}). Reconnect Slack and confirm scopes/channel access.`
      );
    }

    return signals
      .sort((a, b) => b.eventAt.getTime() - a.eventAt.getTime())
      .slice(0, 80);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error("Slack signal sync failed", message);
    throw new Error(message);
  }
}

async function listSlackConversations(token: string) {
  if (isLikelySlackUserToken(token)) {
    try {
      return await listSlackConversationsViaUsersEndpoint(token);
    } catch (error) {
      console.warn(
        "Slack users.conversations failed; falling back to conversations.list",
        error instanceof Error ? error.message : error
      );
    }
  }

  return listSlackConversationsViaListEndpoint(token);
}

async function listSlackConversationsViaUsersEndpoint(token: string) {
  const channels: SlackConversation[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < 8; page += 1) {
    const response = await slackGet<SlackConversationsResponse>(
      token,
      "users.conversations",
      {
        limit: "200",
        types: "im,public_channel,private_channel",
        ...(cursor ? { cursor } : {})
      }
    );

    channels.push(...(response.channels ?? []));
    cursor = response.response_metadata?.next_cursor || undefined;
    if (!cursor) break;
  }

  return channels;
}

async function listSlackConversationsViaListEndpoint(token: string) {
  const channels: SlackConversation[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < 4; page += 1) {
    const response = await slackGet<SlackConversationsResponse>(
      token,
      "conversations.list",
      {
        limit: "200",
        types: "public_channel,private_channel,im",
        ...(cursor ? { cursor } : {})
      }
    );

    channels.push(...(response.channels ?? []));
    cursor = response.response_metadata?.next_cursor || undefined;
    if (!cursor) {
      break;
    }
  }

  return channels;
}

function pickSlackConversations(conversations: SlackConversation[], settings: UserSettings) {
  if (conversations.length === 0) {
    return [];
  }

  const directMessages = conversations.filter((conversation) => conversation.is_im);
  const normalizedPreferred = new Set(
    settings.keyChannels
      .map((item) => item.trim().toLowerCase().replace(/^#/, ""))
      .filter(Boolean)
  );

  if (normalizedPreferred.size > 0) {
    const preferred = conversations.filter((conversation) => {
      if (!conversation.name) return false;
      if (!normalizedPreferred.has(conversation.name.toLowerCase())) return false;
      return conversation.is_im || Boolean(conversation.is_member);
    });

    if (preferred.length > 0) {
      const preferredChannels = preferred.filter((conversation) => !conversation.is_im);
      return dedupeConversations([...directMessages, ...preferredChannels]);
    }
  }

  const memberChannels = conversations.filter(
    (conversation) => !conversation.is_im && conversation.is_member
  );

  return dedupeConversations([...directMessages, ...memberChannels.slice(0, 6)]);
}

function dedupeConversations(conversations: SlackConversation[]) {
  const seen = new Set<string>();
  const unique: SlackConversation[] = [];

  for (const conversation of conversations) {
    if (seen.has(conversation.id)) continue;
    seen.add(conversation.id);
    unique.push(conversation);
  }

  return unique;
}

async function slackGet<T>(
  token: string,
  method: string,
  params?: Record<string, string>
): Promise<T> {
  const endpoint = new URL(`https://slack.com/api/${method}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    endpoint.searchParams.set(key, value);
  }

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`Slack API ${method} failed (${response.status})`);
  }

  const payload = (await response.json()) as { ok?: boolean; error?: string };
  if (!payload.ok) {
    throw new Error(`Slack API ${method} error: ${payload.error ?? "unknown_error"}`);
  }

  return payload as T;
}

async function resolveSlackUserDisplayName(token: string, userId: string | null) {
  if (!userId) {
    return null;
  }

  const normalized = userId.toUpperCase();
  const cached = slackUserDisplayCache.get(normalized);
  if (cached) {
    return cached;
  }

  try {
    const response = await slackGet<SlackUserInfoResponse>(token, "users.info", {
      user: normalized
    });
    const user = response.user;
    const label =
      user?.profile?.display_name?.trim() ||
      user?.real_name?.trim() ||
      user?.profile?.real_name?.trim() ||
      user?.name?.trim() ||
      normalized;

    slackUserDisplayCache.set(normalized, label);
    return label;
  } catch {
    slackUserDisplayCache.set(normalized, normalized);
    return normalized;
  }
}

function compactSlackText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function decodeSlackFormatting(text: string) {
  return text
    .replace(/<@([A-Z0-9]+)>/gi, "@$1")
    .replace(/<#([A-Z0-9]+)\|([^>]+)>/gi, "#$2")
    .replace(/<([^>|]+)\|([^>]+)>/g, "$2")
    .replace(/<([^>]+)>/g, "$1");
}

function extractMentionedUserIds(text: string) {
  const values = text.match(/<@([UW][A-Z0-9]+)(?:\|[^>]+)?>/gi) ?? [];
  return values
    .map((value) => {
      const match = value.match(/^<@([UW][A-Z0-9]+)(?:\|[^>]+)?>$/i);
      return match?.[1]?.toUpperCase();
    })
    .filter((value): value is string => Boolean(value));
}

function parseUserIdFromAccountName(value: string | null) {
  if (!value) {
    return null;
  }

  const match = value.match(/\b([UW][A-Z0-9]{5,})\b/i);
  return match?.[1]?.toUpperCase() ?? null;
}

function resolveMentionTargetUserId(input: {
  configured?: string;
  connectionAccountId: string | null;
  accountName: string | null;
  authUserId?: string;
  token: string;
}) {
  const configured = input.configured?.trim().toUpperCase();
  if (configured) {
    return configured;
  }

  const accountId = input.connectionAccountId?.trim().toUpperCase();
  if (accountId) {
    return accountId;
  }

  const accountIdFromName = parseUserIdFromAccountName(input.accountName);
  if (accountIdFromName) {
    return accountIdFromName;
  }

  const authUserId = input.authUserId?.trim().toUpperCase();
  if (!authUserId) {
    return null;
  }

  // Bot tokens do not identify the human user to be matched for direct tags.
  if (input.token.startsWith("xoxb-")) {
    return null;
  }

  return authUserId;
}

function applyTagalogGlossary(text: string) {
  let translated = text;
  for (const [pattern, replacement] of TAGALOG_TO_ENGLISH) {
    translated = translated.replace(pattern, replacement);
  }

  return compactSlackText(translated);
}

function looksLikeEnglish(text: string) {
  const asciiChars = text.match(/[\x00-\x7F]/g)?.length ?? 0;
  const asciiRatio = asciiChars / Math.max(1, text.length);
  const words = text.toLowerCase().match(/[a-z']+/g) ?? [];
  if (words.length === 0) {
    return true;
  }

  const englishHits = words.reduce(
    (count, word) => count + (ENGLISH_COMMON_WORDS.has(word) ? 1 : 0),
    0
  );
  const minHits = Math.max(2, Math.floor(words.length * 0.18));

  return asciiRatio >= 0.9 && englishHits >= minHits;
}

async function translateViaApi(text: string): Promise<string | null> {
  const endpoint = process.env.TRANSLATE_API_URL;
  if (!endpoint) {
    return null;
  }

  const apiKey = process.env.TRANSLATE_API_KEY;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(apiKey ? { "x-api-key": apiKey } : {})
      },
      body: JSON.stringify({
        q: text,
        source: "auto",
        target: "en",
        format: "text",
        ...(apiKey ? { api_key: apiKey } : {})
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      translatedText?: string;
      translation?: string;
      data?: {
        translations?: Array<{
          translatedText?: string;
        }>;
      };
    };

    const translated =
      payload.translatedText ??
      payload.translation ??
      payload.data?.translations?.[0]?.translatedText;

    return translated ? compactSlackText(translated) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function normalizeTextToEnglish(text: string) {
  const decoded = compactSlackText(decodeSlackFormatting(text));
  if (!decoded) {
    return decoded;
  }

  const cached = englishTranslationCache.get(decoded);
  if (cached) {
    return cached;
  }

  const glossaryTranslated = applyTagalogGlossary(decoded);
  let translated = glossaryTranslated;

  if (!looksLikeEnglish(glossaryTranslated)) {
    translated = (await translateViaApi(glossaryTranslated)) ?? glossaryTranslated;
  }

  englishTranslationCache.set(decoded, translated);
  return translated;
}

function buildTaskTitleFromText(text: string) {
  let value = compactSlackText(text);
  if (!value) {
    return "";
  }

  // Strip Slack markdown formatting
  value = value
    .replace(/\*([^*]+)\*/g, "$1") // *bold*
    .replace(/_([^_]+)_/g, "$1") // _italic_
    .replace(/~([^~]+)~/g, "$1") // ~strikethrough~
    .replace(/`([^`]+)`/g, "$1") // `code`
    .replace(/```[^`]*```/g, "") // ```code blocks```
    .trim();

  // Strip thread subjects and RE: prefixes
  value = value
    .replace(/^RE:\s*/i, "")
    .replace(/^FWD:\s*/i, "")
    .replace(/^\[.*?\]\s*/, "")
    .trim();

  // Strip user mentions and IDs
  value = value.replace(/^(@[A-Za-z0-9._-]+\s+)+/, "");
  value = value.replace(/@[UW][A-Z0-9]+/g, ""); // Remove @U07429A7L8M style IDs

  for (const pattern of TASK_PREFIX_PATTERNS) {
    value = value.replace(pattern, "");
  }

  value = value
    .replace(/\b(thanks|thank you|pls|please)\b[!. ]*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  const firstClause = value
    .split(/[.!?\n;]/)
    .map((clause) => clause.trim())
    .find(Boolean);

  const task = firstClause ?? value;
  if (!task) {
    return "";
  }

  const normalized = task.charAt(0).toUpperCase() + task.slice(1);
  return normalized.length > 120 ? `${normalized.slice(0, 117).trimEnd()}...` : normalized;
}

function classifySlackTaskCandidate(
  text: string,
  context: { isMention: boolean; isDm: boolean; isFlagged: boolean }
) {
  // Clean text thoroughly - order matters!
  const cleaned = compactSlackText(text)
    // First remove markdown formatting
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~([^~]+)~/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/```[^`]*```/g, "")
    .trim()
    // Remove thread subjects and RE:/FWD:
    .replace(/^(RE|FWD|FW):\s*/i, "")
    .replace(/^\[.*?\]\s*/, "")
    .replace(/^[^:]+:\s*/, "")
    .trim()
    // Remove everything up to and including the FIRST sentence if it's a subject line
    // Common pattern: "Subject Title Hi @mention, actual message"
    // After removing markdown: "Subject Title Hi @mention, actual message"
    // Remove subject before greeting
    .replace(/^[^.!?]*?\s+(Hi|Hello|Hey|Good morning)\s+@/i, "$1 @")
    .replace(/^[^.!?]*?\s+(I have|I had|Can you|Could you|Would you|Please|Pls)\s+/i, "$1 ")
    .trim()
    // Remove user IDs
    .replace(/@[UW][A-Z0-9]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Must be DM or mention
  if (!context.isMention && !context.isDm) {
    return { actionable: false, priorityHint: 0.5, reason: "not DM/mention", matchedRules: [], taskTitle: "", confidence: 0 };
  }

  // Minimum length
  if (!cleaned || cleaned.length < 30) {
    return { actionable: false, priorityHint: 0.5, reason: "too short", matchedRules: [], taskTitle: "", confidence: 0 };
  }

  // Get lowercase for easier matching
  const lower = cleaned.toLowerCase();

  // REJECT: Greetings
  if (/^(hi|hello|hey|good morning|good afternoon|good evening|greetings)/.test(lower)) {
    return { actionable: false, priorityHint: 0.5, reason: "greeting", matchedRules: [], taskTitle: "", confidence: 0 };
  }

  // REJECT: Thanks/acknowledgments
  if (/^(thanks|thank you|ok|okay|got it|noted|yes|yeah|yep|no|nope)/.test(lower)) {
    return { actionable: false, priorityHint: 0.5, reason: "acknowledgment", matchedRules: [], taskTitle: "", confidence: 0 };
  }

  // REJECT: "I have a..." statements
  if (/^i (have|had) (a|an|another)/.test(lower)) {
    return { actionable: false, priorityHint: 0.5, reason: "statement not request", matchedRules: [], taskTitle: "", confidence: 0 };
  }

  // ACCEPT: Only VERY explicit requests
  const explicitRequests = [
    /^(can you|could you|would you|will you) /i,
    /^(please|pls) /i,
    /^(i need you to|need you to) /i,
    /^(requesting|require) /i,
  ];

  const isExplicitRequest = explicitRequests.some(p => p.test(cleaned));

  if (!isExplicitRequest && !context.isFlagged) {
    return { actionable: false, priorityHint: 0.5, reason: "no explicit request", matchedRules: [], taskTitle: "", confidence: 0 };
  }

  // Build task title
  const taskTitle = buildTaskTitleFromText(text);
  if (!taskTitle || taskTitle.length < 15) {
    return { actionable: false, priorityHint: 0.5, reason: "no meaningful task title", matchedRules: [], taskTitle: "", confidence: 0 };
  }

  // Accept
  return {
    actionable: true,
    priorityHint: 0.75,
    reason: context.isFlagged ? "urgent request" : "explicit request",
    matchedRules: [],
    taskTitle,
    confidence: 0.85
  };
}

function buildRealSignalWhere(userId: string, source: ActivitySource, windowStart: Date) {
  return {
    userId,
    source,
    eventAt: {
      gte: windowStart
    },
    NOT: [
      {
        sourceId: {
          in: ALL_FALLBACK_SOURCE_IDS
        }
      },
      ...LEGACY_FALLBACK_SOURCE_PREFIXES.map((prefix) => ({
        sourceId: {
          startsWith: prefix
        }
      }))
    ]
  };
}

function buildOutlookSignals(userId: string, settings: UserSettings): GeneratedActivity[] {
  const now = new Date();

  return [
    {
      userId,
      source: ActivitySource.OUTLOOK_CALENDAR,
      sourceId: "fallback-outlook-meeting-prep",
      title: "Prep for 3:00 PM automation steering meeting",
      body: "Bring adoption metrics and Jira request status snapshot.",
      url: "https://outlook.office.com/calendar/view/day",
      author: "calendar",
      channel: null,
      priorityHint: 0.88,
      dueAt: new Date(now.getTime() + 1000 * 60 * 180),
      eventAt: subHours(now, 1),
      metadata: {
        attendees: ["cto@company.com", "ops@company.com"]
      },
      isUnread: false,
      isFlagged: false,
      isMention: false,
      isDm: false,
      isStarred: false
    },
    {
      userId,
      source: ActivitySource.OUTLOOK_EMAIL,
      sourceId: "fallback-outlook-flagged-email",
      title: "Reply to flagged email: AI policy exception request",
      body: "Urgent review requested by legal before end of day.",
      url: "https://outlook.office.com/mail",
      author: settings.execSenders[0] ?? "ceo@company.com",
      channel: null,
      priorityHint: 0.91,
      dueAt: new Date(now.getTime() + 1000 * 60 * 240),
      eventAt: subHours(now, 3),
      metadata: {
        folder: "Inbox",
        stakeholders: settings.execSenders
      },
      isUnread: true,
      isFlagged: true,
      isMention: false,
      isDm: false,
      isStarred: false
    }
  ];
}

async function buildJiraSignals(userId: string): Promise<GeneratedActivity[]> {
  const pending = await prisma.jiraRequest.findMany({
    where: {
      userId,
      pendingApproval: true
    },
    take: 10,
    orderBy: {
      createdDate: "desc"
    }
  });

  return pending.map((request, index) => {
    const now = new Date();
    return {
      userId,
      source: ActivitySource.JIRA,
      sourceId: request.issueKey,
      title: `Review Jira approval ${request.issueKey}: ${request.summary}`,
      body: `${request.priority} priority request from ${request.requester}`,
      url: request.issueUrl,
      author: request.requester,
      channel: null,
      priorityHint: request.priority.toLowerCase() === "high" ? 0.84 : 0.62,
      dueAt: new Date(now.getTime() + (index + 3) * 1000 * 60 * 90),
      eventAt: now,
      metadata: {
        issueKey: request.issueKey,
        status: request.status
      },
      isUnread: true,
      isFlagged: request.priority.toLowerCase() === "high",
      isMention: false,
      isDm: false,
      isStarred: false
    };
  });
}
