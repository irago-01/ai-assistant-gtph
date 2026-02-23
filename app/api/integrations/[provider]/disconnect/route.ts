import { Provider } from "@prisma/client";
import { NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { disconnectProvider } from "@/lib/integrations";
import { badRequest, ok, serverError } from "@/lib/http";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ provider: string }> }
) {
  try {
    const params = await context.params;
    const provider = params.provider.toUpperCase() as Provider;

    if (!["SLACK", "MICROSOFT", "ATLASSIAN"].includes(provider)) {
      return badRequest("Unsupported provider");
    }

    const user = await getCurrentUser();
    await disconnectProvider(user.id, provider);
    return ok({ disconnected: true });
  } catch (error) {
    return serverError(error);
  }
}
