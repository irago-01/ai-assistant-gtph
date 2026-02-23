import {
  ActivitySource,
  CoachingCadence,
  CoachingSessionStatus,
  ConnectionStatus,
  DraftTone,
  DraftStatus,
  PrismaClient,
  Provider
} from "@prisma/client";
import { addDays, subHours } from "date-fns";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.DEMO_USER_EMAIL ?? "owner@workos.local";

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: "Work OS Owner",
      roleTitle: "AI Enablement and Automation Lead"
    },
    create: {
      email,
      name: "Work OS Owner",
      roleTitle: "AI Enablement and Automation Lead"
    }
  });

  await prisma.userSettings.upsert({
    where: {
      userId: user.id
    },
    update: {
      keyChannels: ["#ai-enablement", "#automation-requests", "#leadership-sync"],
      keyPeople: ["vp-product@company.com", "head-of-ops@company.com"],
      execSenders: ["ceo@company.com", "cto@company.com", "cfo@company.com"],
      keywords: ["ASAP", "urgent", "EOD", "blocking", "today"],
      workingHourStart: 9,
      workingHourEnd: 18,
      taskMin: 8,
      taskMax: 20,
      slackWeight: 0.4,
      emailWeight: 0.35,
      calendarWeight: 0.25
    },
    create: {
      userId: user.id,
      keyChannels: ["#ai-enablement", "#automation-requests", "#leadership-sync"],
      keyPeople: ["vp-product@company.com", "head-of-ops@company.com"],
      execSenders: ["ceo@company.com", "cto@company.com", "cfo@company.com"],
      keywords: ["ASAP", "urgent", "EOD", "blocking", "today"],
      workingHourStart: 9,
      workingHourEnd: 18,
      taskMin: 8,
      taskMax: 20,
      slackWeight: 0.4,
      emailWeight: 0.35,
      calendarWeight: 0.25
    }
  });

  for (const provider of [Provider.SLACK, Provider.MICROSOFT, Provider.ATLASSIAN]) {
    await prisma.integrationConnection.upsert({
      where: {
        userId_provider: {
          userId: user.id,
          provider
        }
      },
      update: {
        status: ConnectionStatus.DISCONNECTED,
        scopes: []
      },
      create: {
        userId: user.id,
        provider,
        status: ConnectionStatus.DISCONNECTED,
        scopes: []
      }
    });
  }

  const now = new Date();

  const activities = [
    {
      source: ActivitySource.SLACK,
      sourceId: "seed-slack-1",
      title: "ASAP: finalize automation request reply",
      body: "Mentioned in #automation-requests for EOD response.",
      url: "https://slack.com/app_redirect?channel=automation-requests",
      author: "vp-product@company.com",
      channel: "#automation-requests",
      dueAt: subHours(now, -3),
      eventAt: subHours(now, 2),
      isMention: true,
      isDm: false,
      isFlagged: true,
      isUnread: true,
      isStarred: true
    },
    {
      source: ActivitySource.OUTLOOK_EMAIL,
      sourceId: "seed-email-1",
      title: "Urgent: approve AI policy exception",
      body: "Request from legal pending by end of day.",
      url: "https://outlook.office.com/mail",
      author: "ceo@company.com",
      channel: null,
      dueAt: subHours(now, -5),
      eventAt: subHours(now, 4),
      isMention: false,
      isDm: false,
      isFlagged: true,
      isUnread: true,
      isStarred: false
    },
    {
      source: ActivitySource.OUTLOOK_CALENDAR,
      sourceId: "seed-calendar-1",
      title: "Prepare notes for automation steering committee",
      body: "Meeting at 3:00 PM with CTO and Ops.",
      url: "https://outlook.office.com/calendar",
      author: "calendar",
      channel: null,
      dueAt: subHours(now, -6),
      eventAt: subHours(now, 1),
      isMention: false,
      isDm: false,
      isFlagged: false,
      isUnread: false,
      isStarred: false
    }
  ];

  for (const item of activities) {
    const exists = await prisma.activityFeed.findFirst({
      where: {
        userId: user.id,
        source: item.source,
        sourceId: item.sourceId
      }
    });

    if (!exists) {
      await prisma.activityFeed.create({
        data: {
          userId: user.id,
          source: item.source,
          sourceId: item.sourceId,
          title: item.title,
          body: item.body,
          url: item.url,
          author: item.author,
          channel: item.channel,
          dueAt: item.dueAt,
          eventAt: item.eventAt,
          isMention: item.isMention,
          isDm: item.isDm,
          isFlagged: item.isFlagged,
          isUnread: item.isUnread,
          isStarred: item.isStarred
        }
      });
    }
  }

  const existingRequest = await prisma.jiraRequest.findFirst({
    where: {
      userId: user.id,
      issueKey: "AI-142"
    }
  });

  if (!existingRequest) {
    await prisma.jiraRequest.createMany({
      data: [
        {
          userId: user.id,
          issueKey: "AI-142",
          issueUrl: "https://example.atlassian.net/browse/AI-142",
          summary: "Automate onboarding access request triage",
          requester: "jane.miller@company.com",
          priority: "High",
          status: "Awaiting Approval",
          createdDate: subHours(now, 20),
          pendingApproval: true
        },
        {
          userId: user.id,
          issueKey: "AI-138",
          issueUrl: "https://example.atlassian.net/browse/AI-138",
          summary: "Pilot RAG-based support assistant for HR",
          requester: "lee.adams@company.com",
          priority: "Medium",
          status: "Awaiting Approval",
          createdDate: subHours(now, 30),
          pendingApproval: true
        }
      ]
    });
  }

  const existingDraft = await prisma.slackDraft.findFirst({
    where: {
      userId: user.id,
      topic: "Weekly automation update"
    }
  });

  if (!existingDraft) {
    await prisma.slackDraft.create({
      data: {
        userId: user.id,
        topic: "Weekly automation update",
        tone: DraftTone.INFORMATIVE,
        content:
          "*Update: Weekly automation progress*\n\n- 3 new workflows launched\n- 11 manual steps removed\n- Next focus: request approvals\n\nLink: <insert-link>",
        ctaSuggestions: [
          "Reply with your top blocker.",
          "Add your team use-case for next week."
        ],
        channels: ["#ai-enablement"],
        status: DraftStatus.DRAFT
      }
    });
  }

  await prisma.coachingSettings.upsert({
    where: {
      userId: user.id
    },
    update: {},
    create: {
      userId: user.id,
      rubricJson: {
        levels: {
          0: "No practical use yet",
          1: "Aware of concepts, needs support",
          2: "Can execute basic tasks with guidance",
          3: "Independent on routine work",
          4: "Drives adoption and mentors peers",
          5: "Leads strategy and scale"
        }
      },
      promptingFundamentalsWeight: 1,
      workflowAutomationWeight: 1.2,
      toolSelectionEvaluationWeight: 1,
      dataKnowledgeRetrievalWeight: 1,
      responsibleAiRiskAwarenessWeight: 1,
      deliveryImplementationWeight: 1.2,
      cadenceDefault: CoachingCadence.WEEKLY,
      sessionDurationDefault: 45,
      reminderHoursBefore: 24,
      defaultAgendaTemplates: [
        "Baseline + goal setting + quick win",
        "Hands-on build tied to live work",
        "Ship + adoption + measurement"
      ],
      autoConfluenceLog: true,
      autoCreateHomeworkJira: false
    }
  });

  const enablers = [
    {
      name: "Riley Chen",
      roleTeam: "Customer Success",
      email: "riley.chen@company.com",
      slackHandle: "@riley",
      manager: "maria.jones@company.com",
      timezone: "America/Los_Angeles",
      notes: "Strong stakeholder communication, needs more automation depth."
    },
    {
      name: "Avery Patel",
      roleTeam: "Operations",
      email: "avery.patel@company.com",
      slackHandle: "@avery",
      manager: "kiran.bose@company.com",
      timezone: "America/Chicago",
      notes: "Good at workflows, improve risk framing and rollout documentation."
    }
  ];

  for (const enabler of enablers) {
    await prisma.strategicEnabler.upsert({
      where: {
        userId_email: {
          userId: user.id,
          email: enabler.email
        }
      },
      update: {
        name: enabler.name,
        roleTeam: enabler.roleTeam,
        slackHandle: enabler.slackHandle,
        manager: enabler.manager,
        timezone: enabler.timezone,
        notes: enabler.notes
      },
      create: {
        userId: user.id,
        name: enabler.name,
        roleTeam: enabler.roleTeam,
        email: enabler.email,
        slackHandle: enabler.slackHandle,
        manager: enabler.manager,
        timezone: enabler.timezone,
        notes: enabler.notes
      }
    });
  }

  const strategicEnablers = await prisma.strategicEnabler.findMany({
    where: {
      userId: user.id
    }
  });

  for (const enabler of strategicEnablers) {
    const hasAssessment = await prisma.proficiencyAssessment.findFirst({
      where: {
        userId: user.id,
        strategicEnablerId: enabler.id
      }
    });

    if (!hasAssessment) {
      await prisma.proficiencyAssessment.createMany({
        data: [
          {
            userId: user.id,
            strategicEnablerId: enabler.id,
            assessmentDate: subHours(now, 24 * 30),
            assessor: "me",
            overallScore: 48,
            promptingFundamentals: 2,
            workflowAutomation: 2,
            toolSelectionEvaluation: 3,
            dataKnowledgeRetrieval: 2,
            responsibleAiRiskAwareness: 3,
            deliveryImplementation: 2,
            evidenceLinks: ["https://slack.com/app_redirect?channel=ai-enablement"],
            strengths: "communication, stakeholder context",
            gaps: "automation design, implementation speed"
          },
          {
            userId: user.id,
            strategicEnablerId: enabler.id,
            assessmentDate: subHours(now, 24 * 10),
            assessor: "me",
            overallScore: 58,
            promptingFundamentals: 3,
            workflowAutomation: 3,
            toolSelectionEvaluation: 3,
            dataKnowledgeRetrieval: 3,
            responsibleAiRiskAwareness: 3,
            deliveryImplementation: 3,
            evidenceLinks: ["https://example.atlassian.net/wiki/spaces/OPS"],
            strengths: "prompt structure, team facilitation",
            gaps: "shipping cadence, measurement rigor"
          }
        ]
      });
    }

    const hasPlan = await prisma.coachingPlan.findFirst({
      where: {
        userId: user.id,
        strategicEnablerId: enabler.id
      }
    });

    if (!hasPlan) {
      await prisma.coachingPlan.create({
        data: {
          userId: user.id,
          strategicEnablerId: enabler.id,
          targetOverallScore: 72,
          focusDimensions: ["workflowAutomation", "deliveryImplementation"],
          recommendedPractice: [
            "Build one live n8n workflow tied to your weekly responsibilities.",
            "Run a short retrospective after each AI-enabled delivery."
          ],
          suggestedProjects: [
            "Automation intake-to-resolution board for your team",
            "Playbook for prompt templates and QA checks"
          ],
          successMetrics:
            "Increase overall score by 10+ points and ship two measurable workflow improvements.",
          resources: [
            "https://n8n.io/workflows",
            "https://platform.openai.com/docs/guides/prompt-engineering"
          ]
        }
      });
    }

    const hasSessions = await prisma.coachingSession.findFirst({
      where: {
        userId: user.id,
        strategicEnablerId: enabler.id
      }
    });

    if (!hasSessions) {
      await prisma.coachingSession.createMany({
        data: [
          {
            userId: user.id,
            strategicEnablerId: enabler.id,
            sessionNumber: 1,
            plannedDateTime: addDays(now, 3),
            durationMinutes: 45,
            agenda: [
              "Baseline review",
              "Goal setting",
              "Quick win definition",
              "Support alignment",
              "Homework assignment"
            ],
            prepChecklist: [
              "Bring one successful AI example",
              "Bring one blocker",
              "Bring one desired outcome"
            ],
            homeworkAssigned:
              "Ship one quick-win AI improvement and share evidence in Confluence.",
            status: CoachingSessionStatus.PLANNED
          },
          {
            userId: user.id,
            strategicEnablerId: enabler.id,
            sessionNumber: 2,
            plannedDateTime: addDays(now, 10),
            durationMinutes: 45,
            agenda: [
              "Hands-on workflow build",
              "Tool selection",
              "Risk checks",
              "Validation against live cases",
              "Ship plan"
            ],
            prepChecklist: [
              "Bring real workflow to automate",
              "Bring baseline effort estimate",
              "Bring available data inputs"
            ],
            homeworkAssigned:
              "Complete workflow build and capture before/after impact metrics.",
            status: CoachingSessionStatus.PLANNED
          }
        ],
        skipDuplicates: true
      });
    }
  }

  console.log("Seed complete for", user.email);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
