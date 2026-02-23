import {
  ActivitySource,
  CoachingCadence,
  CoachingSessionStatus,
  Prisma,
  ProficiencyAssessment,
  StrategicEnabler
} from "@prisma/client";
import {
  addDays,
  addHours,
  addMinutes,
  differenceInCalendarDays,
  getDay,
  setHours,
  setMinutes,
  startOfDay,
  subHours
} from "date-fns";
import { randomUUID } from "node:crypto";

import { prisma } from "./prisma";
import { enqueueCoachingReminder, enqueuePostSessionAutomation } from "./queue";

type DimensionScoresInput = {
  promptingFundamentals: number;
  workflowAutomation: number;
  toolSelectionEvaluation: number;
  dataKnowledgeRetrieval: number;
  responsibleAiRiskAwareness: number;
  deliveryImplementation: number;
};

type ScoreboardFilters = {
  team?: string;
  scoreMin?: number;
  scoreMax?: number;
  needsPlan?: boolean;
  overdueAssessment?: boolean;
};

const DIMENSIONS: Array<{ key: keyof DimensionScoresInput; label: string }> = [
  { key: "promptingFundamentals", label: "Prompting fundamentals" },
  { key: "workflowAutomation", label: "Workflow automation (n8n)" },
  { key: "toolSelectionEvaluation", label: "Tool selection & evaluation" },
  { key: "dataKnowledgeRetrieval", label: "Data/knowledge retrieval (RAG/search)" },
  { key: "responsibleAiRiskAwareness", label: "Responsible AI & risk awareness" },
  { key: "deliveryImplementation", label: "Delivery/implementation" }
];

const PRACTICE_SUGGESTIONS: Record<keyof DimensionScoresInput, string> = {
  promptingFundamentals:
    "Practice rewriting one vague prompt into a structured prompt with context, constraints, and success criteria.",
  workflowAutomation:
    "Build one n8n workflow this week that removes at least one manual handoff.",
  toolSelectionEvaluation:
    "Create a side-by-side scorecard for two AI tools against cost, quality, and security constraints.",
  dataKnowledgeRetrieval:
    "Create a retrieval checklist for source quality, freshness, and citation coverage before answering.",
  responsibleAiRiskAwareness:
    "Run a lightweight risk review on one workflow and document mitigations for privacy and hallucination risk.",
  deliveryImplementation:
    "Ship one pilot with adoption instrumentation and a clear owner for rollout follow-up."
};

const PROJECT_SUGGESTIONS: Record<keyof DimensionScoresInput, string> = {
  promptingFundamentals:
    "Create a reusable prompt library for your team's top 5 recurring tasks.",
  workflowAutomation:
    "Deliver an n8n workflow for intake-to-resolution tracking of automation requests.",
  toolSelectionEvaluation:
    "Lead a two-week tool trial and publish a recommendation memo with acceptance criteria.",
  dataKnowledgeRetrieval:
    "Prototype a mini RAG assistant for one internal policy or process domain.",
  responsibleAiRiskAwareness:
    "Draft a risk decision tree for AI use-cases and train the team using real examples.",
  deliveryImplementation:
    "Ship an end-to-end workflow with onboarding guide, KPI dashboard, and adoption playbook."
};

const DEFAULT_AGENDA_TEMPLATES = [
  "Baseline + goal setting + quick win",
  "Hands-on build tied to live work",
  "Ship + adoption + measurement"
];

const DEFAULT_RUBRIC = {
  levels: {
    0: "No practical use yet",
    1: "Aware of concepts, needs step-by-step support",
    2: "Can execute basic tasks with guidance",
    3: "Independent practitioner on routine work",
    4: "Drives adoption and mentors peers",
    5: "Leads strategy, quality bar, and scale"
  },
  dimensions: DIMENSIONS.map((dimension) => dimension.label)
};

function isWeekend(date: Date) {
  const day = getDay(date);
  return day === 0 || day === 6;
}

function nextBusinessDay(date: Date) {
  let candidate = date;
  while (isWeekend(candidate)) {
    candidate = addDays(candidate, 1);
  }
  return candidate;
}

function parseTags(text: string) {
  const tags = text
    .split(/[\n,;]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/[.]/g, ""))
    .filter((part) => part.length > 2);

  if (tags.length > 0) {
    return Array.from(new Set(tags)).slice(0, 3);
  }

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 4);

  return Array.from(new Set(words)).slice(0, 3);
}

function getTrend(scores: number[]) {
  if (scores.length < 2) return "flat" as const;
  const newest = scores[scores.length - 1];
  const oldest = scores[0];

  if (newest - oldest >= 4) return "improving" as const;
  if (oldest - newest >= 4) return "declining" as const;
  return "flat" as const;
}

function levelForScore(score: number) {
  if (score < 40) return "Beginner";
  if (score < 70) return "Intermediate";
  return "Advanced";
}

function getWeightMap(settings: Awaited<ReturnType<typeof getOrCreateCoachingSettings>>) {
  return {
    promptingFundamentals: settings.promptingFundamentalsWeight,
    workflowAutomation: settings.workflowAutomationWeight,
    toolSelectionEvaluation: settings.toolSelectionEvaluationWeight,
    dataKnowledgeRetrieval: settings.dataKnowledgeRetrievalWeight,
    responsibleAiRiskAwareness: settings.responsibleAiRiskAwarenessWeight,
    deliveryImplementation: settings.deliveryImplementationWeight
  };
}

function toDimensionScores(assessment: ProficiencyAssessment): DimensionScoresInput {
  return {
    promptingFundamentals: assessment.promptingFundamentals,
    workflowAutomation: assessment.workflowAutomation,
    toolSelectionEvaluation: assessment.toolSelectionEvaluation,
    dataKnowledgeRetrieval: assessment.dataKnowledgeRetrieval,
    responsibleAiRiskAwareness: assessment.responsibleAiRiskAwareness,
    deliveryImplementation: assessment.deliveryImplementation
  };
}

function buildSessionAgenda(index: number, enabler: StrategicEnabler) {
  if (index === 0) {
    return [
      "Check-in on recent AI usage and confidence",
      "Review baseline assessment and top two gaps",
      "Set score target and 30-day coaching goals",
      "Define one quick win tied to live work",
      "Align on support needed from manager/stakeholders",
      "Agree on homework and evidence to bring next time"
    ];
  }

  if (index === 1) {
    return [
      "Review homework and obstacles since session 1",
      `Hands-on build for a ${enabler.roleTeam} workflow in n8n/copilot`,
      "Select prompts, tools, and data sources",
      "Implement guardrails and risk checks",
      "Test with real inputs and refine outputs",
      "Commit to shipping milestone before next session"
    ];
  }

  return [
    "Review shipped output and adoption signals",
    "Assess quality, reliability, and stakeholder feedback",
    "Document rollout checklist and owner model",
    "Capture reusable patterns and templates",
    "Define measurement KPIs and reporting rhythm",
    "Plan next 60-day growth path and coaching handoff"
  ];
}

function buildPrepChecklist(index: number) {
  if (index === 0) {
    return [
      "Bring one recent AI output you are proud of",
      "Bring one blocker where AI did not help",
      "List two goals for the next month"
    ];
  }

  if (index === 1) {
    return [
      "Bring access to source tools and data",
      "Bring a concrete workflow to automate",
      "Bring baseline effort/time estimate"
    ];
  }

  return [
    "Bring shipped artifact and usage evidence",
    "Bring feedback from at least one stakeholder",
    "Bring one idea to scale adoption further"
  ];
}

function buildHomework(index: number) {
  if (index === 0) {
    return "Ship one quick-win AI improvement and share evidence links in Slack/Confluence.";
  }

  if (index === 1) {
    return "Finish the hands-on build, test with real data, and document outcome metrics.";
  }

  return "Publish rollout summary with adoption KPI baseline and next-phase recommendations.";
}

function overlaps(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && startB < endA;
}

function findAvailableSlot(input: {
  base: Date;
  durationMinutes: number;
  workingHourStart: number;
  workingHourEnd: number;
  busySlots: Array<{ start: Date; end: Date }>;
}) {
  let candidate = input.base;
  let attempts = 0;

  while (attempts < 160) {
    attempts += 1;
    candidate = nextBusinessDay(candidate);

    if (candidate.getHours() < input.workingHourStart) {
      candidate = setMinutes(setHours(candidate, input.workingHourStart + 1), 0);
    }

    const end = addMinutes(candidate, input.durationMinutes);
    const endMinuteOfDay = end.getHours() * 60 + end.getMinutes();
    const workingEndMinuteOfDay = input.workingHourEnd * 60;
    if (endMinuteOfDay > workingEndMinuteOfDay) {
      candidate = setMinutes(
        setHours(nextBusinessDay(addDays(startOfDay(candidate), 1)), input.workingHourStart + 1),
        0
      );
      continue;
    }

    const hasConflict = input.busySlots.some((busy) =>
      overlaps(candidate, end, busy.start, busy.end)
    );

    if (!hasConflict) {
      return candidate;
    }

    candidate = addHours(candidate, 1);
  }

  return candidate;
}

function findAlternativeSlots(input: {
  startFrom: Date;
  count: number;
  durationMinutes: number;
  workingHourStart: number;
  workingHourEnd: number;
  busySlots: Array<{ start: Date; end: Date }>;
}) {
  const alternatives: Date[] = [];
  let cursor = input.startFrom;

  while (alternatives.length < input.count) {
    const slot = findAvailableSlot({
      base: cursor,
      durationMinutes: input.durationMinutes,
      workingHourStart: input.workingHourStart,
      workingHourEnd: input.workingHourEnd,
      busySlots: input.busySlots
    });

    alternatives.push(slot);
    cursor = addHours(slot, 2);
  }

  return alternatives;
}

export async function getOrCreateCoachingSettings(userId: string) {
  const settings = await prisma.coachingSettings.upsert({
    where: {
      userId
    },
    update: {},
    create: {
      userId,
      rubricJson: DEFAULT_RUBRIC as Prisma.InputJsonValue,
      promptingFundamentalsWeight: 1,
      workflowAutomationWeight: 1,
      toolSelectionEvaluationWeight: 1,
      dataKnowledgeRetrievalWeight: 1,
      responsibleAiRiskAwarenessWeight: 1,
      deliveryImplementationWeight: 1,
      cadenceDefault: CoachingCadence.WEEKLY,
      sessionDurationDefault: 45,
      reminderHoursBefore: 24,
      defaultAgendaTemplates: DEFAULT_AGENDA_TEMPLATES,
      autoConfluenceLog: true,
      autoCreateHomeworkJira: false
    }
  });

  return settings;
}

export function calculateOverallScore(
  scores: DimensionScoresInput,
  settings: Awaited<ReturnType<typeof getOrCreateCoachingSettings>>
) {
  const weights = getWeightMap(settings);

  let weighted = 0;
  let totalWeight = 0;

  for (const dimension of DIMENSIONS) {
    const weight = weights[dimension.key];
    weighted += scores[dimension.key] * weight;
    totalWeight += weight;
  }

  const normalized = totalWeight === 0 ? 0 : weighted / totalWeight;
  return Math.max(0, Math.min(100, Math.round((normalized / 5) * 100)));
}

export async function createStrategicEnabler(input: {
  userId: string;
  name: string;
  roleTeam: string;
  email: string;
  slackHandle: string;
  manager?: string;
  timezone: string;
  notes?: string;
}) {
  return prisma.strategicEnabler.upsert({
    where: {
      userId_email: {
        userId: input.userId,
        email: input.email
      }
    },
    update: {
      name: input.name,
      roleTeam: input.roleTeam,
      slackHandle: input.slackHandle,
      manager: input.manager,
      timezone: input.timezone,
      notes: input.notes
    },
    create: {
      userId: input.userId,
      name: input.name,
      roleTeam: input.roleTeam,
      email: input.email,
      slackHandle: input.slackHandle,
      manager: input.manager,
      timezone: input.timezone,
      notes: input.notes
    }
  });
}

export async function listStrategicEnablers(userId: string, filters: ScoreboardFilters) {
  const enablers = await prisma.strategicEnabler.findMany({
    where: {
      userId,
      ...(filters.team ? { roleTeam: filters.team } : {})
    },
    include: {
      assessments: {
        orderBy: {
          assessmentDate: "asc"
        }
      },
      plans: {
        orderBy: {
          createdDate: "desc"
        },
        take: 1
      },
      sessions: {
        where: {
          status: {
            in: [CoachingSessionStatus.PLANNED, CoachingSessionStatus.RESCHEDULED]
          }
        },
        orderBy: {
          plannedDateTime: "asc"
        },
        take: 1
      }
    },
    orderBy: {
      name: "asc"
    }
  });

  const now = new Date();

  const mapped = enablers.map((enabler) => {
    const latest = enabler.assessments[enabler.assessments.length - 1] ?? null;
    const lastThree = enabler.assessments.slice(-3).map((assessment) => assessment.overallScore);

    const overdue =
      !latest || differenceInCalendarDays(now, latest.assessmentDate) > 30;
    const needsPlan = enabler.plans.length === 0;

    return {
      id: enabler.id,
      name: enabler.name,
      roleTeam: enabler.roleTeam,
      email: enabler.email,
      slackHandle: enabler.slackHandle,
      manager: enabler.manager,
      timezone: enabler.timezone,
      notes: enabler.notes,
      overallScore: latest?.overallScore ?? 0,
      trend: getTrend(lastThree),
      lastThreeScores: lastThree,
      topStrengthTags: latest ? parseTags(latest.strengths) : [],
      topGapTags: latest ? parseTags(latest.gaps) : [],
      nextSessionDate: enabler.sessions[0]?.plannedDateTime ?? null,
      needsPlan,
      overdueAssessment: overdue
    };
  });

  return mapped.filter((item) => {
    if (typeof filters.scoreMin === "number" && item.overallScore < filters.scoreMin) {
      return false;
    }

    if (typeof filters.scoreMax === "number" && item.overallScore > filters.scoreMax) {
      return false;
    }

    if (filters.needsPlan && !item.needsPlan) {
      return false;
    }

    if (filters.overdueAssessment && !item.overdueAssessment) {
      return false;
    }

    return true;
  });
}

export async function getTeamSummary(userId: string) {
  const rows = await listStrategicEnablers(userId, {});
  const scores = rows.map((row) => row.overallScore);

  const averageScore =
    scores.length === 0
      ? 0
      : Math.round(scores.reduce((total, score) => total + score, 0) / scores.length);

  const distribution = {
    Beginner: rows.filter((row) => levelForScore(row.overallScore) === "Beginner").length,
    Intermediate: rows.filter((row) => levelForScore(row.overallScore) === "Intermediate").length,
    Advanced: rows.filter((row) => levelForScore(row.overallScore) === "Advanced").length
  };

  const gapCounts = new Map<string, number>();
  for (const row of rows) {
    for (const tag of row.topGapTags) {
      gapCounts.set(tag, (gapCounts.get(tag) ?? 0) + 1);
    }
  }

  const topCommonGaps = Array.from(gapCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([tag, count]) => ({ tag, count }));

  return {
    averageScore,
    distribution,
    topCommonGaps,
    enablersCount: rows.length
  };
}

export async function getStrategicEnablerProfile(userId: string, strategicEnablerId: string) {
  const enabler = await prisma.strategicEnabler.findFirst({
    where: {
      id: strategicEnablerId,
      userId
    },
    include: {
      assessments: {
        orderBy: {
          assessmentDate: "asc"
        }
      },
      plans: {
        orderBy: {
          createdDate: "desc"
        }
      },
      sessions: {
        orderBy: {
          plannedDateTime: "asc"
        }
      }
    }
  });

  if (!enabler) {
    throw new Error("Strategic enabler not found");
  }

  return enabler;
}

export async function createProficiencyAssessment(input: {
  userId: string;
  strategicEnablerId: string;
  assessmentDate?: string;
  assessor: string;
  scores: DimensionScoresInput;
  evidenceLinks: string[];
  strengths: string;
  gaps: string;
}) {
  const settings = await getOrCreateCoachingSettings(input.userId);
  const overallScore = calculateOverallScore(input.scores, settings);

  const assessment = await prisma.proficiencyAssessment.create({
    data: {
      userId: input.userId,
      strategicEnablerId: input.strategicEnablerId,
      assessmentDate: input.assessmentDate ? new Date(input.assessmentDate) : new Date(),
      assessor: input.assessor,
      overallScore,
      promptingFundamentals: input.scores.promptingFundamentals,
      workflowAutomation: input.scores.workflowAutomation,
      toolSelectionEvaluation: input.scores.toolSelectionEvaluation,
      dataKnowledgeRetrieval: input.scores.dataKnowledgeRetrieval,
      responsibleAiRiskAwareness: input.scores.responsibleAiRiskAwareness,
      deliveryImplementation: input.scores.deliveryImplementation,
      evidenceLinks: input.evidenceLinks,
      strengths: input.strengths,
      gaps: input.gaps
    }
  });

  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: "coaching.assessment.created",
      entityType: "strategic_enabler",
      entityId: input.strategicEnablerId,
      metadata: {
        assessmentId: assessment.id,
        overallScore
      }
    }
  });

  return assessment;
}

export async function generateCoachingPlan(input: {
  userId: string;
  strategicEnablerId: string;
  targetOverallScore?: number;
  focusDimensions?: string[];
}) {
  const enabler = await prisma.strategicEnabler.findFirst({
    where: {
      id: input.strategicEnablerId,
      userId: input.userId
    },
    include: {
      assessments: {
        orderBy: {
          assessmentDate: "desc"
        },
        take: 1
      }
    }
  });

  if (!enabler) {
    throw new Error("Strategic enabler not found");
  }

  const latest = enabler.assessments[0];
  if (!latest) {
    throw new Error("Create an assessment before generating a plan");
  }

  const scores = toDimensionScores(latest);

  const lowestDimensions = DIMENSIONS
    .map((dimension) => ({
      key: dimension.key,
      label: dimension.label,
      score: scores[dimension.key]
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((item) => item.key);

  const validKeys = new Set(DIMENSIONS.map((dimension) => dimension.key));
  const requested = input.focusDimensions?.length
    ? input.focusDimensions
    : lowestDimensions;
  const selected = requested.filter((value): value is keyof DimensionScoresInput =>
    validKeys.has(value as keyof DimensionScoresInput)
  );
  const finalSelection = selected.length > 0 ? selected : lowestDimensions;

  const recommendedPractice = finalSelection.map(
    (dimension) => PRACTICE_SUGGESTIONS[dimension]
  );
  const suggestedProjects = finalSelection
    .map((dimension) => PROJECT_SUGGESTIONS[dimension])
    .slice(0, 5);

  const targetOverallScore =
    input.targetOverallScore ?? Math.min(100, Math.max(60, latest.overallScore + 15));

  const plan = await prisma.coachingPlan.create({
    data: {
      userId: input.userId,
      strategicEnablerId: enabler.id,
      targetOverallScore,
      focusDimensions: finalSelection,
      recommendedPractice,
      suggestedProjects,
      successMetrics:
        "Raise overall score by at least 10 points in 6 weeks, ship one live workflow, and show adoption by at least two stakeholders.",
      resources: [
        "https://n8n.io/workflows",
        "https://platform.openai.com/docs/guides/prompt-engineering",
        "https://www.atlassian.com/software/confluence",
        "https://learn.microsoft.com/microsoftteams"
      ]
    }
  });

  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: "coaching.plan.generated",
      entityType: "strategic_enabler",
      entityId: enabler.id,
      metadata: {
        planId: plan.id,
        targetOverallScore
      }
    }
  });

  return plan;
}

export async function generateCoachingSessions(input: {
  userId: string;
  strategicEnablerId: string;
  count: number;
  cadence?: CoachingCadence;
  durationMinutes?: number;
  startDate?: string;
}) {
  const [enabler, settings, userWithSettings] = await Promise.all([
    prisma.strategicEnabler.findFirst({
      where: {
        id: input.strategicEnablerId,
        userId: input.userId
      }
    }),
    getOrCreateCoachingSettings(input.userId),
    prisma.user.findUnique({
      where: {
        id: input.userId
      },
      include: {
        settings: true
      }
    })
  ]);

  if (!enabler) {
    throw new Error("Strategic enabler not found");
  }

  const durationMinutes = input.durationMinutes ?? settings.sessionDurationDefault;
  const cadence = input.cadence ?? settings.cadenceDefault;
  const cadenceDays = cadence === CoachingCadence.BIWEEKLY ? 14 : 7;

  const workingHourStart = userWithSettings?.settings?.workingHourStart ?? 9;
  const workingHourEnd = userWithSettings?.settings?.workingHourEnd ?? 18;

  const allSessions = await prisma.coachingSession.findMany({
    where: {
      userId: input.userId,
      strategicEnablerId: input.strategicEnablerId
    },
    orderBy: {
      sessionNumber: "asc"
    }
  });

  const activeStatuses: CoachingSessionStatus[] = [
    CoachingSessionStatus.PLANNED,
    CoachingSessionStatus.RESCHEDULED
  ];
  const existingSessions = allSessions.filter((session) =>
    activeStatuses.includes(session.status)
  );

  const [calendarSignals, enablerCalendarSignals] = await Promise.all([
    prisma.activityFeed.findMany({
      where: {
        userId: input.userId,
        source: ActivitySource.OUTLOOK_CALENDAR,
        eventAt: {
          gte: subHours(new Date(), 6)
        }
      },
      take: 200,
      orderBy: {
        eventAt: "asc"
      }
    }),
    prisma.activityFeed.findMany({
      where: {
        userId: input.userId,
        source: ActivitySource.OUTLOOK_CALENDAR,
        OR: [
          { author: { contains: enabler.email, mode: "insensitive" } },
          { title: { contains: enabler.name, mode: "insensitive" } },
          { body: { contains: enabler.name, mode: "insensitive" } }
        ],
        eventAt: {
          gte: subHours(new Date(), 6)
        }
      },
      take: 80
    })
  ]);

  const busySlots: Array<{ start: Date; end: Date }> = [];

  for (const signal of calendarSignals) {
    const start = signal.dueAt ?? signal.eventAt;
    const end = addMinutes(start, 60);
    busySlots.push({ start, end });
  }

  for (const signal of enablerCalendarSignals) {
    const start = signal.dueAt ?? signal.eventAt;
    const end = addMinutes(start, 60);
    busySlots.push({ start, end });
  }

  for (const session of existingSessions) {
    busySlots.push({
      start: session.plannedDateTime,
      end: addMinutes(session.plannedDateTime, session.durationMinutes)
    });
  }

  const baseStart = input.startDate
    ? new Date(input.startDate)
    : setMinutes(setHours(nextBusinessDay(addDays(new Date(), 1)), workingHourStart + 1), 0);

  let startNumber =
    allSessions.length > 0
      ? Math.max(...allSessions.map((session) => session.sessionNumber)) + 1
      : 1;
  const created = [] as Array<{
    id: string;
    sessionNumber: number;
    plannedDateTime: Date;
    durationMinutes: number;
    agenda: string[];
    prepChecklist: string[];
    homeworkAssigned: string;
    status: CoachingSessionStatus;
    alternatives: string[];
  }>;

  for (let index = 0; index < input.count; index += 1) {
    const preferred = addDays(baseStart, cadenceDays * index);
    const slot = findAvailableSlot({
      base: preferred,
      durationMinutes,
      workingHourStart,
      workingHourEnd,
      busySlots
    });

    const templateHint =
      settings.defaultAgendaTemplates[index] ??
      settings.defaultAgendaTemplates[settings.defaultAgendaTemplates.length - 1] ??
      "Coaching focus";
    const agenda = [
      ...buildSessionAgenda(index, enabler),
      `Template focus: ${templateHint}`
    ].slice(0, 7);
    const prepChecklist = buildPrepChecklist(index);
    const homeworkAssigned = buildHomework(index);

    const createdSession = await prisma.coachingSession.create({
      data: {
        userId: input.userId,
        strategicEnablerId: enabler.id,
        sessionNumber: startNumber,
        plannedDateTime: slot,
        durationMinutes,
        agenda,
        prepChecklist,
        homeworkAssigned,
        status: CoachingSessionStatus.PLANNED
      }
    });

    busySlots.push({
      start: slot,
      end: addMinutes(slot, durationMinutes)
    });

    const alternatives = findAlternativeSlots({
      startFrom: addHours(slot, 1),
      count: 2,
      durationMinutes,
      workingHourStart,
      workingHourEnd,
      busySlots
    }).map((date) => date.toISOString());

    created.push({
      id: createdSession.id,
      sessionNumber: createdSession.sessionNumber,
      plannedDateTime: createdSession.plannedDateTime,
      durationMinutes: createdSession.durationMinutes,
      agenda: createdSession.agenda,
      prepChecklist: createdSession.prepChecklist,
      homeworkAssigned: createdSession.homeworkAssigned,
      status: createdSession.status,
      alternatives
    });

    startNumber += 1;
  }

  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: "coaching.sessions.generated",
      entityType: "strategic_enabler",
      entityId: enabler.id,
      metadata: {
        count: created.length,
        cadence,
        durationMinutes
      }
    }
  });

  return created;
}

export async function scheduleSessionsInOutlook(input: {
  userId: string;
  strategicEnablerId: string;
  sessionIds?: string[];
}) {
  const [settings, enabler] = await Promise.all([
    getOrCreateCoachingSettings(input.userId),
    prisma.strategicEnabler.findFirst({
      where: {
        id: input.strategicEnablerId,
        userId: input.userId
      }
    })
  ]);

  if (!enabler) {
    throw new Error("Strategic enabler not found");
  }

  const sessions = await prisma.coachingSession.findMany({
    where: {
      userId: input.userId,
      strategicEnablerId: input.strategicEnablerId,
      ...(input.sessionIds?.length ? { id: { in: input.sessionIds } } : {}),
      status: {
        in: [CoachingSessionStatus.PLANNED, CoachingSessionStatus.RESCHEDULED]
      }
    },
    orderBy: {
      plannedDateTime: "asc"
    }
  });

  const updated = [];

  for (const session of sessions) {
    const reminderAt = subHours(session.plannedDateTime, settings.reminderHoursBefore);

    const reminderJobId = await enqueueCoachingReminder({
      sessionId: session.id,
      userId: input.userId,
      strategicEnablerId: enabler.id,
      strategicEnablerName: enabler.name,
      strategicEnablerSlackHandle: enabler.slackHandle,
      plannedDateTime: session.plannedDateTime,
      reminderAt: reminderAt < new Date() ? new Date() : reminderAt
    });

    const calendarEventId = `outlook-event-${session.id}`;
    const meetingLink = `https://teams.microsoft.com/l/meetup-join/${session.id}`;

    const row = await prisma.coachingSession.update({
      where: {
        id: session.id
      },
      data: {
        calendarEventId,
        meetingLink,
        reminderJobId,
        status: CoachingSessionStatus.PLANNED
      }
    });

    updated.push(row);
  }

  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: "coaching.sessions.scheduled.outlook",
      entityType: "strategic_enabler",
      entityId: enabler.id,
      metadata: {
        sessions: updated.map((session) => ({
          id: session.id,
          sessionNumber: session.sessionNumber,
          plannedDateTime: session.plannedDateTime,
          calendarEventId: session.calendarEventId
        }))
      }
    }
  });

  return updated;
}

export async function completeCoachingSession(input: {
  userId: string;
  sessionId: string;
  outcomeNotes?: string;
  nextSteps?: string;
  homeworkAssigned?: string;
  autoCreateJiraHomework?: boolean;
}) {
  const [settings, session] = await Promise.all([
    getOrCreateCoachingSettings(input.userId),
    prisma.coachingSession.findFirst({
      where: {
        id: input.sessionId,
        userId: input.userId
      },
      include: {
        strategicEnabler: true
      }
    })
  ]);

  if (!session) {
    throw new Error("Session not found");
  }

  const updated = await prisma.coachingSession.update({
    where: {
      id: session.id
    },
    data: {
      status: CoachingSessionStatus.COMPLETED,
      outcomeNotes: input.outcomeNotes,
      nextSteps: input.nextSteps,
      homeworkAssigned: input.homeworkAssigned ?? session.homeworkAssigned
    }
  });

  await enqueuePostSessionAutomation({
    sessionId: session.id,
    userId: input.userId,
    strategicEnablerId: session.strategicEnablerId,
    strategicEnablerName: session.strategicEnabler.name,
    homeworkAssigned: input.homeworkAssigned ?? session.homeworkAssigned,
    plannedDateTime: session.plannedDateTime,
    autoConfluenceLog: settings.autoConfluenceLog,
    autoCreateHomeworkJira:
      input.autoCreateJiraHomework ?? settings.autoCreateHomeworkJira
  });

  return updated;
}

export function recalculateOverallFromScores(input: {
  settings: Awaited<ReturnType<typeof getOrCreateCoachingSettings>>;
  scores: DimensionScoresInput;
}) {
  return calculateOverallScore(input.scores, input.settings);
}

export async function updateCoachingSettings(
  userId: string,
  payload: {
    rubricJson: Prisma.InputJsonValue;
    promptingFundamentalsWeight: number;
    workflowAutomationWeight: number;
    toolSelectionEvaluationWeight: number;
    dataKnowledgeRetrievalWeight: number;
    responsibleAiRiskAwarenessWeight: number;
    deliveryImplementationWeight: number;
    cadenceDefault: CoachingCadence;
    sessionDurationDefault: number;
    reminderHoursBefore: number;
    defaultAgendaTemplates: string[];
    autoConfluenceLog: boolean;
    autoCreateHomeworkJira: boolean;
  }
) {
  return prisma.coachingSettings.upsert({
    where: {
      userId
    },
    update: payload,
    create: {
      userId,
      ...payload
    }
  });
}

export async function runPostSessionAutomation(payload: {
  userId: string;
  sessionId: string;
  strategicEnablerId: string;
  strategicEnablerName: string;
  homeworkAssigned: string;
  plannedDateTime: Date;
  autoCreateHomeworkJira: boolean;
  autoConfluenceLog: boolean;
}) {
  if (payload.autoConfluenceLog) {
    await prisma.auditLog.create({
      data: {
        userId: payload.userId,
        action: "coaching.post_session.confluence_template",
        entityType: "strategic_enabler",
        entityId: payload.strategicEnablerId,
        metadata: {
          sessionId: payload.sessionId,
          title: `Coaching Session ${payload.sessionId}`,
          template: [
            "## Session Summary",
            "## Outcomes",
            "## Homework",
            "## Next Steps"
          ]
        }
      }
    });
  }

  if (payload.autoCreateHomeworkJira) {
    const dueAt = addDays(new Date(), 7);

    await prisma.activityFeed.create({
      data: {
        userId: payload.userId,
        source: ActivitySource.JIRA,
        sourceId: `coaching-homework-${payload.sessionId}-${randomUUID()}`,
        title: `Homework task for ${payload.strategicEnablerName}`,
        body: payload.homeworkAssigned,
        url: "https://example.atlassian.net/jira/software/projects/AI/boards/1",
        author: "Work OS",
        dueAt,
        eventAt: new Date(),
        metadata: {
          kind: "coaching-homework",
          sessionId: payload.sessionId
        },
        isUnread: true,
        isFlagged: false,
        isMention: false,
        isDm: false,
        isStarred: false
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: payload.userId,
        action: "coaching.post_session.jira_homework",
        entityType: "strategic_enabler",
        entityId: payload.strategicEnablerId,
        metadata: {
          sessionId: payload.sessionId,
          dueAt
        }
      }
    });
  }
}
