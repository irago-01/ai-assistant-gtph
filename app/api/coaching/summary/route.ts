import { getCurrentUser } from "@/lib/auth";
import { getTeamSummary } from "@/lib/coaching";
import { ok, serverError } from "@/lib/http";

export async function GET() {
  try {
    const user = await getCurrentUser();
    const summary = await getTeamSummary(user.id);
    return ok({ summary });
  } catch (error) {
    return serverError(error);
  }
}
