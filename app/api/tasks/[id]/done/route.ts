import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  const params = await context.params;

  const task = await prisma.taskCard.findFirst({
    where: {
      id: params.id,
      userId: user.id
    }
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const updated = await prisma.taskCard.update({
    where: { id: params.id },
    data: {
      column: "DONE",
      status: "done"
    }
  });

  return NextResponse.json({ task: updated });
}
