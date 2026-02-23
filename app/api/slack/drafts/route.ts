import { NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { ok, serverError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getCurrentUser();
    const drafts = await prisma.slackDraft.findMany({
      where: {
        userId: user.id
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 50
    });

    return ok({ drafts });
  } catch (error) {
    return serverError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const payload = await request.json();

    if (!payload.id || typeof payload.id !== "string") {
      throw new Error("Draft id is required");
    }

    const existing = await prisma.slackDraft.findFirst({
      where: {
        id: payload.id,
        userId: user.id
      }
    });

    if (!existing) {
      throw new Error("Draft not found");
    }

    const draft = await prisma.slackDraft.update({
      where: { id: existing.id },
      data: {
        content: typeof payload.content === "string" ? payload.content : undefined,
        channels: Array.isArray(payload.channels) ? payload.channels : undefined,
        approvalRequired:
          typeof payload.approvalRequired === "boolean"
            ? payload.approvalRequired
            : undefined
      }
    });

    return ok({ draft });
  } catch (error) {
    return serverError(error);
  }
}
