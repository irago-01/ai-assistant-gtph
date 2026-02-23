import { NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { ok, serverError } from "@/lib/http";
import { decideOnRequest } from "@/lib/jira";
import { jiraDecisionSchema } from "@/lib/schemas";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const payload = await request.json();
    const parsed = jiraDecisionSchema.parse(payload);
    const params = await context.params;

    const result = await decideOnRequest({
      userId: user.id,
      requestId: params.id,
      decision: parsed.decision,
      comment: parsed.comment,
      confluencePage: parsed.confluencePage
    });

    return ok(result);
  } catch (error) {
    return serverError(error);
  }
}
