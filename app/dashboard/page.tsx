"use client";

import { ActivitySource, BoardColumn } from "@prisma/client";
import { Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DndContext, DragEndEvent, closestCorners } from '@dnd-kit/core';

import { PageShell } from "@/components/page-shell";
import { apiFetch } from "@/lib/client-api";
import { DroppableKanbanColumn } from "@/components/droppable-kanban-column";

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

type DashboardResponse = {
  board: {
    id: string;
    generatedAt: string;
    tasks: Task[];
  } | null;
  analytics: {
    timeSavedMinutes: number;
    tasksGenerated: number;
    postsScheduled: number;
  };
};

const COLUMNS: BoardColumn[] = ["NOW", "NEXT", "WAITING", "DONE"];

export default function DashboardPage() {
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<DashboardResponse | null>(null);
  const [windowHours, setWindowHours] = useState(24 * 30);
  const [error, setError] = useState<string | null>(null);

  async function loadLatest() {
    try {
      const data = await apiFetch<DashboardResponse>("/api/dashboard/latest");
      setState(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load board");
    }
  }

  useEffect(() => {
    void loadLatest();
  }, []);

  async function generateBoard() {
    try {
      setLoading(true);
      setError(null);
      await apiFetch("/api/dashboard/generate", {
        method: "POST",
        body: JSON.stringify({ windowHours })
      });
      await loadLatest();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate board");
    } finally {
      setLoading(false);
    }
  }

  async function markDone(taskId: string) {
    try {
      await apiFetch(`/api/tasks/${taskId}/done`, {
        method: "POST"
      });
      await loadLatest();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task");
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const taskId = active.id as string;
    const newColumn = over.id as BoardColumn;

    // Optimistic update
    setState(prev => {
      if (!prev?.board?.tasks) return prev;
      return {
        ...prev,
        board: {
          ...prev.board,
          tasks: prev.board.tasks.map(task =>
            task.id === taskId ? { ...task, column: newColumn } : task
          )
        }
      };
    });

    // API call
    try {
      const res = await fetch(`/api/tasks/${taskId}/column`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ column: newColumn })
      });

      if (!res.ok) throw new Error('Failed to update task');
    } catch (err) {
      console.error('Failed to move task:', err);
      setError('Failed to move task');
      await loadLatest(); // Revert on error
    }
  }

  const grouped = useMemo(() => {
    const base: Record<BoardColumn, Task[]> = {
      NOW: [],
      NEXT: [],
      WAITING: [],
      DONE: []
    };

    for (const task of state?.board?.tasks ?? []) {
      base[task.column].push(task);
    }

    return base;
  }, [state?.board?.tasks]);

  return (
    <PageShell>
      <h1 className="page-title">Today in One Button</h1>
      <p className="page-subtitle">
        Build your critical board from Slack mentions, Outlook schedule/email signals, and Jira approvals in one click.
      </p>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="row">
          <button className="btn primary" disabled={loading} onClick={generateBoard}>
            <Zap size={16} style={{ marginRight: 6 }} />
            {loading ? "Generating..." : "Generate Today's Board"}
          </button>

          <label className="label" style={{ margin: 0 }}>
            Signal window
            <select
              className="select"
              style={{ width: 130, marginLeft: 6 }}
              value={windowHours}
              onChange={(event) => setWindowHours(Number(event.target.value))}
            >
              <option value={24 * 7}>7 days</option>
              <option value={24 * 14}>14 days</option>
              <option value={24 * 30}>30 days</option>
            </select>
          </label>

          <div className="spacer" />
          <Link className="btn" href="/settings">
            Prioritization Settings
          </Link>
        </div>
        {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : null}
      </div>

      <div className="metrics" style={{ marginBottom: 14 }}>
        <div className="metric">
          <div className="metric-label">Time Saved (mins)</div>
          <div className="metric-value">{state?.analytics.timeSavedMinutes ?? 0}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Tasks Generated</div>
          <div className="metric-value">{state?.analytics.tasksGenerated ?? 0}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Posts Scheduled</div>
          <div className="metric-value">{state?.analytics.postsScheduled ?? 0}</div>
        </div>
      </div>

      <DndContext
        collisionDetection={closestCorners}
        onDragEnd={handleDragEnd}
      >
        <div className="kanban">
          {COLUMNS.map((column) => (
            <DroppableKanbanColumn
              key={column}
              column={column}
              tasks={grouped[column]}
              onMarkDone={markDone}
            />
          ))}
        </div>
      </DndContext>

      {state?.board && state.board.tasks.length === 0 ? (
        <div className="card" style={{ marginTop: 12 }}>
          <p style={{ margin: 0 }}>
            No DM or mention tasks found for this window. Send a direct message or tag yourself in Slack (for example: <code>@you</code>), then generate again.
          </p>
        </div>
      ) : null}
    </PageShell>
  );
}
