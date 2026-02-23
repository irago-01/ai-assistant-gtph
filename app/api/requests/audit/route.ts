import { getCurrentUser } from "@/lib/auth";
import { ok, serverError } from "@/lib/http";
import { getApprovalAudit } from "@/lib/jira";

export async function GET() {
  try {
    const user = await getCurrentUser();
    const actions = await getApprovalAudit(user.id);

    return ok({ actions });
  } catch (error) {
    return serverError(error);
  }
}
