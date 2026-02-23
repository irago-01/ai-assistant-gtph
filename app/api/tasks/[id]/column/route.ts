import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { BoardColumn } from "@prisma/client";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await context.params;
    const { column } = await request.json();

    // Validate column
    if (!['NOW', 'NEXT', 'WAITING', 'DONE'].includes(column)) {
      return NextResponse.json({ error: "Invalid column" }, { status: 400 });
    }

    // Find task and verify ownership
    const task = await prisma.taskCard.findFirst({
      where: { id: params.id, userId: user.id }
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Update column (and status if moved to DONE)
    const updated = await prisma.taskCard.update({
      where: { id: params.id },
      data: {
        column: column as BoardColumn,
        ...(column === 'DONE' && { status: 'done' })
      }
    });

    return NextResponse.json({ task: updated });
  } catch (error) {
    console.error('Error updating task column:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
