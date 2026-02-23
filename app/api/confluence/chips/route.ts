import { NextRequest } from "next/server";

import {
  addConfluenceRule,
  deleteConfluenceRule,
  getKeywordRules
} from "@/lib/confluence";
import { getCurrentUser } from "@/lib/auth";
import { badRequest, ok, serverError } from "@/lib/http";
import { confluenceRuleSchema } from "@/lib/schemas";

export async function GET() {
  try {
    const user = await getCurrentUser();
    const rules = await getKeywordRules(user.id);

    return ok({ rules });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const payload = await request.json();

    // Validate required fields
    if (!payload.keyword || !payload.pageUrl || !payload.title || !payload.description) {
      return badRequest("keyword, pageUrl, title, and description are required");
    }

    const parsed = confluenceRuleSchema.parse(payload);
    const rule = await addConfluenceRule(user.id, parsed);
    return ok({ rule }, 201);
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const payload = await request.json().catch(() => ({}));

    if (!payload.keyword || typeof payload.keyword !== "string") {
      return badRequest("keyword is required");
    }

    await deleteConfluenceRule(user.id, payload.keyword);
    return ok({ success: true });
  } catch (error) {
    return serverError(error);
  }
}
