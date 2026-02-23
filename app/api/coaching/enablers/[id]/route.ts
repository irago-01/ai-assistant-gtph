import { getCurrentUser } from "@/lib/auth";
import { getStrategicEnablerProfile } from "@/lib/coaching";
import { ok, serverError } from "@/lib/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const params = await context.params;

    const profile = await getStrategicEnablerProfile(user.id, params.id);
    return ok({ profile });
  } catch (error) {
    return serverError(error);
  }
}
