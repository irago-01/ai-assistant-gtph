"use client";

import { CoachingCadence, CoachingSessionStatus } from "@prisma/client";
import { CalendarPlus2, Filter, PlusCircle, Sparkles, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PageShell } from "@/components/page-shell";
import { apiFetch } from "@/lib/client-api";

type EnablerRow = {
  id: string;
  name: string;
  roleTeam: string;
  email: string;
  slackHandle: string;
  manager: string | null;
  timezone: string;
  notes: string | null;
  overallScore: number;
  trend: "improving" | "flat" | "declining";
  lastThreeScores: number[];
  topStrengthTags: string[];
  topGapTags: string[];
  nextSessionDate: string | null;
  needsPlan: boolean;
  overdueAssessment: boolean;
};

type Assessment = {
  id: string;
  assessmentDate: string;
  assessor: string;
  overallScore: number;
  promptingFundamentals: number;
  workflowAutomation: number;
  toolSelectionEvaluation: number;
  dataKnowledgeRetrieval: number;
  responsibleAiRiskAwareness: number;
  deliveryImplementation: number;
  evidenceLinks: string[];
  strengths: string;
  gaps: string;
};

type Plan = {
  id: string;
  createdDate: string;
  targetOverallScore: number;
  focusDimensions: string[];
  recommendedPractice: string[];
  suggestedProjects: string[];
  successMetrics: string;
  resources: string[];
};

type Session = {
  id: string;
  sessionNumber: number;
  plannedDateTime: string;
  durationMinutes: number;
  agenda: string[];
  prepChecklist: string[];
  homeworkAssigned: string;
  outcomeNotes: string | null;
  nextSteps: string | null;
  status: CoachingSessionStatus;
  calendarEventId: string | null;
  meetingLink: string | null;
};

type EnablerProfile = {
  id: string;
  name: string;
  roleTeam: string;
  email: string;
  slackHandle: string;
  manager: string | null;
  timezone: string;
  notes: string | null;
  assessments: Assessment[];
  plans: Plan[];
  sessions: Session[];
};

type TeamSummary = {
  averageScore: number;
  distribution: {
    Beginner: number;
    Intermediate: number;
    Advanced: number;
  };
  topCommonGaps: Array<{ tag: string; count: number }>;
  enablersCount: number;
};

type CoachingSettings = {
  cadenceDefault: CoachingCadence;
  sessionDurationDefault: number;
};

type GeneratedSession = {
  id: string;
  sessionNumber: number;
  plannedDateTime: string;
  durationMinutes: number;
  agenda: string[];
  prepChecklist: string[];
  homeworkAssigned: string;
  status: CoachingSessionStatus;
  alternatives: string[];
};

type TabKey = "overview" | "assessment" | "plan" | "sessions";

const emptyAssessment = {
  promptingFundamentals: 2,
  workflowAutomation: 2,
  toolSelectionEvaluation: 2,
  dataKnowledgeRetrieval: 2,
  responsibleAiRiskAwareness: 2,
  deliveryImplementation: 2,
  strengths: "",
  gaps: "",
  evidenceLinks: ""
};

export default function OneOnOneCoachingPage() {
  const [enablers, setEnablers] = useState<EnablerRow[]>([]);
  const [summary, setSummary] = useState<TeamSummary | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [profile, setProfile] = useState<EnablerProfile | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [teamFilter, setTeamFilter] = useState("all");
  const [scoreMin, setScoreMin] = useState("0");
  const [scoreMax, setScoreMax] = useState("100");
  const [needsPlan, setNeedsPlan] = useState(false);
  const [overdueAssessment, setOverdueAssessment] = useState(false);

  const [assessment, setAssessment] = useState(emptyAssessment);
  const [overallPreview, setOverallPreview] = useState<number | null>(null);

  const [settings, setSettings] = useState<CoachingSettings>({
    cadenceDefault: "WEEKLY",
    sessionDurationDefault: 45
  });
  const [cadence, setCadence] = useState<CoachingCadence>("WEEKLY");
  const [sessionCount, setSessionCount] = useState<2 | 3>(3);
  const [sessionDuration, setSessionDuration] = useState(45);
  const [generatedSessions, setGeneratedSessions] = useState<GeneratedSession[]>([]);
  const [planDraft, setPlanDraft] = useState<{
    targetOverallScore: number;
    focusDimensions: string;
    recommendedPractice: string;
    suggestedProjects: string;
    successMetrics: string;
    resources: string;
  } | null>(null);

  const [newEnabler, setNewEnabler] = useState({
    name: "",
    roleTeam: "",
    email: "",
    slackHandle: "",
    manager: "",
    timezone: "America/Los_Angeles",
    notes: ""
  });

  const [sessionOutcomeNotes, setSessionOutcomeNotes] = useState<Record<string, string>>({});
  const [sessionNextSteps, setSessionNextSteps] = useState<Record<string, string>>({});

  const teams = useMemo(
    () => Array.from(new Set(enablers.map((enabler) => enabler.roleTeam))),
    [enablers]
  );

  async function loadEnablers() {
    const search = new URLSearchParams();

    if (teamFilter !== "all") search.set("team", teamFilter);
    if (scoreMin) search.set("scoreMin", scoreMin);
    if (scoreMax) search.set("scoreMax", scoreMax);
    if (needsPlan) search.set("needsPlan", "true");
    if (overdueAssessment) search.set("overdueAssessment", "true");

    const data = await apiFetch<{ enablers: EnablerRow[] }>(
      `/api/coaching/enablers?${search.toString()}`
    );

    setEnablers(data.enablers);

    if (!selectedId && data.enablers.length > 0) {
      setSelectedId(data.enablers[0].id);
    }

    if (selectedId && !data.enablers.find((item) => item.id === selectedId)) {
      setSelectedId(data.enablers[0]?.id ?? "");
    }
  }

  async function loadSummary() {
    const data = await apiFetch<{ summary: TeamSummary }>("/api/coaching/summary");
    setSummary(data.summary);
  }

  async function loadCoachingSettings() {
    const data = await apiFetch<{ settings: CoachingSettings }>("/api/coaching/settings");
    setSettings(data.settings);
    setCadence(data.settings.cadenceDefault);
    setSessionDuration(data.settings.sessionDurationDefault);
  }

  async function loadProfile(id: string) {
    const data = await apiFetch<{ profile: EnablerProfile }>(`/api/coaching/enablers/${id}`);
    setProfile(data.profile);

    const latest = data.profile.assessments[data.profile.assessments.length - 1];
    if (latest) {
      setAssessment({
        promptingFundamentals: latest.promptingFundamentals,
        workflowAutomation: latest.workflowAutomation,
        toolSelectionEvaluation: latest.toolSelectionEvaluation,
        dataKnowledgeRetrieval: latest.dataKnowledgeRetrieval,
        responsibleAiRiskAwareness: latest.responsibleAiRiskAwareness,
        deliveryImplementation: latest.deliveryImplementation,
        strengths: latest.strengths,
        gaps: latest.gaps,
        evidenceLinks: latest.evidenceLinks.join("\n")
      });
      setOverallPreview(latest.overallScore);
    }

    const latestPlan = data.profile.plans[0];
    if (latestPlan) {
      setPlanDraft({
        targetOverallScore: latestPlan.targetOverallScore,
        focusDimensions: latestPlan.focusDimensions.join("\n"),
        recommendedPractice: latestPlan.recommendedPractice.join("\n"),
        suggestedProjects: latestPlan.suggestedProjects.join("\n"),
        successMetrics: latestPlan.successMetrics,
        resources: latestPlan.resources.join("\n")
      });
    } else {
      setPlanDraft(null);
    }

    setGeneratedSessions([]);
  }

  async function refreshAll() {
    try {
      setLoading(true);
      setError(null);
      await Promise.all([loadEnablers(), loadSummary(), loadCoachingSettings()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load coaching data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll().catch(() => undefined);
  }, []);

  useEffect(() => {
    loadEnablers().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to filter enablers")
    );
  }, [teamFilter, scoreMin, scoreMax, needsPlan, overdueAssessment]);

  useEffect(() => {
    if (!selectedId) {
      setProfile(null);
      return;
    }

    loadProfile(selectedId).catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load profile")
    );
  }, [selectedId]);

  async function addEnabler() {
    try {
      setLoading(true);
      setError(null);
      await apiFetch("/api/coaching/enablers", {
        method: "POST",
        body: JSON.stringify(newEnabler)
      });
      setNewEnabler({
        name: "",
        roleTeam: "",
        email: "",
        slackHandle: "",
        manager: "",
        timezone: "America/Los_Angeles",
        notes: ""
      });
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add enabler");
    } finally {
      setLoading(false);
    }
  }

  async function recalculateOverall() {
    try {
      const data = await apiFetch<{ overallScore: number }>("/api/coaching/recalculate", {
        method: "POST",
        body: JSON.stringify({
          assessor: "me",
          promptingFundamentals: assessment.promptingFundamentals,
          workflowAutomation: assessment.workflowAutomation,
          toolSelectionEvaluation: assessment.toolSelectionEvaluation,
          dataKnowledgeRetrieval: assessment.dataKnowledgeRetrieval,
          responsibleAiRiskAwareness: assessment.responsibleAiRiskAwareness,
          deliveryImplementation: assessment.deliveryImplementation,
          strengths: assessment.strengths,
          gaps: assessment.gaps,
          evidenceLinks: assessment.evidenceLinks
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean)
        })
      });

      setOverallPreview(data.overallScore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to recalculate score");
    }
  }

  async function submitAssessment() {
    if (!profile) return;

    try {
      setLoading(true);
      setError(null);
      await apiFetch(`/api/coaching/enablers/${profile.id}/assessment`, {
        method: "POST",
        body: JSON.stringify({
          assessor: "me",
          promptingFundamentals: assessment.promptingFundamentals,
          workflowAutomation: assessment.workflowAutomation,
          toolSelectionEvaluation: assessment.toolSelectionEvaluation,
          dataKnowledgeRetrieval: assessment.dataKnowledgeRetrieval,
          responsibleAiRiskAwareness: assessment.responsibleAiRiskAwareness,
          deliveryImplementation: assessment.deliveryImplementation,
          strengths: assessment.strengths,
          gaps: assessment.gaps,
          evidenceLinks: assessment.evidenceLinks
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean)
        })
      });

      await Promise.all([loadProfile(profile.id), loadEnablers(), loadSummary()]);
      setActiveTab("overview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save assessment");
    } finally {
      setLoading(false);
    }
  }

  async function generatePlan() {
    if (!profile) return;

    try {
      setLoading(true);
      setError(null);
      await apiFetch(`/api/coaching/enablers/${profile.id}/plan/generate`, {
        method: "POST",
        body: JSON.stringify({})
      });
      await Promise.all([loadProfile(profile.id), loadEnablers()]);
      setActiveTab("plan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate coaching plan");
    } finally {
      setLoading(false);
    }
  }

  async function savePlan() {
    if (!latestPlan || !planDraft) return;

    try {
      setLoading(true);
      setError(null);
      await apiFetch(`/api/coaching/plans/${latestPlan.id}`, {
        method: "PUT",
        body: JSON.stringify({
          targetOverallScore: planDraft.targetOverallScore,
          focusDimensions: planDraft.focusDimensions
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
          recommendedPractice: planDraft.recommendedPractice
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
          suggestedProjects: planDraft.suggestedProjects
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
          successMetrics: planDraft.successMetrics,
          resources: planDraft.resources
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean)
        })
      });

      if (profile) {
        await loadProfile(profile.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save coaching plan");
    } finally {
      setLoading(false);
    }
  }

  async function generateSessions() {
    if (!profile) return;

    try {
      setLoading(true);
      setError(null);

      const data = await apiFetch<{ sessions: GeneratedSession[] }>(
        `/api/coaching/enablers/${profile.id}/sessions/generate`,
        {
          method: "POST",
          body: JSON.stringify({
            count: sessionCount,
            cadence,
            durationMinutes: sessionDuration
          })
        }
      );

      setGeneratedSessions(data.sessions);
      await loadProfile(profile.id);
      setActiveTab("sessions");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate sessions");
    } finally {
      setLoading(false);
    }
  }

  async function scheduleInOutlook() {
    if (!profile) return;

    try {
      setLoading(true);
      setError(null);
      await apiFetch(`/api/coaching/enablers/${profile.id}/sessions/schedule`, {
        method: "POST",
        body: JSON.stringify({
          sessionIds: generatedSessions.length > 0 ? generatedSessions.map((item) => item.id) : undefined
        })
      });

      await loadProfile(profile.id);
      await loadEnablers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule sessions");
    } finally {
      setLoading(false);
    }
  }

  async function completeSession(session: Session) {
    try {
      setLoading(true);
      setError(null);
      await apiFetch(`/api/coaching/sessions/${session.id}/complete`, {
        method: "POST",
        body: JSON.stringify({
          outcomeNotes: sessionOutcomeNotes[session.id] ?? "",
          nextSteps: sessionNextSteps[session.id] ?? "",
          homeworkAssigned: session.homeworkAssigned
        })
      });
      if (profile) {
        await loadProfile(profile.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete session");
    } finally {
      setLoading(false);
    }
  }

  const latestPlan = profile?.plans[0] ?? null;
  const latestAssessment = profile
    ? profile.assessments[profile.assessments.length - 1] ?? null
    : null;

  return (
    <PageShell>
      <h1 className="page-title">1:1 Coaching</h1>
      <p className="page-subtitle">
        Track strategic enabler AI proficiency, generate coaching plans, and schedule 2-3 upcoming 1:1 sessions.
      </p>

      <div className="metrics" style={{ marginBottom: 14 }}>
        <div className="metric">
          <div className="metric-label">Team Average Score</div>
          <div className="metric-value">{summary?.averageScore ?? 0}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Enablers Tracked</div>
          <div className="metric-value">{summary?.enablersCount ?? 0}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Top Common Gap</div>
          <div className="metric-value" style={{ fontSize: 16 }}>
            {summary?.topCommonGaps[0]?.tag ?? "-"}
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <section className="card">
          <h2 className="card-title">Enablers List + Scoreboard</h2>
          <p className="card-subtitle">Filter by team, score range, plan status, or overdue assessment.</p>

          <div className="grid-3">
            <div>
              <label className="label">Team</label>
              <select
                className="select"
                value={teamFilter}
                onChange={(event) => setTeamFilter(event.target.value)}
              >
                <option value="all">All teams</option>
                {teams.map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Score Min</label>
              <input
                className="input"
                type="number"
                min={0}
                max={100}
                value={scoreMin}
                onChange={(event) => setScoreMin(event.target.value)}
              />
            </div>
            <div>
              <label className="label">Score Max</label>
              <input
                className="input"
                type="number"
                min={0}
                max={100}
                value={scoreMax}
                onChange={(event) => setScoreMax(event.target.value)}
              />
            </div>
          </div>

          <div className="row" style={{ marginTop: 8 }}>
            <label className="row" style={{ gap: 6 }}>
              <input
                type="checkbox"
                checked={needsPlan}
                onChange={(event) => setNeedsPlan(event.target.checked)}
              />
              Needs plan
            </label>
            <label className="row" style={{ gap: 6 }}>
              <input
                type="checkbox"
                checked={overdueAssessment}
                onChange={(event) => setOverdueAssessment(event.target.checked)}
              />
              Overdue assessment
            </label>
            <button className="btn" onClick={() => loadEnablers()}>
              <Filter size={14} style={{ marginRight: 6 }} />
              Apply
            </button>
          </div>

          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table className="table" style={{ minWidth: 820 }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Score</th>
                  <th>Trend</th>
                  <th>Strengths</th>
                  <th>Gaps</th>
                  <th>Next Session</th>
                </tr>
              </thead>
              <tbody>
                {enablers.map((enabler) => (
                  <tr
                    key={enabler.id}
                    onClick={() => setSelectedId(enabler.id)}
                    style={{ cursor: "pointer", background: enabler.id === selectedId ? "#eef8f9" : "transparent" }}
                  >
                    <td>
                      <strong>{enabler.name}</strong>
                      <div className="muted" style={{ fontSize: 12 }}>{enabler.roleTeam}</div>
                    </td>
                    <td>
                      <strong>{enabler.overallScore}</strong>
                      <div className="muted" style={{ fontSize: 12 }}>
                        Last 3: {enabler.lastThreeScores.join(" / ") || "-"}
                      </div>
                    </td>
                    <td>
                      <span className="pill">{enabler.trend}</span>
                    </td>
                    <td>
                      <div className="chips">
                        {enabler.topStrengthTags.map((tag) => (
                          <span key={tag} className="pill">{tag}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="chips">
                        {enabler.topGapTags.map((tag) => (
                          <span key={tag} className="pill">{tag}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      {enabler.nextSessionDate
                        ? new Date(enabler.nextSessionDate).toLocaleString()
                        : "-"}
                    </td>
                  </tr>
                ))}
                {!enablers.length ? (
                  <tr>
                    <td colSpan={6} className="muted">No enablers found for current filters.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <hr className="sep" />

          <h3 className="card-title" style={{ fontSize: 16 }}>Add Strategic Enabler</h3>
          <div className="grid-3">
            <input className="input" placeholder="Name" value={newEnabler.name} onChange={(event) => setNewEnabler((current) => ({ ...current, name: event.target.value }))} />
            <input className="input" placeholder="Role / Team" value={newEnabler.roleTeam} onChange={(event) => setNewEnabler((current) => ({ ...current, roleTeam: event.target.value }))} />
            <input className="input" placeholder="Email" value={newEnabler.email} onChange={(event) => setNewEnabler((current) => ({ ...current, email: event.target.value }))} />
            <input className="input" placeholder="Slack handle" value={newEnabler.slackHandle} onChange={(event) => setNewEnabler((current) => ({ ...current, slackHandle: event.target.value }))} />
            <input className="input" placeholder="Manager (optional)" value={newEnabler.manager} onChange={(event) => setNewEnabler((current) => ({ ...current, manager: event.target.value }))} />
            <input className="input" placeholder="Time zone" value={newEnabler.timezone} onChange={(event) => setNewEnabler((current) => ({ ...current, timezone: event.target.value }))} />
          </div>
          <textarea className="textarea" style={{ marginTop: 8, minHeight: 80 }} placeholder="Notes" value={newEnabler.notes} onChange={(event) => setNewEnabler((current) => ({ ...current, notes: event.target.value }))} />
          <button className="btn primary" style={{ marginTop: 8 }} onClick={addEnabler} disabled={loading}>
            <PlusCircle size={15} style={{ marginRight: 6 }} />
            Add Enabler
          </button>
        </section>

        <section className="card">
          <h2 className="card-title">Enabler Profile</h2>
          {profile ? (
            <>
              <p className="card-subtitle">
                {profile.name} - {profile.roleTeam} - {profile.email}
              </p>

              <div className="tabs">
                <button className={`tab-btn ${activeTab === "overview" ? "active" : ""}`} onClick={() => setActiveTab("overview")}>Overview</button>
                <button className={`tab-btn ${activeTab === "assessment" ? "active" : ""}`} onClick={() => setActiveTab("assessment")}>Assessment</button>
                <button className={`tab-btn ${activeTab === "plan" ? "active" : ""}`} onClick={() => setActiveTab("plan")}>Plan</button>
                <button className={`tab-btn ${activeTab === "sessions" ? "active" : ""}`} onClick={() => setActiveTab("sessions")}>Sessions</button>
              </div>

              {activeTab === "overview" ? (
                <div style={{ marginTop: 12 }}>
                  <h3 className="card-title" style={{ fontSize: 16 }}>Score History</h3>
                  <div className="score-bars" style={{ marginTop: 10 }}>
                    {profile.assessments.map((entry) => (
                      <div className="score-bar" key={entry.id}>
                        <div className="score-bar-col" style={{ height: `${Math.max(18, Math.round(entry.overallScore * 0.9))}px` }} />
                        <span className="pill">{entry.overallScore}</span>
                        <span className="muted" style={{ fontSize: 11 }}>
                          {new Date(entry.assessmentDate).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>

                  <hr className="sep" />
                  <h3 className="card-title" style={{ fontSize: 16 }}>Last Assessment Summary</h3>
                  {latestAssessment ? (
                    <>
                      <p className="muted">Overall: {latestAssessment.overallScore}</p>
                      <p><strong>Strengths:</strong> {latestAssessment.strengths}</p>
                      <p><strong>Gaps:</strong> {latestAssessment.gaps}</p>
                    </>
                  ) : (
                    <p className="muted">No assessments yet.</p>
                  )}
                </div>
              ) : null}

              {activeTab === "assessment" ? (
                <div style={{ marginTop: 12 }}>
                  <div className="grid-3">
                    <div>
                      <label className="label">Prompting fundamentals (0-5)</label>
                      <input className="input" type="number" min={0} max={5} value={assessment.promptingFundamentals} onChange={(event) => setAssessment((current) => ({ ...current, promptingFundamentals: Number(event.target.value) }))} />
                    </div>
                    <div>
                      <label className="label">Workflow automation (0-5)</label>
                      <input className="input" type="number" min={0} max={5} value={assessment.workflowAutomation} onChange={(event) => setAssessment((current) => ({ ...current, workflowAutomation: Number(event.target.value) }))} />
                    </div>
                    <div>
                      <label className="label">Tool evaluation (0-5)</label>
                      <input className="input" type="number" min={0} max={5} value={assessment.toolSelectionEvaluation} onChange={(event) => setAssessment((current) => ({ ...current, toolSelectionEvaluation: Number(event.target.value) }))} />
                    </div>
                    <div>
                      <label className="label">RAG/search (0-5)</label>
                      <input className="input" type="number" min={0} max={5} value={assessment.dataKnowledgeRetrieval} onChange={(event) => setAssessment((current) => ({ ...current, dataKnowledgeRetrieval: Number(event.target.value) }))} />
                    </div>
                    <div>
                      <label className="label">Responsible AI (0-5)</label>
                      <input className="input" type="number" min={0} max={5} value={assessment.responsibleAiRiskAwareness} onChange={(event) => setAssessment((current) => ({ ...current, responsibleAiRiskAwareness: Number(event.target.value) }))} />
                    </div>
                    <div>
                      <label className="label">Delivery/adoption (0-5)</label>
                      <input className="input" type="number" min={0} max={5} value={assessment.deliveryImplementation} onChange={(event) => setAssessment((current) => ({ ...current, deliveryImplementation: Number(event.target.value) }))} />
                    </div>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <label className="label">Strengths</label>
                    <textarea className="textarea" value={assessment.strengths} onChange={(event) => setAssessment((current) => ({ ...current, strengths: event.target.value }))} />
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <label className="label">Gaps</label>
                    <textarea className="textarea" value={assessment.gaps} onChange={(event) => setAssessment((current) => ({ ...current, gaps: event.target.value }))} />
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <label className="label">Evidence links (one per line)</label>
                    <textarea className="textarea" value={assessment.evidenceLinks} onChange={(event) => setAssessment((current) => ({ ...current, evidenceLinks: event.target.value }))} />
                  </div>

                  <div className="row" style={{ marginTop: 10 }}>
                    <button className="btn" onClick={recalculateOverall}>
                      <Target size={14} style={{ marginRight: 6 }} />
                      Recalculate Overall Score
                    </button>
                    <span className="pill">Overall Preview: {overallPreview ?? "-"}</span>
                    <button className="btn primary" onClick={submitAssessment} disabled={loading}>
                      Save Assessment
                    </button>
                  </div>
                </div>
              ) : null}

              {activeTab === "plan" ? (
                <div style={{ marginTop: 12 }}>
                  <button className="btn primary" onClick={generatePlan} disabled={loading}>
                    <Sparkles size={14} style={{ marginRight: 6 }} />
                    Generate Coaching Plan
                  </button>

                  {latestPlan && planDraft ? (
                    <div className="stack" style={{ marginTop: 12 }}>
                      <div>
                        <label className="label">Target overall score</label>
                        <input
                          className="input"
                          type="number"
                          min={20}
                          max={100}
                          value={planDraft.targetOverallScore}
                          onChange={(event) =>
                            setPlanDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    targetOverallScore: Number(event.target.value)
                                  }
                                : current
                            )
                          }
                        />
                      </div>

                      <div>
                        <label className="label">Focus dimensions</label>
                        <textarea
                          className="textarea"
                          value={planDraft.focusDimensions}
                          onChange={(event) =>
                            setPlanDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    focusDimensions: event.target.value
                                  }
                                : current
                            )
                          }
                        />
                      </div>
                      <div>
                        <label className="label">Recommended practice checklist</label>
                        <textarea
                          className="textarea"
                          value={planDraft.recommendedPractice}
                          onChange={(event) =>
                            setPlanDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    recommendedPractice: event.target.value
                                  }
                                : current
                            )
                          }
                        />
                      </div>
                      <div>
                        <label className="label">Suggested projects (2-5)</label>
                        <textarea
                          className="textarea"
                          value={planDraft.suggestedProjects}
                          onChange={(event) =>
                            setPlanDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    suggestedProjects: event.target.value
                                  }
                                : current
                            )
                          }
                        />
                      </div>
                      <div>
                        <label className="label">Success metrics</label>
                        <textarea
                          className="textarea"
                          value={planDraft.successMetrics}
                          onChange={(event) =>
                            setPlanDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    successMetrics: event.target.value
                                  }
                                : current
                            )
                          }
                        />
                      </div>
                      <div>
                        <label className="label">Resources</label>
                        <textarea
                          className="textarea"
                          value={planDraft.resources}
                          onChange={(event) =>
                            setPlanDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    resources: event.target.value
                                  }
                                : current
                            )
                          }
                        />
                      </div>
                      <button className="btn success" onClick={savePlan} disabled={loading}>
                        Save Plan Edits
                      </button>
                    </div>
                  ) : (
                    <p className="muted" style={{ marginTop: 10 }}>
                      No plan yet. Generate one from latest assessment.
                    </p>
                  )}
                </div>
              ) : null}

              {activeTab === "sessions" ? (
                <div style={{ marginTop: 12 }}>
                  <div className="grid-3">
                    <div>
                      <label className="label">Cadence</label>
                      <select className="select" value={cadence} onChange={(event) => setCadence(event.target.value as CoachingCadence)}>
                        <option value="WEEKLY">Weekly</option>
                        <option value="BIWEEKLY">Biweekly</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Sessions</label>
                      <select className="select" value={sessionCount} onChange={(event) => setSessionCount(Number(event.target.value) as 2 | 3)}>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Duration (minutes)</label>
                      <input className="input" type="number" min={20} max={90} value={sessionDuration} onChange={(event) => setSessionDuration(Number(event.target.value))} />
                    </div>
                  </div>

                  <div className="row" style={{ marginTop: 10 }}>
                    <button className="btn primary" onClick={generateSessions} disabled={loading}>
                      <Sparkles size={14} style={{ marginRight: 6 }} />
                      Generate 2-3 Sessions
                    </button>
                    <button className="btn" onClick={scheduleInOutlook} disabled={loading || (!generatedSessions.length && !profile.sessions.length)}>
                      <CalendarPlus2 size={14} style={{ marginRight: 6 }} />
                      Schedule in Outlook
                    </button>
                    <span className="pill">Default cadence: {settings.cadenceDefault.toLowerCase()}</span>
                  </div>

                  <div className="stack" style={{ marginTop: 12 }}>
                    {profile.sessions.map((session) => (
                      <article key={session.id} className="card" style={{ boxShadow: "none" }}>
                        <div className="row">
                          <strong>Session {session.sessionNumber}</strong>
                          <span className="pill">{session.status.toLowerCase()}</span>
                          <span className="pill">{new Date(session.plannedDateTime).toLocaleString()}</span>
                          <span className="pill">{session.durationMinutes} min</span>
                        </div>

                        <div className="row" style={{ marginTop: 6 }}>
                          <span className="pill">Event: {session.calendarEventId ?? "not scheduled"}</span>
                          {session.meetingLink ? (
                            <a className="btn" href={session.meetingLink} target="_blank" rel="noreferrer">
                              Teams link
                            </a>
                          ) : null}
                        </div>

                        <p style={{ marginBottom: 4, marginTop: 10 }}><strong>Agenda</strong></p>
                        <ul style={{ marginTop: 0 }}>
                          {session.agenda.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>

                        <p style={{ marginBottom: 4 }}><strong>Prep checklist</strong></p>
                        <ul style={{ marginTop: 0 }}>
                          {session.prepChecklist.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>

                        <div className="notice">Homework: {session.homeworkAssigned}</div>

                        {session.status !== "COMPLETED" ? (
                          <div className="stack" style={{ marginTop: 8 }}>
                            <textarea className="textarea" placeholder="Outcome notes" value={sessionOutcomeNotes[session.id] ?? ""} onChange={(event) => setSessionOutcomeNotes((current) => ({ ...current, [session.id]: event.target.value }))} />
                            <textarea className="textarea" placeholder="Next steps" value={sessionNextSteps[session.id] ?? ""} onChange={(event) => setSessionNextSteps((current) => ({ ...current, [session.id]: event.target.value }))} />
                            <button className="btn success" onClick={() => completeSession(session)} disabled={loading}>
                              Mark Completed
                            </button>
                          </div>
                        ) : null}
                      </article>
                    ))}

                    {!profile.sessions.length ? (
                      <p className="muted">No sessions yet. Generate and schedule the first coaching sequence.</p>
                    ) : null}

                    {generatedSessions.length ? (
                      <div className="card" style={{ boxShadow: "none" }}>
                        <h3 className="card-title" style={{ fontSize: 16 }}>Generated Session Suggestions</h3>
                        <div className="stack" style={{ marginTop: 8 }}>
                          {generatedSessions.map((session) => (
                            <div key={session.id} className="notice">
                              Session {session.sessionNumber}: {new Date(session.plannedDateTime).toLocaleString()}
                              <div className="muted" style={{ marginTop: 4 }}>
                                Next best options: {session.alternatives.map((alt) => new Date(alt).toLocaleString()).join(" | ")}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <p className="muted">Select a strategic enabler to view profile tabs.</p>
          )}
        </section>
      </div>

      <section className="card" style={{ marginTop: 14 }}>
        <h2 className="card-title">Team Level Distribution and Common Gaps</h2>
        <div className="grid-3" style={{ marginTop: 10 }}>
          <div className="metric">
            <div className="metric-label">Beginner</div>
            <div className="metric-value">{summary?.distribution.Beginner ?? 0}</div>
          </div>
          <div className="metric">
            <div className="metric-label">Intermediate</div>
            <div className="metric-value">{summary?.distribution.Intermediate ?? 0}</div>
          </div>
          <div className="metric">
            <div className="metric-label">Advanced</div>
            <div className="metric-value">{summary?.distribution.Advanced ?? 0}</div>
          </div>
        </div>

        <div className="chips" style={{ marginTop: 10 }}>
          {summary?.topCommonGaps.map((item) => (
            <span key={item.tag} className="pill">
              {item.tag} ({item.count})
            </span>
          ))}
        </div>
      </section>

      {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : null}
      {loading ? <p className="muted">Updating...</p> : null}
    </PageShell>
  );
}
