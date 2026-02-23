"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { PageShell } from "@/components/page-shell";
import { apiFetch } from "@/lib/client-api";

type Topic = {
  id?: string;
  title: string;
  outline: string[];
  targetAudience: string;
  prepMinutes: number;
  tags: string[];
};

type LatestResponse = {
  topics: Topic[];
};

export default function LiveDemoPlannerPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [keywordInput, setKeywordInput] = useState("AI tools, Rovo, n8n workflows, automation");
  const [useAI, setUseAI] = useState(true);

  async function loadLatest() {
    try {
      const data = await apiFetch<LatestResponse>("/api/demo-planner/latest");
      setTopics(data.topics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load topics");
    }
  }

  useEffect(() => {
    void loadLatest();
  }, []);

  async function generate() {
    try {
      setLoading(true);
      setError(null);

      const keywords = keywordInput
        .split(",")
        .map((keyword) => keyword.trim())
        .filter(Boolean);

      const data = await apiFetch<LatestResponse>("/api/demo-planner/generate", {
        method: "POST",
        body: JSON.stringify({
          keywords,
          useAI
        })
      });

      setTopics(data.topics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate topics");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell>
      <h1 className="page-title">Live Demo Planner</h1>
      <p className="page-subtitle">
        Generate weekly demo topics from configurable themes, recent work signals, and trending internal questions.
      </p>

      <div className="grid-2">
        <section className="card">
          <h2 className="card-title">Generator Inputs</h2>
          <p className="card-subtitle">Enter topics or keywords separated by commas (e.g., "AI tools, Rovo, n8n")</p>

          <div className="stack">
            <div>
              <label className="label">Topics / Keywords</label>
              <input
                className="input"
                placeholder="AI tools, automation, n8n workflows, Rovo"
                value={keywordInput}
                onChange={(event) => setKeywordInput(event.target.value)}
              />
            </div>

            <div>
              <label className="label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={useAI}
                  onChange={(event) => setUseAI(event.target.checked)}
                />
                Use AI to analyze recent messages and generate suggestions
              </label>
            </div>

            <button className="btn primary" disabled={loading} onClick={generate}>
              <Sparkles size={16} style={{ marginRight: 6 }} />
              {loading ? "Generating..." : "Generate Demo Topics"}
            </button>
          </div>
          {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : null}
        </section>

        <section className="card">
          <h2 className="card-title">How It Works</h2>
          <p className="card-subtitle">AI-powered demo topic generation</p>
          <ul style={{ marginTop: 0 }}>
            <li><strong>With AI:</strong> Analyzes your recent Slack messages and creates relevant demo topics based on actual work requests</li>
            <li><strong>Manual Mode:</strong> Generates demo topics directly from your keywords (perfect for quick topic brainstorming)</li>
            <li><strong>Combined:</strong> Uses both your keywords and recent messages for best results</li>
          </ul>
        </section>
      </div>

      <section className="card" style={{ marginTop: 14 }}>
        <h2 className="card-title">Ranked Topics ({topics.length})</h2>
        <p className="card-subtitle">Top 10-15 ideas with prep time and tags.</p>

        <div className="stack">
          {topics.map((topic, index) => (
            <article key={`${topic.title}-${index}`} className="card" style={{ boxShadow: "none" }}>
              <div className="row">
                <strong>
                  {index + 1}. {topic.title}
                </strong>
                <span className="pill">Prep {topic.prepMinutes}m</span>
                <span className="pill">Audience: {topic.targetAudience}</span>
              </div>

              <ul style={{ marginBottom: 8 }}>
                {topic.outline.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>

              <div className="chips">
                {topic.tags.map((tag) => (
                  <span key={tag} className="pill">
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          ))}
          {!topics.length ? <p className="muted">No topics yet. Generate your weekly list.</p> : null}
        </div>
      </section>
    </PageShell>
  );
}
