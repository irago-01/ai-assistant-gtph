"use client";

import { useDroppable } from '@dnd-kit/core';
import { ActivitySource, BoardColumn } from '@prisma/client';
import { DraggableTaskCard } from './draggable-task-card';

type Task = {
  id: string;
  title: string;
  source: ActivitySource;
  effortMinutes: number;
  dueAt: string | null;
  column: BoardColumn;
  link: string | null;
  confidence: number;
  why: string;
  status: string;
};

export function DroppableKanbanColumn({
  column,
  tasks,
  onMarkDone
}: {
  column: BoardColumn;
  tasks: Task[];
  onMarkDone: (id: string) => Promise<void>;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column,
  });

  return (
    <section
      ref={setNodeRef}
      className={`kanban-col ${isOver ? 'kanban-col-over' : ''}`}
    >
      <h3>
        {column} ({tasks.length})
      </h3>
      {tasks.map((task) => (
        <DraggableTaskCard key={task.id} task={task} onMarkDone={onMarkDone} />
      ))}
    </section>
  );
}
