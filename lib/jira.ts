import { ApprovalDecision } from "@prisma/client";

import { appendApprovalToConfluenceSection } from "@/lib/confluence";
import { prisma } from "@/lib/prisma";

export async function getPendingApprovals(userId: string) {
  return prisma.jiraRequest.findMany({
    where: {
      userId,
      pendingApproval: true
    },
    orderBy: {
      createdDate: "desc"
    }
  });
}

export async function decideOnRequest(input: {
  userId: string;
  requestId: string;
  decision: ApprovalDecision;
  comment?: string;
  confluencePage: string;
}) {
  const request = await prisma.jiraRequest.findFirst({
    where: {
      id: input.requestId,
      userId: input.userId
    }
  });

  if (!request) {
    throw new Error("Request not found");
  }

  const status = input.decision === "APPROVE" ? "Approved" : "Rejected";

  const [updatedRequest, action] = await prisma.$transaction([
    prisma.jiraRequest.update({
      where: { id: input.requestId },
      data: {
        status,
        pendingApproval: false
      }
    }),
    prisma.approvalAction.create({
      data: {
        userId: input.userId,
        jiraRequestId: input.requestId,
        decision: input.decision,
        comment: input.comment,
        confluencePage: input.confluencePage
      }
    })
  ]);

  await appendApprovalToConfluenceSection({
    userId: input.userId,
    issueKey: request.issueKey,
    issueUrl: request.issueUrl,
    summary: request.summary,
    requester: request.requester,
    decision: input.decision,
    confluencePage: input.confluencePage
  });

  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: "jira.approval.decision",
      entityType: "jira_issue",
      entityId: request.issueKey,
      metadata: {
        decision: input.decision,
        comment: input.comment
      }
    }
  });

  return { updatedRequest, action };
}

export async function getApprovalAudit(userId: string) {
  return prisma.approvalAction.findMany({
    where: { userId },
    orderBy: {
      actedAt: "desc"
    },
    include: {
      jiraRequest: true
    },
    take: 50
  });
}
