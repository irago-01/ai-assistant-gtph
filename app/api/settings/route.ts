import { NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { ok, serverError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { settingsSchema } from "@/lib/schemas";

export async function GET() {
  try {
    const user = await getCurrentUser();

    return ok({ settings: user.settings });
  } catch (error) {
    return serverError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const payload = await request.json();
    const parsed = settingsSchema.parse(payload);

    const total = parsed.slackWeight + parsed.emailWeight + parsed.calendarWeight;
    if (Math.abs(total - 1) > 0.01) {
      throw new Error("Weighting sliders must sum to 1.0");
    }

    const settings = await prisma.userSettings.upsert({
      where: {
        userId: user.id
      },
      update: parsed,
      create: {
        userId: user.id,
        ...parsed
      }
    });

    return ok({ settings });
  } catch (error) {
    return serverError(error);
  }
}
