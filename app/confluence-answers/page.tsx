"use client";

import { Search, Settings2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { PageShell } from "@/components/page-shell";
import { apiFetch } from "@/lib/client-api";

type Rule = {
  id: string;
  keyword: string;
  pageUrl: string;
  title: string;
  description: string;
};

type Result = {
  id: string;
  title: string;
  snippet: string;
  pageUrl: string;
  lastUpdatedAt: string;
};

export default function ConfluenceAnswersPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [selectedKeyword, setSelectedKeyword] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminMode, setAdminMode] = useState(false);

  const [newKeyword, setNewKeyword] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");

  async function loadRules() {
    const data = await apiFetch<{ rules: Rule[] }>("/api/confluence/chips");
    setRules(data.rules);
    if (!selectedKeyword && data.rules.length > 0) {
      selectKeyword(data.rules[0].keyword);
    }
  }

  useEffect(() => {
    loadRules().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load chips")
    );
  }, []);

  function selectKeyword(keyword: string) {
    setSelectedKeyword(keyword);
    const rule = rules.find(r => r.keyword === keyword);
    if (rule) {
      setResults([{
        id: rule.id,
        title: rule.title,
        snippet: rule.description,
        pageUrl: rule.pageUrl,
        lastUpdatedAt: new Date().toISOString()
      }]);
    } else {
      setResults([]);
    }
  }

  async function saveRule() {
    try {
      setError(null);
      await apiFetch("/api/confluence/chips", {
        method: "POST",
        body: JSON.stringify({
          keyword: newKeyword,
          pageUrl: newUrl,
          title: newTitle,
          description: newDescription
        })
      });
      setNewKeyword("");
      setNewUrl("");
      setNewTitle("");
      setNewDescription("");
      await loadRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save rule");
    }
  }

  async function removeRule(keyword: string) {
    try {
      await apiFetch("/api/confluence/chips", {
        method: "DELETE",
        body: JSON.stringify({ keyword })
      });
      await loadRules();
      if (selectedKeyword === keyword) {
        setResults([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove rule");
    }
  }

  return (
    <PageShell>
      <h1 className="page-title">Confluence Answers</h1>
      <p className="page-subtitle">
        Search Confluence quickly via configurable keyword chips and mapping rules.
      </p>

      <section className="card" style={{ marginBottom: 14 }}>
        <div className="row">
          <h2 className="card-title" style={{ marginRight: 12 }}>
            Quick Links by Keywords
          </h2>
          <div className="spacer" />
          <button className="btn" onClick={() => setAdminMode((value) => !value)}>
            <Settings2 size={14} style={{ marginRight: 6 }} />
            {adminMode ? "Exit Admin" : "Admin Mode"}
          </button>
        </div>

        <div className="chips" style={{ marginTop: 12 }}>
          {rules.map((rule) => (
            <button
              key={rule.id}
              className={`tag ${selectedKeyword === rule.keyword ? "active" : ""}`}
              onClick={() => selectKeyword(rule.keyword)}
            >
              {rule.keyword}
            </button>
          ))}
        </div>
      </section>

      {adminMode ? (
        <section className="card" style={{ marginBottom: 14 }}>
          <h3 className="card-title">Manage Chips and Mapping Rules</h3>
          <p className="card-subtitle">Keyword to Confluence query + labels</p>

          <div className="stack">
            <div>
              <label className="label">Keyword</label>
              <input
                className="input"
                value={newKeyword}
                onChange={(event) => setNewKeyword(event.target.value)}
                placeholder="e.g., Onboarding"
              />
            </div>
            <div>
              <label className="label">Confluence Page URL</label>
              <input
                className="input"
                type="url"
                value={newUrl}
                onChange={(event) => setNewUrl(event.target.value)}
                placeholder="https://example.atlassian.net/wiki/spaces/..."
              />
            </div>
            <div>
              <label className="label">Title</label>
              <input
                className="input"
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="e.g., New Employee Onboarding Guide"
              />
            </div>
            <div>
              <label className="label">Short Description</label>
              <textarea
                className="textarea"
                rows={3}
                value={newDescription}
                onChange={(event) => setNewDescription(event.target.value)}
                placeholder="Brief description of this Confluence page..."
              />
            </div>
          </div>

          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn primary" onClick={saveRule}>
              Save Rule
            </button>
          </div>

          <hr className="sep" />

          <div className="stack">
            {rules.map((rule) => (
              <div key={rule.id} className="row card" style={{ boxShadow: "none" }}>
                <div style={{ flex: 1 }}>
                  <strong>{rule.keyword}</strong>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {rule.title}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {rule.pageUrl}
                  </div>
                </div>
                <button className="btn danger" onClick={() => removeRule(rule.keyword)}>
                  <Trash2 size={14} style={{ marginRight: 6 }} />
                  Delete
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="card">
        <h2 className="card-title">
          <Search size={16} style={{ marginRight: 6 }} />
          Top Matches {selectedKeyword ? `for "${selectedKeyword}"` : ""}
        </h2>
        <p className="card-subtitle">Top 5-15 pages with snippet and last update.</p>

        {loading ? <p>Loading...</p> : null}
        {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : null}

        <div className="grid-2" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}>
          {results.map((result) => (
            <article key={result.id} className="card" style={{ boxShadow: "none" }}>
              <h3 style={{ margin: "0 0 6px" }}>{result.title}</h3>
              <p className="muted" style={{ marginTop: 0 }}>
                {result.snippet}
              </p>
              <div className="row">
                <span className="pill">
                  Updated {new Date(result.lastUpdatedAt).toLocaleDateString()}
                </span>
                <button
                  className="btn"
                  onClick={() => {
                    navigator.clipboard.writeText(result.pageUrl);
                  }}
                >
                  Copy Link
                </button>
              </div>
            </article>
          ))}
          {!results.length && !loading ? (
            <p className="muted">Click a keyword chip to search Confluence pages.</p>
          ) : null}
        </div>
      </section>
    </PageShell>
  );
}
