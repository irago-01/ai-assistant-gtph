import { DraftTone } from "@prisma/client";
import { z } from "zod";

export const generateBoardSchema = z.object({
  windowHours: z.number().int().min(24).max(24 * 30).default(24 * 30)
});

export const demoGenerateSchema = z.object({
  themes: z
    .array(
      z.object({
        name: z.string().min(2),
        audience: z.string().min(2),
        tags: z.array(z.string().min(1)).min(1)
      })
    )
    .optional(),
  includeRecentTasks: z.boolean().default(true),
  trendingKeywords: z.array(z.string()).default([])
});

export const confluenceSearchSchema = z.object({
  keyword: z.string().min(1),
  limit: z.number().int().min(5).max(15).default(10)
});

export const confluenceRuleSchema = z.object({
  keyword: z.string().min(1),
  pageUrl: z.string().url(),
  title: z.string().min(1),
  description: z.string()
});

export const slackGenerateSchema = z.object({
  topic: z.string().min(2),
  tone: z.nativeEnum(DraftTone)
});

export const slackScheduleSchema = z.object({
  draftId: z.string().min(1),
  channels: z.array(z.string().min(1)).min(1),
  scheduledFor: z.string().datetime(),
  recurrence: z.string().optional(),
  approvalRequired: z.boolean().default(true)
});

export const jiraDecisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  comment: z.string().optional(),
  confluencePage: z.string().min(1)
});

export const settingsSchema = z.object({
  keyChannels: z.array(z.string()),
  keyPeople: z.array(z.string()),
  execSenders: z.array(z.string()),
  keywords: z.array(z.string()),
  workingHourStart: z.number().int().min(0).max(23),
  workingHourEnd: z.number().int().min(1).max(24),
  taskMin: z.number().int().min(3).max(30),
  taskMax: z.number().int().min(5).max(40),
  slackWeight: z.number().min(0).max(1),
  emailWeight: z.number().min(0).max(1),
  calendarWeight: z.number().min(0).max(1)
});

export const strategicEnablerCreateSchema = z.object({
  name: z.string().min(2),
  roleTeam: z.string().min(2),
  email: z.string().email(),
  slackHandle: z.string().min(1),
  manager: z.string().optional(),
  timezone: z.string().min(2),
  notes: z.string().optional()
});

export const coachingAssessmentSchema = z.object({
  assessmentDate: z.string().datetime().optional(),
  assessor: z.string().min(1).default("me"),
  promptingFundamentals: z.number().int().min(0).max(5),
  workflowAutomation: z.number().int().min(0).max(5),
  toolSelectionEvaluation: z.number().int().min(0).max(5),
  dataKnowledgeRetrieval: z.number().int().min(0).max(5),
  responsibleAiRiskAwareness: z.number().int().min(0).max(5),
  deliveryImplementation: z.number().int().min(0).max(5),
  evidenceLinks: z.array(z.string()).default([]),
  strengths: z.string().default(""),
  gaps: z.string().default("")
});

export const coachingPlanGenerateSchema = z.object({
  targetOverallScore: z.number().int().min(20).max(100).optional(),
  focusDimensions: z.array(z.string()).optional()
});

export const coachingPlanUpdateSchema = z.object({
  targetOverallScore: z.number().int().min(20).max(100),
  focusDimensions: z.array(z.string()),
  recommendedPractice: z.array(z.string()),
  suggestedProjects: z.array(z.string()).min(1).max(5),
  successMetrics: z.string().min(3),
  resources: z.array(z.string())
});

export const coachingSessionGenerateSchema = z.object({
  count: z.number().int().min(2).max(3).default(3),
  cadence: z.enum(["WEEKLY", "BIWEEKLY"]).optional(),
  durationMinutes: z.number().int().min(20).max(90).optional(),
  startDate: z.string().datetime().optional()
});

export const coachingScheduleSchema = z.object({
  sessionIds: z.array(z.string()).optional()
});

export const coachingSessionCompleteSchema = z.object({
  outcomeNotes: z.string().optional(),
  nextSteps: z.string().optional(),
  homeworkAssigned: z.string().optional(),
  autoCreateJiraHomework: z.boolean().optional()
});

export const coachingSettingsSchema = z.object({
  rubricJson: z.record(z.any()),
  promptingFundamentalsWeight: z.number().positive(),
  workflowAutomationWeight: z.number().positive(),
  toolSelectionEvaluationWeight: z.number().positive(),
  dataKnowledgeRetrievalWeight: z.number().positive(),
  responsibleAiRiskAwarenessWeight: z.number().positive(),
  deliveryImplementationWeight: z.number().positive(),
  cadenceDefault: z.enum(["WEEKLY", "BIWEEKLY"]),
  sessionDurationDefault: z.number().int().min(20).max(90),
  reminderHoursBefore: z.number().int().min(1).max(72),
  defaultAgendaTemplates: z.array(z.string()).min(1),
  autoConfluenceLog: z.boolean(),
  autoCreateHomeworkJira: z.boolean()
});
