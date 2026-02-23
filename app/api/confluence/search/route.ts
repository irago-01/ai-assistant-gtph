import { NextRequest } from "next/server";

import { searchConfluenceByKeyword } from "@/lib/confluence";
import { getCurrentUser } from "@/lib/auth";
import { ok, serverError } from "@/lib/http";
import { confluenceSearchSchema } from "@/lib/schemas";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const payload = await request.json();
    const parsed = confluenceSearchSchema.parse(payload);

    const results = await searchConfluenceByKeyword(
      user.id,
      parsed.keyword,
      parsed.limit
    );

    return ok({ results });
  } catch (error) {
    return serverError(error);
  }
}
