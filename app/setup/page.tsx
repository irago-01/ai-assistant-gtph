"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PageShell } from "@/components/page-shell";
import { apiFetch } from "@/lib/client-api";

type IntegrationStatus = {
  provider: "SLACK" | "MICROSOFT" | "ATLASSIAN";
  label: string;
  connected: boolean;
  requiredScopes: string[];
};

export default function SetupPage() {
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [seedLoading, setSeedLoading] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const data = await apiFetch<{ integrations: IntegrationStatus[] }>(
      "/api/integrations/status"
    );
    setIntegrations(data.integrations);
  }

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load setup status")
    );
  }, []);

  async function seedWorkspace() {
    try {
      setSeedLoading(true);
      setError(null);
      await apiFetch("/api/setup/seed", { method: "POST" });
      setSeeded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to seed workspace");
    } finally {
      setSeedLoading(false);
    }
  }

  const connectedCount = useMemo(
    () => integrations.filter((integration) => integration.connected).length,
    [integrations]
  );

  return (
    <PageShell>
      <h1 className="page-title">Setup Wizard</h1>
      <p className="page-subtitle">
        Connect Slack, Outlook, and Atlassian, seed data, and start generating your Today board.
      </p>

      <div className="metrics" style={{ marginBottom: 14 }}>
        <div className="metric">
          <div className="metric-label">Integrations Connected</div>
          <div className="metric-value">
            {connectedCount}/{integrations.length}
          </div>
        </div>
        <div className="metric">
          <div className="metric-label">Seed Data</div>
          <div className="metric-value">{seeded ? "Ready" : "Pending"}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Next Step</div>
          <div className="metric-value">Dashboard</div>
        </div>
      </div>

      <div className="grid-2">
        <section className="card">
          <h2 className="card-title">1. Connect Core Integrations</h2>
          <p className="card-subtitle">OAuth/SSO: Microsoft + Slack + Atlassian</p>

          <div className="stack">
            {integrations.map((integration) => {
              const provider = integration.provider.toLowerCase();

              return (
                <div key={integration.provider} className="card" style={{ boxShadow: "none" }}>
                  <div className="row">
                    <strong>{integration.label}</strong>
                    <span className="pill">
                      {integration.connected ? "Connected" : "Not connected"}
                    </span>
                  </div>

                  {!integration.connected ? (
                    <a className="btn" href={`/api/oauth/${provider}/start`}>
                      Connect
                    </a>
                  ) : null}

                  <div className="chips" style={{ marginTop: 8 }}>
                    {integration.requiredScopes.map((scope) => (
                      <span className="pill" key={scope}>
                        {scope}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card">
          <h2 className="card-title">2. Seed Demo Data and Initialize</h2>
          <p className="card-subtitle">
            Adds Jira pending approvals, Confluence chips, and baseline workspace records.
          </p>

          <button className="btn primary" disabled={seedLoading} onClick={seedWorkspace}>
            {seedLoading ? "Seeding..." : "Seed Workspace"}
          </button>

          {seeded ? (
            <div className="notice" style={{ marginTop: 10 }}>
              Seed complete. You can now generate your Today board.
            </div>
          ) : null}

          <hr className="sep" />

          <h3 className="card-title" style={{ fontSize: 16 }}>
            3. Launch Workflows
          </h3>
          <div className="row" style={{ marginTop: 10 }}>
            <Link className="btn" href="/dashboard">
              Open Dashboard
            </Link>
            <Link className="btn" href="/one-on-one-coaching">
              Open 1:1 Coaching
            </Link>
            <Link className="btn" href="/requests-hub">
              Open Requests Hub
            </Link>
          </div>
        </section>
      </div>

      {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : null}
    </PageShell>
  );
}
