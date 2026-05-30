"use client";
import { useState, useEffect, useRef, useCallback } from "react";

// ─── Status helpers ───────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending:           { label: "Pending",          color: "rgba(196,188,178,.45)", pulse: false },
  generating_script: { label: "Writing Script…",  color: "#C9A84C",              pulse: true  },
  generating_video:  { label: "Rendering…",       color: "#5BBFD4",              pulse: true  },
  completed:         { label: "Completed",         color: "#7dc994",              pulse: false },
  failed:            { label: "Failed",            color: "#e87070",              pulse: false },
};

function StatusPill({ status, small }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      fontSize: small ? 10 : 11,
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      color: cfg.color,
    }}>
      <span style={{
        width:  small ? 6 : 8,
        height: small ? 6 : 8,
        borderRadius: "50%",
        background: cfg.color,
        flexShrink: 0,
        boxShadow: cfg.pulse ? `0 0 0 0 ${cfg.color}` : "none",
        animation: cfg.pulse ? "videoPulse 1.4s ease-in-out infinite" : "none",
      }} />
      {cfg.label}
    </span>
  );
}

function ServiceBadge({ label, status }) {
  const done    = status === "completed";
  const failed  = status === "failed";
  const active  = status === "processing";
  const color   = done ? "#7dc994" : failed ? "#e87070" : active ? "#5BBFD4" : "rgba(196,188,178,.3)";
  const text    = done ? "Done" : failed ? "Failed" : active ? "Processing…" : "Waiting";
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "8px 12px",
      background: "rgba(0,0,0,.2)",
      border: `1px solid ${color}30`,
      borderRadius: 4,
      marginBottom: 6,
    }}>
      <span style={{ fontSize: 11, color: "rgba(196,188,178,.6)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontSize: 11, color, letterSpacing: "0.12em", textTransform: "uppercase" }}>
        {(active) && <span style={{ animation: "videoPulse 1.4s ease-in-out infinite", display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: color, marginRight: 6, verticalAlign: "middle" }} />}
        {text}
      </span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function VideoPage() {
  const [campaignInput, setCampaignInput] = useState("");
  const [generating, setGenerating]       = useState(false);
  const [error, setError]                 = useState("");
  const [jobs, setJobs]                   = useState([]);
  const [selectedJob, setSelectedJob]     = useState(null);
  const [loadingJobs, setLoadingJobs]     = useState(true);
  const pollRef = useRef(null);

  // ── Load recent jobs on mount ───────────────────────────────────────────
  const loadJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/video");
      if (!res.ok) return;
      const data = await res.json();
      setJobs(data.jobs || []);
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  // ── Poll active job ─────────────────────────────────────────────────────
  const pollJob = useCallback(async (jobId) => {
    try {
      const res  = await fetch(`/api/video?jobId=${jobId}`);
      const data = await res.json();
      if (!data.job) return;

      const updated = data.job;
      setSelectedJob(updated);
      setJobs(prev => prev.map(j => j.id === jobId ? {
        ...j,
        status:        updated.status,
        did_status:    updated.did_status,
        runway_status: updated.runway_status,
        output_url:    updated.output_url,
        error:         updated.error,
      } : j));

      // Stop polling when terminal
      if (updated.status === "completed" || updated.status === "failed") {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    } catch (e) {
      console.error("Poll error:", e);
    }
  }, []);

  function startPolling(jobId) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => pollJob(jobId), 3000);
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // ── Select a job and start/stop polling ────────────────────────────────
  function selectJob(job) {
    setSelectedJob(job);
    if (job.status === "generating_script" || job.status === "generating_video") {
      startPolling(job.id);
    } else if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  // ── Generate a new video ────────────────────────────────────────────────
  async function generate() {
    if (!campaignInput.trim() || generating) return;
    setGenerating(true);
    setError("");

    try {
      const res  = await fetch("/api/video", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ campaignInput: campaignInput.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Generation failed");
        return;
      }

      const newJob = {
        id:            data.jobId,
        status:        data.status,
        campaign_input: campaignInput.trim(),
        claude_script: data.script,
        did_status:    data.did_talk_id    ? "processing" : "failed",
        runway_status: data.runway_task_id ? "processing" : "failed",
        output_url:    null,
        error:         null,
        created_at:    new Date().toISOString(),
      };

      setJobs(prev => [newJob, ...prev]);
      setCampaignInput("");
      selectJob(newJob);
      startPolling(data.jobId);
    } catch (e) {
      setError("Network error: " + e.message);
    } finally {
      setGenerating(false);
    }
  }

  function fmtTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) + " · " +
           d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  const isActive  = (s) => s === "generating_script" || s === "generating_video";
  const activeJob = jobs.find(j => isActive(j.status));

  return (
    <div>
      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes videoPulse {
          0%   { box-shadow: 0 0 0 0 currentColor; opacity: 1; }
          70%  { box-shadow: 0 0 0 6px transparent; opacity: .6; }
          100% { box-shadow: 0 0 0 0 transparent; opacity: 1; }
        }
        .vj-row:hover { background: rgba(201,168,76,.04) !important; }
        .vj-row.selected { background: rgba(201,168,76,.07) !important; border-color: rgba(201,168,76,.3) !important; }
        .script-block { background: rgba(0,0,0,.25); border: 1px solid rgba(201,168,76,.1); border-radius: 4; padding: 14px; margin-bottom: 12px; }
        .overlay-pill {
          display: inline-block; padding: 4px 12px;
          background: rgba(201,168,76,.1); border: 1px solid rgba(201,168,76,.25);
          border-radius: 20px; font-size: 11px; color: var(--goldl, #E8D08A);
          letter-spacing: .06em; margin: 3px 3px 3px 0;
        }
      `}</style>

      <div className="sec-hdr">
        <h1 style={{ fontFamily: "var(--font-caveat, cursive)", fontSize: "2rem", color: "var(--gold, #C9A84C)", margin: 0 }}>
          Video Engine
        </h1>
        {activeJob && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <StatusPill status={activeJob.status} small />
          </div>
        )}
      </div>
      <div style={{ fontSize: 12, color: "rgba(196,188,178,.4)", marginBottom: 24, letterSpacing: ".06em" }}>
        AI-generated short-form video — script · talking head · B-roll backdrop
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24, alignItems: "start" }}>

        {/* ── LEFT: Compose + Queue ──────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Compose */}
          <div style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(201,168,76,.15)", borderRadius: 8, padding: "20px 24px" }}>
            <div className="sec-hdr" style={{ marginBottom: 16 }}>
              <span className="sec-title">Campaign Brief</span>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label className="fl">Describe your video</label>
              <textarea
                className="fi"
                rows={5}
                value={campaignInput}
                onChange={e => setCampaignInput(e.target.value)}
                placeholder={`Example:\n"Holiday flexi dragon — Ember. Limited drop. Targets gift buyers on Instagram. Whimsical, warm tone. Include Field Notes lore card mention."`}
                disabled={generating}
                style={{ resize: "vertical", fontFamily: "inherit" }}
              />
            </div>
            <div style={{ fontSize: 11, color: "rgba(196,188,178,.35)", marginBottom: 16, lineHeight: 1.6 }}>
              Include: creature name, drop type, target platform, tone, any special features. Claude writes the script. D-ID renders the presenter. Runway generates the B-roll.
            </div>

            {error && (
              <div style={{ color: "#e87070", fontSize: 12, marginBottom: 12, padding: "8px 12px", background: "rgba(232,112,112,.07)", border: "1px solid rgba(232,112,112,.2)", borderRadius: 4 }}>
                {error}
              </div>
            )}

            <button
              className="btn pri"
              onClick={generate}
              disabled={generating || !campaignInput.trim()}
              style={{ width: "100%" }}
            >
              {generating ? "Generating…" : "▶ Generate Video"}
            </button>
          </div>

          {/* Job Queue */}
          <div style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(201,168,76,.15)", borderRadius: 8, padding: "20px 24px" }}>
            <div className="sec-hdr" style={{ marginBottom: 16 }}>
              <span className="sec-title">Generation Queue</span>
              <button className="btn sm" onClick={loadJobs}>↺ Refresh</button>
            </div>

            {loadingJobs ? (
              <div style={{ color: "rgba(196,188,178,.3)", fontSize: 12, textAlign: "center", padding: "24px 0" }}>Loading…</div>
            ) : jobs.length === 0 ? (
              <div style={{ color: "rgba(196,188,178,.3)", fontSize: 12, textAlign: "center", padding: "24px 0" }}>
                No videos generated yet. Write a brief above to start.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {jobs.map(job => (
                  <div
                    key={job.id}
                    className={`vj-row${selectedJob?.id === job.id ? " selected" : ""}`}
                    onClick={() => selectJob(job)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 14px",
                      background: "rgba(0,0,0,.15)",
                      border: "1px solid rgba(201,168,76,.08)",
                      borderRadius: 4,
                      cursor: "pointer",
                      transition: "background .15s, border-color .15s",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: "rgba(250,246,240,.8)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 3 }}>
                        {job.campaign_input || "—"}
                      </div>
                      <div style={{ fontSize: 10, color: "rgba(196,188,178,.35)", letterSpacing: "0.08em" }}>
                        {fmtTime(job.created_at)}
                      </div>
                    </div>
                    <StatusPill status={job.status} small />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Job Detail ──────────────────────────────────────────── */}
        <div style={{ position: "sticky", top: 80 }}>
          {!selectedJob ? (
            <div style={{
              background: "rgba(255,255,255,.02)", border: "1px solid rgba(201,168,76,.1)",
              borderRadius: 8, padding: "48px 24px", textAlign: "center",
            }}>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: .3 }}>▶</div>
              <div style={{ fontSize: 12, color: "rgba(196,188,178,.3)", letterSpacing: ".08em" }}>
                Select a job or generate a new video to see details here
              </div>
            </div>
          ) : (
            <div style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(201,168,76,.15)", borderRadius: 8, overflow: "hidden" }}>

              {/* Header */}
              <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(201,168,76,.1)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <StatusPill status={selectedJob.status} />
                <span style={{ fontSize: 10, color: "rgba(196,188,178,.3)", letterSpacing: ".08em" }}>
                  {fmtTime(selectedJob.created_at)}
                </span>
              </div>

              <div style={{ padding: "16px 20px", maxHeight: "calc(100vh - 280px)", overflowY: "auto" }}>

                {/* Brief */}
                <div style={{ fontSize: 11, color: "rgba(196,188,178,.45)", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 6 }}>Brief</div>
                <div style={{ fontSize: 12, color: "rgba(250,246,240,.7)", marginBottom: 18, lineHeight: 1.5 }}>
                  {selectedJob.campaign_input}
                </div>

                {/* Service status */}
                {(selectedJob.did_status || selectedJob.runway_status) && (
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 11, color: "rgba(196,188,178,.45)", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 8 }}>Render Status</div>
                    <ServiceBadge label="D-ID  —  Talking Head" status={selectedJob.did_status} />
                    <ServiceBadge label="Runway  —  B-Roll"     status={selectedJob.runway_status} />
                  </div>
                )}

                {/* Script preview */}
                {selectedJob.claude_script && (() => {
                  const s = selectedJob.claude_script;
                  return (
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 11, color: "rgba(196,188,178,.45)", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 10 }}>Generated Script</div>

                      {s.avatar_script && (
                        <div className="script-block">
                          <div style={{ fontSize: 10, color: "rgba(201,168,76,.5)", letterSpacing: ".16em", textTransform: "uppercase", marginBottom: 8 }}>Presenter Script</div>
                          <div style={{ fontSize: 12, color: "rgba(250,246,240,.8)", lineHeight: 1.7 }}>{s.avatar_script}</div>
                        </div>
                      )}

                      {Array.isArray(s.overlay_text_segments) && s.overlay_text_segments.length > 0 && (
                        <div className="script-block">
                          <div style={{ fontSize: 10, color: "rgba(201,168,76,.5)", letterSpacing: ".16em", textTransform: "uppercase", marginBottom: 8 }}>Overlay Text</div>
                          {s.overlay_text_segments.map((t, i) => (
                            <span key={i} className="overlay-pill">{t}</span>
                          ))}
                        </div>
                      )}

                      {s.b_roll_prompt && (
                        <div className="script-block">
                          <div style={{ fontSize: 10, color: "rgba(91,191,212,.5)", letterSpacing: ".16em", textTransform: "uppercase", marginBottom: 8 }}>B-Roll Prompt</div>
                          <div style={{ fontSize: 11, color: "rgba(196,188,178,.55)", lineHeight: 1.65, fontStyle: "italic" }}>{s.b_roll_prompt}</div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Error */}
                {selectedJob.status === "failed" && selectedJob.error && (
                  <div style={{ padding: "10px 14px", background: "rgba(232,112,112,.07)", border: "1px solid rgba(232,112,112,.2)", borderRadius: 4, fontSize: 12, color: "#e87070", lineHeight: 1.5, marginBottom: 16 }}>
                    <strong>Error:</strong> {selectedJob.error}
                  </div>
                )}

                {/* Output video */}
                {selectedJob.output_url && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: "rgba(196,188,178,.45)", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 10 }}>Output</div>
                    <video
                      src={selectedJob.output_url}
                      controls
                      style={{ width: "100%", borderRadius: 4, background: "#000", border: "1px solid rgba(201,168,76,.15)" }}
                    />
                    <a
                      href={selectedJob.output_url}
                      download
                      target="_blank"
                      rel="noopener"
                      className="btn gold"
                      style={{ display: "block", width: "100%", textAlign: "center", marginTop: 10, textDecoration: "none", boxSizing: "border-box" }}
                    >
                      ↓ Download MP4
                    </a>
                    {selectedJob.claude_script?._runway_video_url && (
                      <a
                        href={selectedJob.claude_script._runway_video_url}
                        download
                        target="_blank"
                        rel="noopener"
                        className="btn"
                        style={{ display: "block", width: "100%", textAlign: "center", marginTop: 6, textDecoration: "none", boxSizing: "border-box", fontSize: 11 }}
                      >
                        ↓ Download B-Roll (Runway)
                      </a>
                    )}
                  </div>
                )}

                {/* Still rendering indicator */}
                {isActive(selectedJob.status) && (
                  <div style={{ textAlign: "center", padding: "16px 0", fontSize: 11, color: "rgba(196,188,178,.35)", letterSpacing: ".1em" }}>
                    Polling every 3s… page will update automatically
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
