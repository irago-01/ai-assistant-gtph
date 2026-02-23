import { formatISO } from "date-fns";

import { prisma } from "@/lib/prisma";

export async function getKeywordRules(userId: string) {
  return prisma.confluenceKeywordRule.findMany({
    where: { userId },
    orderBy: { keyword: "asc" }
  });
}

export async function addConfluenceRule(
  userId: string,
  payload: { keyword: string; pageUrl: string; title: string; description: string }
) {
  return prisma.confluenceKeywordRule.upsert({
    where: {
      userId_keyword: {
        userId,
        keyword: payload.keyword
      }
    },
    update: {
      pageUrl: payload.pageUrl,
      title: payload.title,
      description: payload.description
    },
    create: {
      userId,
      keyword: payload.keyword,
      pageUrl: payload.pageUrl,
      title: payload.title,
      description: payload.description
    }
  });
}

export async function deleteConfluenceRule(userId: string, keyword: string) {
  return prisma.confluenceKeywordRule.delete({
    where: {
      userId_keyword: {
        userId,
        keyword
      }
    }
  });
}

export async function appendApprovalToConfluenceSection(input: {
  userId: string;
  issueKey: string;
  issueUrl: string;
  summary: string;
  requester: string;
  decision: "APPROVE" | "REJECT";
  confluencePage: string;
}) {
  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: "confluence.approval.update",
      entityType: "confluence_page",
      entityId: input.confluencePage,
      metadata: {
        issueKey: input.issueKey,
        issueUrl: input.issueUrl,
        summary: input.summary,
        requester: input.requester,
        decision: input.decision,
        date: formatISO(new Date())
      }
    }
  });
}
