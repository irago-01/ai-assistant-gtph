import { getCurrentUser } from "@/lib/auth";
import { ok, serverError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getCurrentUser();
    const latestBatch = await prisma.demoTopic.findMany({
      where: {
        userId: user.id
      },
      orderBy: [{ generatedAt: "desc" }, { rank: "asc" }],
      take: 15
    });

    return ok({ topics: latestBatch });
  } catch (error) {
    return serverError(error);
  }
}
