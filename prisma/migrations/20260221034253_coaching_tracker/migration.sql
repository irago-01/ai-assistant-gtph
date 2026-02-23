-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('SLACK', 'MICROSOFT', 'ATLASSIAN');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "ActivitySource" AS ENUM ('SLACK', 'OUTLOOK_EMAIL', 'OUTLOOK_CALENDAR', 'JIRA', 'MANUAL');

-- CreateEnum
CREATE TYPE "BoardColumn" AS ENUM ('NOW', 'NEXT', 'WAITING', 'DONE');

-- CreateEnum
CREATE TYPE "DraftTone" AS ENUM ('INFORMATIVE', 'EXCITED', 'EXECUTIVE_SUMMARY', 'CASUAL');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENT', 'NEEDS_APPROVAL');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVE', 'REJECT');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('TASKS_GENERATED', 'TIME_SAVED', 'POST_SCHEDULED');

-- CreateEnum
CREATE TYPE "CoachingSessionStatus" AS ENUM ('PLANNED', 'COMPLETED', 'RESCHEDULED', 'CANCELED');

-- CreateEnum
CREATE TYPE "CoachingCadence" AS ENUM ('WEEKLY', 'BIWEEKLY');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roleTitle" TEXT NOT NULL DEFAULT 'AI Enablement and Automation Lead',
    "timezone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "setupWizardCompleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "accountId" TEXT,
    "accountName" TEXT,
    "scopes" TEXT[],
    "encryptedAccessToken" TEXT,
    "encryptedRefreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keyChannels" TEXT[],
    "keyPeople" TEXT[],
    "execSenders" TEXT[],
    "keywords" TEXT[],
    "workingHourStart" INTEGER NOT NULL DEFAULT 9,
    "workingHourEnd" INTEGER NOT NULL DEFAULT 18,
    "taskMin" INTEGER NOT NULL DEFAULT 8,
    "taskMax" INTEGER NOT NULL DEFAULT 20,
    "slackWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
    "emailWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.35,
    "calendarWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityFeed" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "ActivitySource" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "url" TEXT,
    "author" TEXT,
    "channel" TEXT,
    "priorityHint" DOUBLE PRECISION,
    "dueAt" TIMESTAMP(3),
    "eventAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "isUnread" BOOLEAN NOT NULL DEFAULT false,
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "isMention" BOOLEAN NOT NULL DEFAULT false,
    "isDm" BOOLEAN NOT NULL DEFAULT false,
    "isStarred" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityFeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskBoard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "totalTasks" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TaskBoard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskCard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" "ActivitySource" NOT NULL,
    "effortMinutes" INTEGER NOT NULL,
    "dueAt" TIMESTAMP(3),
    "column" "BoardColumn" NOT NULL DEFAULT 'NEXT',
    "link" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "why" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemoTopic" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "outline" TEXT[],
    "targetAudience" TEXT NOT NULL,
    "prepMinutes" INTEGER NOT NULL,
    "tags" TEXT[],
    "rank" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemoTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfluenceKeywordRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "labels" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfluenceKeywordRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfluenceResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "snippet" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfluenceResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlackDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "tone" "DraftTone" NOT NULL,
    "content" TEXT NOT NULL,
    "ctaSuggestions" TEXT[],
    "approvalRequired" BOOLEAN NOT NULL DEFAULT true,
    "channels" TEXT[],
    "scheduledFor" TIMESTAMP(3),
    "recurrence" TEXT,
    "status" "DraftStatus" NOT NULL DEFAULT 'DRAFT',
    "queueJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlackDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JiraRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "issueKey" TEXT NOT NULL,
    "issueUrl" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "requester" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdDate" TIMESTAMP(3) NOT NULL,
    "pendingApproval" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JiraRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalAction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jiraRequestId" TEXT NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "comment" TEXT,
    "actedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confluencePage" TEXT NOT NULL,

    CONSTRAINT "ApprovalAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" "EventType" NOT NULL,
    "numericValue" DOUBLE PRECISION NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategicEnabler" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roleTeam" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "slackHandle" TEXT NOT NULL,
    "manager" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrategicEnabler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProficiencyAssessment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "strategicEnablerId" TEXT NOT NULL,
    "assessmentDate" TIMESTAMP(3) NOT NULL,
    "assessor" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "promptingFundamentals" INTEGER NOT NULL,
    "workflowAutomation" INTEGER NOT NULL,
    "toolSelectionEvaluation" INTEGER NOT NULL,
    "dataKnowledgeRetrieval" INTEGER NOT NULL,
    "responsibleAiRiskAwareness" INTEGER NOT NULL,
    "deliveryImplementation" INTEGER NOT NULL,
    "evidenceLinks" TEXT[],
    "strengths" TEXT NOT NULL,
    "gaps" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProficiencyAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachingPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "strategicEnablerId" TEXT NOT NULL,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "targetOverallScore" INTEGER NOT NULL,
    "focusDimensions" TEXT[],
    "recommendedPractice" TEXT[],
    "suggestedProjects" TEXT[],
    "successMetrics" TEXT NOT NULL,
    "resources" TEXT[],

    CONSTRAINT "CoachingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachingSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "strategicEnablerId" TEXT NOT NULL,
    "sessionNumber" INTEGER NOT NULL,
    "plannedDateTime" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 45,
    "agenda" TEXT[],
    "prepChecklist" TEXT[],
    "homeworkAssigned" TEXT NOT NULL,
    "outcomeNotes" TEXT,
    "nextSteps" TEXT,
    "status" "CoachingSessionStatus" NOT NULL DEFAULT 'PLANNED',
    "calendarEventId" TEXT,
    "meetingLink" TEXT,
    "reminderJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachingSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rubricJson" JSONB NOT NULL,
    "promptingFundamentalsWeight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "workflowAutomationWeight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "toolSelectionEvaluationWeight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "dataKnowledgeRetrievalWeight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "responsibleAiRiskAwarenessWeight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "deliveryImplementationWeight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "cadenceDefault" "CoachingCadence" NOT NULL DEFAULT 'WEEKLY',
    "sessionDurationDefault" INTEGER NOT NULL DEFAULT 45,
    "reminderHoursBefore" INTEGER NOT NULL DEFAULT 24,
    "defaultAgendaTemplates" TEXT[],
    "autoConfluenceLog" BOOLEAN NOT NULL DEFAULT true,
    "autoCreateHomeworkJira" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConnection_userId_provider_key" ON "IntegrationConnection"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE INDEX "ActivityFeed_userId_eventAt_idx" ON "ActivityFeed"("userId", "eventAt");

-- CreateIndex
CREATE INDEX "ActivityFeed_userId_source_idx" ON "ActivityFeed"("userId", "source");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityFeed_userId_source_sourceId_key" ON "ActivityFeed"("userId", "source", "sourceId");

-- CreateIndex
CREATE INDEX "TaskBoard_userId_generatedAt_idx" ON "TaskBoard"("userId", "generatedAt");

-- CreateIndex
CREATE INDEX "TaskCard_boardId_column_idx" ON "TaskCard"("boardId", "column");

-- CreateIndex
CREATE INDEX "DemoTopic_userId_generatedAt_idx" ON "DemoTopic"("userId", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConfluenceKeywordRule_userId_keyword_key" ON "ConfluenceKeywordRule"("userId", "keyword");

-- CreateIndex
CREATE INDEX "ConfluenceResult_userId_keyword_idx" ON "ConfluenceResult"("userId", "keyword");

-- CreateIndex
CREATE UNIQUE INDEX "ConfluenceResult_userId_keyword_pageId_key" ON "ConfluenceResult"("userId", "keyword", "pageId");

-- CreateIndex
CREATE INDEX "SlackDraft_userId_status_idx" ON "SlackDraft"("userId", "status");

-- CreateIndex
CREATE INDEX "JiraRequest_userId_pendingApproval_idx" ON "JiraRequest"("userId", "pendingApproval");

-- CreateIndex
CREATE UNIQUE INDEX "JiraRequest_userId_issueKey_key" ON "JiraRequest"("userId", "issueKey");

-- CreateIndex
CREATE INDEX "ApprovalAction_userId_actedAt_idx" ON "ApprovalAction"("userId", "actedAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_userId_eventType_createdAt_idx" ON "AnalyticsEvent"("userId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "StrategicEnabler_userId_roleTeam_idx" ON "StrategicEnabler"("userId", "roleTeam");

-- CreateIndex
CREATE UNIQUE INDEX "StrategicEnabler_userId_email_key" ON "StrategicEnabler"("userId", "email");

-- CreateIndex
CREATE INDEX "ProficiencyAssessment_userId_assessmentDate_idx" ON "ProficiencyAssessment"("userId", "assessmentDate");

-- CreateIndex
CREATE INDEX "ProficiencyAssessment_strategicEnablerId_assessmentDate_idx" ON "ProficiencyAssessment"("strategicEnablerId", "assessmentDate");

-- CreateIndex
CREATE INDEX "CoachingPlan_userId_createdDate_idx" ON "CoachingPlan"("userId", "createdDate");

-- CreateIndex
CREATE INDEX "CoachingPlan_strategicEnablerId_createdDate_idx" ON "CoachingPlan"("strategicEnablerId", "createdDate");

-- CreateIndex
CREATE INDEX "CoachingSession_userId_status_plannedDateTime_idx" ON "CoachingSession"("userId", "status", "plannedDateTime");

-- CreateIndex
CREATE UNIQUE INDEX "CoachingSession_strategicEnablerId_sessionNumber_key" ON "CoachingSession"("strategicEnablerId", "sessionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CoachingSettings_userId_key" ON "CoachingSettings"("userId");

-- AddForeignKey
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityFeed" ADD CONSTRAINT "ActivityFeed_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskBoard" ADD CONSTRAINT "TaskBoard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskCard" ADD CONSTRAINT "TaskCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskCard" ADD CONSTRAINT "TaskCard_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "TaskBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemoTopic" ADD CONSTRAINT "DemoTopic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfluenceKeywordRule" ADD CONSTRAINT "ConfluenceKeywordRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfluenceResult" ADD CONSTRAINT "ConfluenceResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlackDraft" ADD CONSTRAINT "SlackDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JiraRequest" ADD CONSTRAINT "JiraRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalAction" ADD CONSTRAINT "ApprovalAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalAction" ADD CONSTRAINT "ApprovalAction_jiraRequestId_fkey" FOREIGN KEY ("jiraRequestId") REFERENCES "JiraRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategicEnabler" ADD CONSTRAINT "StrategicEnabler_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProficiencyAssessment" ADD CONSTRAINT "ProficiencyAssessment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProficiencyAssessment" ADD CONSTRAINT "ProficiencyAssessment_strategicEnablerId_fkey" FOREIGN KEY ("strategicEnablerId") REFERENCES "StrategicEnabler"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachingPlan" ADD CONSTRAINT "CoachingPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachingPlan" ADD CONSTRAINT "CoachingPlan_strategicEnablerId_fkey" FOREIGN KEY ("strategicEnablerId") REFERENCES "StrategicEnabler"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachingSession" ADD CONSTRAINT "CoachingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachingSession" ADD CONSTRAINT "CoachingSession_strategicEnablerId_fkey" FOREIGN KEY ("strategicEnablerId") REFERENCES "StrategicEnabler"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachingSettings" ADD CONSTRAINT "CoachingSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
