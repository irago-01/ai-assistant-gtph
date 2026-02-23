"use client";

import { useEffect, useState } from "react";

import { PageShell } from "@/components/page-shell";
import { apiFetch } from "@/lib/client-api";

type Settings = {
  keyChannels: string[];
  keyPeople: string[];
  execSenders: string[];
  keywords: string[];
  workingHourStart: number;
  workingHourEnd: number;
  taskMin: number;
  taskMax: number;
  slackWeight: number;
  emailWeight: number;
  calendarWeight: number;
};

type IntegrationStatus = {
  provider: "SLACK" | "MICROSOFT" | "ATLASSIAN";
  label: string;
  description: string;
  requiredScopes: string[];
  connected: boolean;
  status: string;
  accountName: string | null;
  tokenExpiresAt: string | null;
};

type CoachingAdminSettings = {
  rubricJson: Record<string, unknown>;
  promptingFundamentalsWeight: number;
  workflowAutomationWeight: number;
  toolSelectionEvaluationWeight: number;
  dataKnowledgeRetrievalWeight: number;
  responsibleAiRiskAwarenessWeight: number;
  deliveryImplementationWeight: number;
  cadenceDefault: "WEEKLY" | "BIWEEKLY";
  sessionDurationDefault: number;
  reminderHoursBefore: number;
  defaultAgendaTemplates: string[];
  autoConfluenceLog: boolean;
  autoCreateHomeworkJira: boolean;
};

const emptySettings: Settings = {
  keyChannels: [],
  keyPeople: [],
  execSenders: [],
  keywords: [],
  workingHourStart: 9,
  workingHourEnd: 18,
  taskMin: 8,
  taskMax: 20,
  slackWeight: 0.4,
  emailWeight: 0.35,
  calendarWeight: 0.25
};

const emptyCoachingSettings: CoachingAdminSettings = {
  rubricJson: {
    levels: {
      0: "No practical use yet",
      1: "Aware of concepts, needs support",
      2: "Can execute basic tasks with guidance",
      3: "Independent practitioner on routine work",
      4: "Drives adoption and mentors peers",
      5: "Leads strategy and scale"
    }
  },
  promptingFundamentalsWeight: 1,
  workflowAutomationWeight: 1,
  toolSelectionEvaluationWeight: 1,
  dataKnowledgeRetrievalWeight: 1,
  responsibleAiRiskAwarenessWeight: 1,
  deliveryImplementationWeight: 1,
  cadenceDefault: "WEEKLY",
  sessionDurationDefault: 45,
  reminderHoursBefore: 24,
  defaultAgendaTemplates: [
    "Baseline + goal setting + quick win",
    "Hands-on build tied to live work",
    "Ship + adoption + measurement"
  ],
  autoConfluenceLog: true,
  autoCreateHomeworkJira: false
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(emptySettings);
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [integrationsLoading, setIntegrationsLoading] = useState(true);
  const [disconnectingProviders, setDisconnectingProviders] = useState<
    Record<IntegrationStatus["provider"], boolean>
  >({
    SLACK: false,
    MICROSOFT: false,
    ATLASSIAN: false
  });
  const [coachingSettings, setCoachingSettings] =
    useState<CoachingAdminSettings>(emptyCoachingSettings);
  const [rubricInput, setRubricInput] = useState(
    JSON.stringify(emptyCoachingSettings.rubricJson, null, 2)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadIntegrations() {
    setIntegrationsLoading(true);
    try {
      const integrationsRes =
        await apiFetch<{ integrations: IntegrationStatus[] }>("/api/integrations/status");
      setIntegrations(integrationsRes.integrations);
    } finally {
      setIntegrationsLoading(false);
    }
  }

  async function load() {
    const loadErrors: string[] = [];
    const [settingsResult, coachingSettingsResult] = await Promise.allSettled([
      apiFetch<{ settings: Settings }>("/api/settings"),
      apiFetch<{ settings: CoachingAdminSettings }>("/api/coaching/settings")
    ]);

    if (settingsResult.status === "fulfilled" && settingsResult.value.settings) {
      setSettings(settingsResult.value.settings);
    } else if (settingsResult.status === "rejected") {
      loadErrors.push(
        settingsResult.reason instanceof Error
          ? settingsResult.reason.message
          : "Failed to load prioritization settings"
      );
    }

    if (coachingSettingsResult.status === "fulfilled" && coachingSettingsResult.value.settings) {
      setCoachingSettings(coachingSettingsResult.value.settings);
      setRubricInput(JSON.stringify(coachingSettingsResult.value.settings.rubricJson, null, 2));
    } else if (coachingSettingsResult.status === "rejected") {
      loadErrors.push(
        coachingSettingsResult.reason instanceof Error
          ? coachingSettingsResult.reason.message
          : "Failed to load coaching settings"
      );
    }

    try {
      await loadIntegrations();
    } catch (err) {
      loadErrors.push(err instanceof Error ? err.message : "Failed to load integrations");
    }

    if (loadErrors.length > 0) {
      setError(loadErrors.join(" | "));
    }
  }

  useEffect(() => {
    setError(null);
    load().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load settings")
    );
  }, []);

  async function save() {
    try {
      setLoading(true);
      setError(null);
      const parsedRubric = JSON.parse(rubricInput) as Record<string, unknown>;

      await Promise.all([
        apiFetch("/api/settings", {
          method: "PUT",
          body: JSON.stringify(settings)
        }),
        apiFetch("/api/coaching/settings", {
          method: "PUT",
          body: JSON.stringify({
            ...coachingSettings,
            rubricJson: parsedRubric
          })
        })
      ]);

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setLoading(false);
    }
  }

  async function disconnectIntegration(provider: IntegrationStatus["provider"]) {
    try {
      setError(null);
      setDisconnectingProviders((current) => ({
        ...current,
        [provider]: true
      }));

      await apiFetch(`/api/integrations/${provider.toLowerCase()}/disconnect`, {
        method: "POST"
      });

      await loadIntegrations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect integration");
    } finally {
      setDisconnectingProviders((current) => ({
        ...current,
        [provider]: false
      }));
    }
  }

  function updateListField(field: keyof Settings, value: string) {
    setSettings((current) => ({
      ...current,
      [field]: value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    }));
  }

  const sliderTotal =
    settings.slackWeight + settings.emailWeight + settings.calendarWeight;
  const coachingWeightTotal =
    coachingSettings.promptingFundamentalsWeight +
    coachingSettings.workflowAutomationWeight +
    coachingSettings.toolSelectionEvaluationWeight +
    coachingSettings.dataKnowledgeRetrievalWeight +
    coachingSettings.responsibleAiRiskAwarenessWeight +
    coachingSettings.deliveryImplementationWeight;

  return (
    <PageShell>
      <h1 className="page-title">Settings</h1>
      <p className="page-subtitle">
        Configure signal priorities, stakeholder filters, task limits, coaching rubric/weights, and integration permissions.
      </p>

      <div className="grid-2">
        <section className="card">
          <h2 className="card-title">Prioritization and Controls</h2>

          <div className="stack">
            <div>
              <label className="label">Key Channels (comma separated)</label>
              <input
                className="input"
                value={settings.keyChannels.join(",")}
                onChange={(event) => updateListField("keyChannels", event.target.value)}
              />
            </div>

            <div>
              <label className="label">Key People (comma separated)</label>
              <input
                className="input"
                value={settings.keyPeople.join(",")}
                onChange={(event) => updateListField("keyPeople", event.target.value)}
              />
            </div>

            <div>
              <label className="label">Exec / Stakeholder Senders</label>
              <input
                className="input"
                value={settings.execSenders.join(",")}
                onChange={(event) => updateListField("execSenders", event.target.value)}
              />
            </div>

            <div>
              <label className="label">Urgency Keywords</label>
              <input
                className="input"
                value={settings.keywords.join(",")}
                onChange={(event) => updateListField("keywords", event.target.value)}
              />
            </div>

            <div className="grid-3">
              <div>
                <label className="label">Working Hour Start</label>
                <input
                  id="working-hours"
                  className="input"
                  type="number"
                  min={0}
                  max={23}
                  value={settings.workingHourStart}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      workingHourStart: Number(event.target.value)
                    }))
                  }
                />
              </div>

              <div>
                <label className="label">Working Hour End</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={24}
                  value={settings.workingHourEnd}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      workingHourEnd: Number(event.target.value)
                    }))
                  }
                />
              </div>

              <div>
                <label className="label">Task Min / Max</label>
                <div className="row" style={{ gap: 6 }}>
                  <input
                    className="input"
                    type="number"
                    min={3}
                    max={30}
                    value={settings.taskMin}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        taskMin: Number(event.target.value)
                      }))
                    }
                  />
                  <input
                    className="input"
                    type="number"
                    min={5}
                    max={40}
                    value={settings.taskMax}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        taskMax: Number(event.target.value)
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="card" style={{ boxShadow: "none" }}>
              <h3 className="card-title" style={{ fontSize: 16 }}>
                Weighting Sliders (must sum to 1.0)
              </h3>
              <div className="stack">
                <label className="label">
                  Slack ({settings.slackWeight.toFixed(2)})
                  <input
                    className="input"
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={settings.slackWeight}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        slackWeight: Number(event.target.value)
                      }))
                    }
                  />
                </label>

                <label className="label">
                  Email ({settings.emailWeight.toFixed(2)})
                  <input
                    className="input"
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={settings.emailWeight}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        emailWeight: Number(event.target.value)
                      }))
                    }
                  />
                </label>

                <label className="label">
                  Calendar ({settings.calendarWeight.toFixed(2)})
                  <input
                    className="input"
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={settings.calendarWeight}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        calendarWeight: Number(event.target.value)
                      }))
                    }
                  />
                </label>

                <div className="notice">Current total: {sliderTotal.toFixed(2)}</div>
              </div>
            </div>

            <button className="btn primary" disabled={loading} onClick={save}>
              {loading ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </section>

        <section className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2 className="card-title">Connected Accounts and Scopes</h2>
            <button className="btn" type="button" disabled={integrationsLoading} onClick={loadIntegrations}>
              {integrationsLoading ? "Loading..." : "Refresh"}
            </button>
          </div>
          <p className="card-subtitle">Least-privilege scopes required per integration.</p>

          <div className="stack">
            {integrationsLoading && integrations.length === 0 ? (
              <div className="notice">Loading integrations...</div>
            ) : null}

            {integrations.map((integration) => {
              const provider = integration.provider.toLowerCase();
              const disconnecting = disconnectingProviders[integration.provider];

              return (
                <article key={integration.provider} className="card" style={{ boxShadow: "none" }}>
                  <div className="row">
                    <strong>{integration.label}</strong>
                    <span className="pill">
                      {integration.connected ? "Connected" : "Not Connected"}
                    </span>
                  </div>
                  <p className="muted">{integration.description}</p>
                  <p className="muted" style={{ fontSize: 13 }}>
                    Account: {integration.accountName ?? "-"}
                  </p>
                  <div className="chips" style={{ marginBottom: 8 }}>
                    {integration.requiredScopes.map((scope) => (
                      <span key={scope} className="pill">
                        {scope}
                      </span>
                    ))}
                  </div>

                  {integration.connected ? (
                    <div className="row">
                      <button
                        className="btn danger"
                        type="button"
                        disabled={disconnecting}
                        onClick={() => disconnectIntegration(integration.provider)}
                      >
                        {disconnecting ? "Disconnecting..." : `Disconnect ${integration.label}`}
                      </button>
                      <a className="btn" href={`/api/oauth/${provider}/start`}>
                        Reconnect
                      </a>
                    </div>
                  ) : (
                    <a className="btn" href={`/api/oauth/${provider}/start`}>
                      Connect {integration.label}
                    </a>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <section className="card" style={{ marginTop: 14 }}>
        <h2 className="card-title">1:1 Coaching Admin</h2>
        <p className="card-subtitle">
          Define rubric levels, dimension weights, cadence defaults, reminders, and automation templates.
        </p>

        <div className="grid-3">
          <div>
            <label className="label">
              Prompting weight ({coachingSettings.promptingFundamentalsWeight.toFixed(2)})
            </label>
            <input
              className="input"
              type="number"
              step={0.1}
              min={0.1}
              value={coachingSettings.promptingFundamentalsWeight}
              onChange={(event) =>
                setCoachingSettings((current) => ({
                  ...current,
                  promptingFundamentalsWeight: Number(event.target.value)
                }))
              }
            />
          </div>
          <div>
            <label className="label">
              Workflow automation weight ({coachingSettings.workflowAutomationWeight.toFixed(2)})
            </label>
            <input
              className="input"
              type="number"
              step={0.1}
              min={0.1}
              value={coachingSettings.workflowAutomationWeight}
              onChange={(event) =>
                setCoachingSettings((current) => ({
                  ...current,
                  workflowAutomationWeight: Number(event.target.value)
                }))
              }
            />
          </div>
          <div>
            <label className="label">
              Tool evaluation weight ({coachingSettings.toolSelectionEvaluationWeight.toFixed(2)})
            </label>
            <input
              className="input"
              type="number"
              step={0.1}
              min={0.1}
              value={coachingSettings.toolSelectionEvaluationWeight}
              onChange={(event) =>
                setCoachingSettings((current) => ({
                  ...current,
                  toolSelectionEvaluationWeight: Number(event.target.value)
                }))
              }
            />
          </div>
          <div>
            <label className="label">
              Data retrieval weight ({coachingSettings.dataKnowledgeRetrievalWeight.toFixed(2)})
            </label>
            <input
              className="input"
              type="number"
              step={0.1}
              min={0.1}
              value={coachingSettings.dataKnowledgeRetrievalWeight}
              onChange={(event) =>
                setCoachingSettings((current) => ({
                  ...current,
                  dataKnowledgeRetrievalWeight: Number(event.target.value)
                }))
              }
            />
          </div>
          <div>
            <label className="label">
              Responsible AI weight ({coachingSettings.responsibleAiRiskAwarenessWeight.toFixed(2)})
            </label>
            <input
              className="input"
              type="number"
              step={0.1}
              min={0.1}
              value={coachingSettings.responsibleAiRiskAwarenessWeight}
              onChange={(event) =>
                setCoachingSettings((current) => ({
                  ...current,
                  responsibleAiRiskAwarenessWeight: Number(event.target.value)
                }))
              }
            />
          </div>
          <div>
            <label className="label">
              Delivery weight ({coachingSettings.deliveryImplementationWeight.toFixed(2)})
            </label>
            <input
              className="input"
              type="number"
              step={0.1}
              min={0.1}
              value={coachingSettings.deliveryImplementationWeight}
              onChange={(event) =>
                setCoachingSettings((current) => ({
                  ...current,
                  deliveryImplementationWeight: Number(event.target.value)
                }))
              }
            />
          </div>
        </div>

        <div className="notice" style={{ marginTop: 10 }}>
          Coaching weight total: {coachingWeightTotal.toFixed(2)}
        </div>

        <div className="grid-3" style={{ marginTop: 10 }}>
          <div>
            <label className="label">Default cadence</label>
            <select
              className="select"
              value={coachingSettings.cadenceDefault}
              onChange={(event) =>
                setCoachingSettings((current) => ({
                  ...current,
                  cadenceDefault: event.target.value as "WEEKLY" | "BIWEEKLY"
                }))
              }
            >
              <option value="WEEKLY">Weekly</option>
              <option value="BIWEEKLY">Biweekly</option>
            </select>
          </div>
          <div>
            <label className="label">Default session duration</label>
            <input
              className="input"
              type="number"
              min={20}
              max={90}
              value={coachingSettings.sessionDurationDefault}
              onChange={(event) =>
                setCoachingSettings((current) => ({
                  ...current,
                  sessionDurationDefault: Number(event.target.value)
                }))
              }
            />
          </div>
          <div>
            <label className="label">Reminder hours before session</label>
            <input
              className="input"
              type="number"
              min={1}
              max={72}
              value={coachingSettings.reminderHoursBefore}
              onChange={(event) =>
                setCoachingSettings((current) => ({
                  ...current,
                  reminderHoursBefore: Number(event.target.value)
                }))
              }
            />
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <label className="label">Default agenda templates (one per line)</label>
          <textarea
            className="textarea"
            value={coachingSettings.defaultAgendaTemplates.join("\n")}
            onChange={(event) =>
              setCoachingSettings((current) => ({
                ...current,
                defaultAgendaTemplates: event.target.value
                  .split("\n")
                  .map((item) => item.trim())
                  .filter(Boolean)
              }))
            }
          />
        </div>

        <div style={{ marginTop: 10 }}>
          <label className="label">Scoring rubric JSON (0-5 descriptions)</label>
          <textarea
            className="textarea"
            value={rubricInput}
            onChange={(event) => setRubricInput(event.target.value)}
          />
        </div>

        <div className="row" style={{ marginTop: 10 }}>
          <label className="row" style={{ gap: 6 }}>
            <input
              type="checkbox"
              checked={coachingSettings.autoConfluenceLog}
              onChange={(event) =>
                setCoachingSettings((current) => ({
                  ...current,
                  autoConfluenceLog: event.target.checked
                }))
              }
            />
            Auto create/update Confluence coaching log
          </label>
          <label className="row" style={{ gap: 6 }}>
            <input
              type="checkbox"
              checked={coachingSettings.autoCreateHomeworkJira}
              onChange={(event) =>
                setCoachingSettings((current) => ({
                  ...current,
                  autoCreateHomeworkJira: event.target.checked
                }))
              }
            />
            Auto create Jira homework tasks
          </label>
        </div>

        <button className="btn primary" style={{ marginTop: 12 }} disabled={loading} onClick={save}>
          {loading ? "Saving..." : "Save All Settings"}
        </button>
      </section>

      {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : null}
    </PageShell>
  );
}
