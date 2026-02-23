import { NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { generateSlackPostWithAI } from "@/lib/ai-slack-generator";
import { ok, serverError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { slackGenerateSchema } from "@/lib/schemas";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const payload = await request.json();
    const parsed = slackGenerateSchema.parse(payload);

    // Use AI to generate engaging Slack message with emojis
    const generated = await generateSlackPostWithAI(parsed.topic, parsed.tone);

    const draft = await prisma.slackDraft.create({
      data: {
        userId: user.id,
        topic: parsed.topic,
        tone: parsed.tone,
        content: generated.message,
        ctaSuggestions: generated.ctas,
        status: "DRAFT"
      }
    });

    return ok({
      draft,
      ctas: generated.ctas
    });
  } catch (error) {
    return serverError(error);
  }
}
