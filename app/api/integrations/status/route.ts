import { getCurrentUser } from "@/lib/auth";
import { ok, serverError } from "@/lib/http";
import { getIntegrationStatuses } from "@/lib/integrations";

export async function GET() {
  try {
    const user = await getCurrentUser();
    const integrations = await getIntegrationStatuses(user.id);
    return ok({ integrations });
  } catch (error) {
    return serverError(error);
  }
}
