import { NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { generateDemoTopicsWithAI } from "@/lib/ai-demo-generator";
import { generateWeeklyDemoTopics } from "@/lib/demo-generator";
import { ok, serverError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const payload = await request.json().catch(() => ({}));

    const keywords = Array.isArray(payload.keywords) ? payload.keywords : [];
    const useAI = payload.useAI === true;

    // Fetch recent messages for AI analysis
    const recentMessages = await prisma.activityFeed.findMany({
      where: {
        userId: user.id
      },
      orderBy: {
        eventAt: "desc"
      },
      take: 20
    });

    let topics;

    if (useAI) {
      // Use AI to generate topics from messages and keywords
      topics = await generateDemoTopicsWithAI(recentMessages, keywords);
    } else {
      // Use simple keyword-based generation
      const themes = keywords.map((keyword: string) => ({
        name: keyword,
        audience: "General audience",
        tags: [keyword.toLowerCase()]
      }));
      topics = generateWeeklyDemoTopics(themes, [], keywords);
    }

    // Delete old topics for this user
    await prisma.demoTopic.deleteMany({
      where: { userId: user.id }
    });

    // Save new topics
    await prisma.demoTopic.createMany({
      data: topics.map((topic, index) => ({
        userId: user.id,
        title: topic.title,
        outline: topic.outline,
        targetAudience: topic.targetAudience,
        prepMinutes: topic.prepMinutes,
        tags: topic.tags,
        rank: index + 1
      }))
    });

    return ok({ topics });
  } catch (error) {
    return serverError(error);
  }
}
