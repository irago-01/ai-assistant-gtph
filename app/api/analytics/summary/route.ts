import { getAnalyticsSummary } from "@/lib/analytics";
import { getCurrentUser } from "@/lib/auth";
import { ok, serverError } from "@/lib/http";

export async function GET() {
  try {
    const user = await getCurrentUser();
    const summary = await getAnalyticsSummary(user.id);
    return ok({ summary });
  } catch (error) {
    return serverError(error);
  }
}
