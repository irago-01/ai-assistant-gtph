import { getAnalyticsSummary } from "@/lib/analytics";
import { getCurrentUser } from "@/lib/auth";
import { ok, serverError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getCurrentUser();
    const latest = await prisma.taskBoard.findFirst({
      where: {
        userId: user.id
      },
      include: {
        tasks: {
          orderBy: {
            confidence: "desc"
          }
        }
      },
      orderBy: {
        generatedAt: "desc"
      }
    });

    const analytics = await getAnalyticsSummary(user.id);

    return ok({
      board: latest,
      analytics
    });
  } catch (error) {
    return serverError(error);
  }
}
