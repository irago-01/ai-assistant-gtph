import { Provider } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { connectProviderWithCode, resolveAppBaseUrl } from "@/lib/integrations";
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

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "Authorization code missing" }, { status: 400 });
  }

  try {
    const requestOrigin = resolveRequestOrigin(request);
    const user = await getCurrentUser();
    await connectProviderWithCode({
      userId: user.id,
      provider,
      code,
      requestOrigin
    });

    const appBaseUrl = resolveAppBaseUrl(requestOrigin);

    return NextResponse.redirect(
      `${appBaseUrl}/setup?connected=${provider.toLowerCase()}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "OAuth callback error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
