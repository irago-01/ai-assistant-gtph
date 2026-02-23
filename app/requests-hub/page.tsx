"use client";

import { useEffect, useState } from "react";

import { PageShell } from "@/components/page-shell";
import { apiFetch } from "@/lib/client-api";

type JiraRequest = {
  id: string;
  issueKey: string;
  issueUrl: string;
  summary: string;
  requester: string;
  priority: string;
  status: string;
  createdDate: string;
};

type AuditAction = {
  id: string;
  decision: "APPROVE" | "REJECT";
  comment: string | null;
  actedAt: string;
  jiraRequest: {
    issueKey: string;
    summary: string;
  };
};

export default function RequestsHubPage() {
  const [requests, setRequests] = useState<JiraRequest[]>([]);
  const [audit, setAudit] = useState<AuditAction[]>([]);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [pending, history] = await Promise.all([
      apiFetch<{ requests: JiraRequest[] }>("/api/requests/pending"),
      apiFetch<{ actions: AuditAction[] }>("/api/requests/audit")
    ]);

    setRequests(pending.requests);
    setAudit(history.actions);
  }

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load approvals")
    );
  }, []);

  async function decide(requestId: string, decision: "APPROVE" | "REJECT") {
    try {
      setLoadingId(requestId);
      setError(null);
      await apiFetch(`/api/requests/${requestId}/decision`, {
        method: "POST",
        body: JSON.stringify({
          decision,
          comment: comments[requestId] || undefined,
          confluencePage: "Approved Requests"
        })
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update request");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <PageShell>
      <h1 className="page-title">Requests Hub</h1>
      <p className="page-subtitle">
        Review Jira approvals, decide with comments, and auto-update your Confluence approvals section with an audit trail.
      </p>

      <section className="card" style={{ marginBottom: 14 }}>
        <h2 className="card-title">Pending Approvals</h2>
        <p className="card-subtitle">Approve or reject to update Jira + Confluence.</p>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Issue</th>
                <th>Summary</th>
                <th>Requester</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Created</th>
                <th>Comment</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td>
                    <a href={request.issueUrl} target="_blank" rel="noreferrer">
                      {request.issueKey}
                    </a>
                  </td>
                  <td>{request.summary}</td>
                  <td>{request.requester}</td>
                  <td>{request.priority}</td>
                  <td>{request.status}</td>
                  <td>{new Date(request.createdDate).toLocaleDateString()}</td>
                  <td>
                    <input
                      className="input"
                      value={comments[request.id] ?? ""}
                      onChange={(event) =>
                        setComments((current) => ({
                          ...current,
                          [request.id]: event.target.value
                        }))
                      }
                      placeholder="Optional comment"
                    />
                  </td>
                  <td>
                    <div className="row" style={{ flexWrap: "nowrap" }}>
                      <button
                        className="btn success"
                        disabled={loadingId === request.id}
                        onClick={() => decide(request.id, "APPROVE")}
                      >
                        Approve
                      </button>
                      <button
                        className="btn danger"
                        disabled={loadingId === request.id}
                        onClick={() => decide(request.id, "REJECT")}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!requests.length ? (
                <tr>
                  <td colSpan={8} className="muted">
                    No pending approvals.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Audit Log</h2>
        <p className="card-subtitle">Most recent decision events.</p>

        <div className="stack">
          {audit.map((entry) => (
            <article key={entry.id} className="card" style={{ boxShadow: "none" }}>
              <div className="row">
                <strong>
                  {entry.jiraRequest.issueKey} - {entry.jiraRequest.summary}
                </strong>
                <span className="pill">{entry.decision}</span>
                <span className="pill">{new Date(entry.actedAt).toLocaleString()}</span>
              </div>
              {entry.comment ? <p className="muted">Comment: {entry.comment}</p> : null}
            </article>
          ))}
          {!audit.length ? <p className="muted">No audit actions yet.</p> : null}
        </div>

        {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : null}
      </section>
    </PageShell>
  );
}
