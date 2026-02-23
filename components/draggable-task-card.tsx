"use client";

import { useDraggable } from '@dnd-kit/core';
import { ActivitySource, BoardColumn } from '@prisma/client';

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

export function DraggableTaskCard({ task, onMarkDone }: {
  task: Task;
  onMarkDone: (id: string) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grabbing',
  } : { cursor: 'grab' };

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="task-card"
    >
      <h4>{task.title}</h4>
      <div className="task-meta">
        <span className="badge">{task.source}</span>
        <span className="badge">{task.effortMinutes} min</span>
        <span className="badge">{Math.round(task.confidence * 100)}%</span>
        {task.dueAt && <span className="badge">Due: {new Date(task.dueAt).toLocaleDateString()}</span>}
      </div>
      <p className="task-why">{task.why}</p>
      <div className="task-actions">
        {task.link && (
          <a href={task.link} target="_blank" rel="noopener noreferrer">
            Open
          </a>
        )}
        <button onClick={() => onMarkDone(task.id)}>Mark done</button>
      </div>
    </article>
  );
}
