"use client";

import { DraftTone } from "@prisma/client";
import { CalendarClock, SendHorizontal, Sparkles } from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { PageShell } from "@/components/page-shell";
import { apiFetch } from "@/lib/client-api";

type Draft = {
  id: string;
  topic: string;
  tone: DraftTone;
  content: string;
  ctaSuggestions: string[];
  approvalRequired: boolean;
  channels: string[];
  scheduledFor: string | null;
  recurrence: string | null;
  status: "DRAFT" | "SCHEDULED" | "SENT" | "NEEDS_APPROVAL";
  createdAt: string;
};

const DEFAULT_TOPICS = [
  "Weekly automation update",
  "AI policy reminder",
  "Live demo invitation",
  "Workflow rollout summary",
  "Internal enablement tip"
];

function SlackStudioContent() {
  const params = useSearchParams();

  const [topicPreset, setTopicPreset] = useState(DEFAULT_TOPICS[0]);
  const [topicText, setTopicText] = useState(params.get("topic") ?? "");
  const [tone, setTone] = useState<DraftTone>("INFORMATIVE");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string>("");
  const [channelsInput, setChannelsInput] = useState("#ai-enablement,#automation-requests");
  const [scheduledAt, setScheduledAt] = useState("");
  const [recurrence, setRecurrence] = useState("");
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedDraft = useMemo(
    () => drafts.find((draft) => draft.id === selectedDraftId) ?? null,
    [drafts, selectedDraftId]
  );

  async function loadDrafts() {
    const data = await apiFetch<{ drafts: Draft[] }>("/api/slack/drafts");
    setDrafts(data.drafts);
    if (!selectedDraftId && data.drafts.length > 0) {
      setSelectedDraftId(data.drafts[0].id);
    }
  }

  useEffect(() => {
    loadDrafts().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load drafts")
    );
  }, []);

  useEffect(() => {
    if (!selectedDraft) return;
    setChannelsInput(selectedDraft.channels.join(",") || "#ai-enablement");
    setScheduledAt(
      selectedDraft.scheduledFor
        ? new Date(selectedDraft.scheduledFor).toISOString().slice(0, 16)
        : ""
    );
    setRecurrence(selectedDraft.recurrence ?? "");
    setApprovalRequired(selectedDraft.approvalRequired);
  }, [selectedDraft?.id]);

  async function generate() {
    try {
      setLoading(true);
      setError(null);
      const topic = topicText.trim() || topicPreset;

      const data = await apiFetch<{ draft: Draft }>("/api/slack/generate", {
        method: "POST",
        body: JSON.stringify({
          topic,
          tone
        })
      });

      await loadDrafts();
      setSelectedDraftId(data.draft.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate post");
    } finally {
      setLoading(false);
    }
  }

  async function saveDraft() {
    if (!selectedDraft) return;
    try {
      setError(null);
      await apiFetch("/api/slack/drafts", {
        method: "PUT",
        body: JSON.stringify({
          id: selectedDraft.id,
          content: selectedDraft.content,
          channels: channelsInput
            .split(",")
            .map((channel) => channel.trim())
            .filter(Boolean),
          approvalRequired
        })
      });
      await loadDrafts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save draft");
    }
  }

  async function schedule() {
    if (!selectedDraft) return;
    try {
      setLoading(true);
      setError(null);

      const channels = channelsInput
        .split(",")
        .map((channel) => channel.trim())
        .filter(Boolean);

      await apiFetch("/api/slack/drafts", {
        method: "PUT",
        body: JSON.stringify({
          id: selectedDraft.id,
          content: selectedDraft.content,
          channels,
          approvalRequired
        })
      });

      await apiFetch("/api/slack/schedule", {
        method: "POST",
        body: JSON.stringify({
          draftId: selectedDraft.id,
          channels,
          scheduledFor: new Date(scheduledAt).toISOString(),
          recurrence: recurrence || undefined,
          approvalRequired
        })
      });

      await loadDrafts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule post");
    } finally {
      setLoading(false);
    }
  }

  function updateDraftContent(content: string) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === selectedDraftId
          ? {
              ...draft,
              content
            }
          : draft
      )
    );
  }

  return (
    <PageShell>
      <h1 className="page-title">Slack Studio</h1>
      <p className="page-subtitle">
        AI-powered Slack message generator with emojis and engaging CTAs. Keep approvals on by default, then schedule by channel/date/time with optional recurrence.
      </p>

      <div className="grid-2">
        <section className="card">
          <h2 className="card-title">AI Post Generator</h2>
          <p className="card-subtitle">Generate engaging Slack messages with relevant emojis and CTAs</p>
          <div className="stack">
            <div>
              <label className="label">Topic Preset</label>
              <select
                className="select"
                value={topicPreset}
                onChange={(event) => setTopicPreset(event.target.value)}
              >
                {DEFAULT_TOPICS.map((topic) => (
                  <option key={topic} value={topic}>
                    {topic}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Or write your own topic</label>
              <input
                className="input"
                value={topicText}
                onChange={(event) => setTopicText(event.target.value)}
              />
            </div>

            <div>
              <label className="label">Tone</label>
              <select
                className="select"
                value={tone}
                onChange={(event) => setTone(event.target.value as DraftTone)}
              >
                <option value="INFORMATIVE">Informative</option>
                <option value="EXCITED">Excited</option>
                <option value="EXECUTIVE_SUMMARY">Executive summary</option>
                <option value="CASUAL">Casual</option>
              </select>
            </div>

            <button className="btn primary" onClick={generate} disabled={loading}>
              <Sparkles size={16} style={{ marginRight: 6 }} />
              {loading ? "Generating..." : "Generate Post"}
            </button>
          </div>
        </section>

        <section className="card">
          <h2 className="card-title">Drafts and Scheduled History</h2>
          <div className="stack">
            {drafts.map((draft) => (
              <button
                key={draft.id}
                className={`tag ${draft.id === selectedDraftId ? "active" : ""}`}
                onClick={() => setSelectedDraftId(draft.id)}
              >
                {draft.topic} ({draft.status})
              </button>
            ))}
            {!drafts.length ? (
              <p className="muted">No drafts yet. Generate your first post.</p>
            ) : null}
          </div>
        </section>
      </div>

      <section className="card" style={{ marginTop: 14 }}>
        <h2 className="card-title">Output Editor</h2>
        <p className="card-subtitle">Edit message format, CTA, and scheduling controls.</p>

        {selectedDraft ? (
          <div className="grid-2">
            <div className="stack">
              <div>
                <label className="label">Slack Message</label>
                <textarea
                  className="textarea"
                  value={selectedDraft.content}
                  onChange={(event) => updateDraftContent(event.target.value)}
                />
              </div>

              <div>
                <label className="label">CTA Suggestions</label>
                <div className="chips">
                  {selectedDraft.ctaSuggestions.map((cta) => (
                    <span className="pill" key={cta}>
                      {cta}
                    </span>
                  ))}
                </div>
              </div>

              <div className="row">
                <button className="btn" onClick={saveDraft}>
                  Save Draft
                </button>
              </div>
            </div>

            <div className="stack">
              <div>
                <label className="label">Channels (comma separated)</label>
                <input
                  className="input"
                  value={channelsInput}
                  onChange={(event) => setChannelsInput(event.target.value)}
                />
              </div>

              <div>
                <label className="label">Date + Time</label>
                <input
                  className="input"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(event) => setScheduledAt(event.target.value)}
                />
              </div>

              <div>
                <label className="label">Recurrence (optional)</label>
                <input
                  className="input"
                  placeholder="e.g. Weekly Tuesdays 9:00"
                  value={recurrence}
                  onChange={(event) => setRecurrence(event.target.value)}
                />
              </div>

              <label className="row" style={{ gap: 8 }}>
                <input
                  type="checkbox"
                  checked={approvalRequired}
                  onChange={(event) => setApprovalRequired(event.target.checked)}
                />
                Require my approval before posting (default ON)
              </label>

              <button className="btn primary" onClick={schedule} disabled={loading || !scheduledAt}>
                <CalendarClock size={16} style={{ marginRight: 6 }} />
                Schedule Post
              </button>

              <div className="notice">
                Draft status: <strong>{selectedDraft.status}</strong>
              </div>
            </div>
          </div>
        ) : (
          <p className="muted">Select or generate a draft to edit and schedule.</p>
        )}

        {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : null}
      </section>

      <section className="card" style={{ marginTop: 14 }}>
        <h2 className="card-title">How It Works</h2>
        <div className="notice">
          ✨ AI generates engaging Slack messages with relevant emojis, proper formatting (*bold*, _italic_), and compelling CTAs based on your topic and tone preferences.
        </div>
        <ul style={{ marginTop: 10, marginBottom: 10 }}>
          <li>Messages are optimized for Slack engagement</li>
          <li>Scheduling writes to the queue; posts only after approval if enabled</li>
          <li>Edit generated content before scheduling</li>
        </ul>
        <div className="row">
          <SendHorizontal size={15} />
          <span className="muted">Connected channels and posting scopes are managed in Settings.</span>
        </div>
      </section>
    </PageShell>
  );
}

export default function SlackStudioPage() {
  return (
    <Suspense fallback={<PageShell><p>Loading...</p></PageShell>}>
      <SlackStudioContent />
    </Suspense>
  );
}
