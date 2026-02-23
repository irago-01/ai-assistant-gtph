import { randomUUID } from "node:crypto";
import { Provider } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { buildOAuthUrl } from "@/lib/integrations";
import { resolveRequestOrigin } from "@/lib/request-origin";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> }
) {
  const params = await context.params;
  const provider = params.provider.toUpperCase() as Provider;

  if (!["SLACK", "MICROSOFT", "ATLASSIAN"].includes(provider)) {
    return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
  }

  const state = request.nextUrl.searchParams.get("state") ?? randomUUID();

  try {
    const requestOrigin = resolveRequestOrigin(request);
    const url = buildOAuthUrl(provider, state, {
      requestOrigin
    });
    return NextResponse.redirect(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "OAuth setup error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
