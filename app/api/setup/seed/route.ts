import { NextResponse } from "next/server";
import { CoachingCadence, CoachingSessionStatus } from "@prisma/client";
import { addDays } from "date-fns";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getKeywordRules } from "@/lib/confluence";

export async function POST() {
  const user = await getCurrentUser();
  const now = new Date();

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
        createdDate: new Date(Date.now() - 1000 * 60 * 60 * 20)
      },
      {
        userId: user.id,
        issueKey: "AI-138",
        issueUrl: "https://example.atlassian.net/browse/AI-138",
        summary: "Pilot RAG-based support assistant for HR",
        requester: "lee.adams@company.com",
        priority: "Medium",
        status: "Awaiting Approval",
        createdDate: new Date(Date.now() - 1000 * 60 * 60 * 30)
      }
    ],
    skipDuplicates: true
  });

  await getKeywordRules(user.id);

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

  const seededEnabler = await prisma.strategicEnabler.upsert({
    where: {
      userId_email: {
        userId: user.id,
        email: "riley.chen@company.com"
      }
    },
    update: {},
    create: {
      userId: user.id,
      name: "Riley Chen",
      roleTeam: "Customer Success",
      email: "riley.chen@company.com",
      slackHandle: "@riley",
      manager: "maria.jones@company.com",
      timezone: "America/Los_Angeles",
      notes: "Strong stakeholder communication, improving workflow automation depth."
    }
  });

  const existingAssessment = await prisma.proficiencyAssessment.findFirst({
    where: {
      userId: user.id,
      strategicEnablerId: seededEnabler.id
    }
  });

  if (!existingAssessment) {
    await prisma.proficiencyAssessment.create({
      data: {
        userId: user.id,
        strategicEnablerId: seededEnabler.id,
        assessmentDate: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 14),
        assessor: "me",
        overallScore: 55,
        promptingFundamentals: 3,
        workflowAutomation: 2,
        toolSelectionEvaluation: 3,
        dataKnowledgeRetrieval: 2,
        responsibleAiRiskAwareness: 3,
        deliveryImplementation: 3,
        evidenceLinks: ["https://slack.com/app_redirect?channel=ai-enablement"],
        strengths: "communication, prompt clarity",
        gaps: "automation design, rollout measurement"
      }
    });
  }

  await prisma.coachingSession.createMany({
    data: [
      {
        userId: user.id,
        strategicEnablerId: seededEnabler.id,
        sessionNumber: 1,
        plannedDateTime: addDays(now, 4),
        durationMinutes: 45,
        agenda: [
          "Baseline review",
          "Goal setting",
          "Quick win",
          "Support alignment",
          "Homework assignment"
        ],
        prepChecklist: [
          "Bring one AI success",
          "Bring one blocker",
          "Bring one target outcome"
        ],
        homeworkAssigned: "Ship one quick win and capture evidence links.",
        status: CoachingSessionStatus.PLANNED
      }
    ],
    skipDuplicates: true
  });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      setupWizardCompleted: true
    }
  });

  return NextResponse.json({ success: true });
}
