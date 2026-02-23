import { getCurrentUser } from "@/lib/auth";
import { ok, serverError } from "@/lib/http";
import { getPendingApprovals } from "@/lib/jira";

export async function GET() {
  try {
    const user = await getCurrentUser();
    const requests = await getPendingApprovals(user.id);

    return ok({ requests });
  } catch (error) {
    return serverError(error);
  }
}
