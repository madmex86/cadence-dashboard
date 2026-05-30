"use client";
import { useState, useEffect, useRef, useCallback } from "react";

// ─── Progress helpers ─────────────────────────────────────────────────────────
// Three phases, each worth 1/3 of the bar:
//   Script (Claude)  →  Presenter (D-ID)  →  B-Roll (Runway)
function getPhases(job) {
  if (!job) return [];
  const scriptDone   = !!job.claude_script;
  const didDone      = job.did_status    === "completed";
  const didFailed    = job.did_status    === "failed";
  const runwayDone   = job.runway_status === "completed";
  const runwayFailed = job.runway_status === "failed";

  const scriptRunning  = job.status === "generating_script";
  const didRunning     = !didDone    && !didFailed    && scriptDone;
  const runwayRunning  = !runwayDone && !runwayFailed && scriptDone;

  return [
    {
      label:   "Script",
      sub:     "Claude",
      done:    scriptDone,
      running: scriptRunning,
      failed:  false,
    },
    {
      label:   "Presenter",
      sub:     "D-ID",
      done:    didDone,
      running: didRunning,
      failed:  didFailed,
    },
    {
      label:   "B-Roll",
      sub:     "Runway",
      done:    runwayDone,
      running: runwayRunning,
      failed:  runwayFailed,
    },
  ];
}

// Typical render durations in seconds per service
const ETA_SECONDS = { script: 8, did: 50, runway: 100 };

function fmt(secs) {
  if (secs <= 0)  return "any moment…";
  if (secs < 60)  return `~${secs}s`;
  return `~${Math.ceil(secs / 60)}m`;
}

function ProgressBar({ job }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!job?.dispatched_at) { setElapsed(0); return; }
    const start = new Date(job.dispatched_at).getTime();
    const tick  = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    setElapsed(Math.floor((Date.now() - start) / 1000));
    return () => clearInterval(tick);
  }, [job?.id, job?.dispatched_at]);

  if (!job || job.status === "pending") return null;

  const phases    = getPhases(job);
  const completed = job.status === "completed";

  return (
    <div style={{ marginBottom: 18 }}>
      {/* Track */}
      <div style={{
        height: 4, background: "rgba(255,255,255,.08)", borderRadius: 2,
        overflow: "hidden", marginBottom: 10, position: "relative",
      }}>
        {completed ? (
          <div style={{ position: "absolute", inset: 0, background: "#7dc994" }} />
        ) : phases.map((p, i) => {
          const color = p.failed ? "#e87070" : p.done ? "#7dc994" : "#C9A84C";
          const fill  = p.done ? "33.33%" : p.running ? "33.33%" : "0%";
          return (
            <div key={i} style={{
              position: "absolute", top: 0, left: `${i * 33.33}%`,
              height: "100%", width: fill,
              background: color, transition: "width .6s ease",
              animation: (p.running && !p.done) ? "shimmer 1.6s ease-in-out infinite" : undefined,
            }} />
          );
        })}
      </div>

      {/* Phase labels + ETAs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
        {phases.map((p, i) => {
          const etaKey   = ["script", "did", "runway"][i];
          const estimate = ETA_SECONDS[etaKey];
          const remaining = Math.max(0, estimate - elapsed);
          const color = p.failed ? "#e87070" : p.done || completed ? "#7dc994" : p.running ? "#C9A84C" : "rgba(196,188,178,.25)";
          const icon  = p.failed ? "✕" : p.done || completed ? "✓" : p.running ? "⟳" : "·";
          const align = i === 0 ? "left" : i === 1 ? "center" : "right";

          return (
            <div key={i} style={{ textAlign: align }}>
              <div style={{ fontSize: 10, color, letterSpacing: ".08em", transition: "color .4s" }}>
                <span style={{ display: "inline-block", animation: p.running ? "spin 1.2s linear infinite" : "none", marginRight: 3 }}>
                  {icon}
                </span>
                {p.label}
              </div>
              <div style={{ fontSize: 9, letterSpacing: ".06em", marginTop: 1 }}>
                {p.running && !p.done ? (
                  <span style={{ color: remaining > 0 ? "rgba(201,168,76,.55)" : "rgba(91,191,212,.7)" }}>
                    {fmt(remaining)}
                  </span>
                ) : p.done ? (
                  <span style={{ color: "rgba(125,201,148,.5)" }}>
                    {elapsed > 0 ? `${elapsed}s` : "done"}
                  </span>
                ) : (
                  <span style={{ color: "rgba(196,188,178,.2)" }}>{p.sub}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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

// ─── Studio Preview Compositor ────────────────────────────────────────────────
function Compositor({ scriptMeta }) {
  const canvasRef = useRef(null);
  const runwayRef = useRef(null);
  const didRef = useRef(null);
  const [recording, setRecording] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let animId;

    function render() {
      if (!canvas || !runwayRef.current || !didRef.current) return;
      const runway = runwayRef.current;
      const did = didRef.current;

      // 1. Draw Runway B-roll as full background
      if (runway.readyState >= 2) {
        ctx.drawImage(runway, 0, 0, canvas.width, canvas.height);
      } else {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // 2. Draw D-ID Avatar in circular mask (TikTok reaction style)
      if (did.readyState >= 2) {
        const radius = 140;
        const x = 180;
        const y = canvas.height - 180;

        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        
        ctx.drawImage(did, x - radius, y - radius, radius * 2, radius * 2);
        ctx.restore();

        // draw border around circular mask
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.lineWidth = 6;
        ctx.strokeStyle = "rgba(201, 168, 76, 0.8)";
        ctx.stroke();
      }

      // 3. Render Overlay Text Segments
      const segments = scriptMeta.overlay_text_segments || [];
      if (segments.length > 0) {
        ctx.fillStyle = "white";
        ctx.font = "bold 56px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 12;
        
        const duration = runway.duration || 5;
        const time = runway.currentTime;
        const segmentDuration = duration / segments.length;
        const index = Math.floor(time / segmentDuration);
        
        if (segments[index]) {
          const text = segments[index].toUpperCase();
          ctx.fillText(text, canvas.width / 2, 120);
        }
      }

      animId = requestAnimationFrame(render);
    }

    render();
    return () => cancelAnimationFrame(animId);
  }, [scriptMeta]);

  function startRecording() {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setDownloadUrl(null);
    setRecording(true);
    chunksRef.current = [];

    const stream = canvasRef.current.captureStream(30);
    
    try {
      if (didRef.current.captureStream) {
        const didStream = didRef.current.captureStream();
        didStream.getAudioTracks().forEach(track => stream.addTrack(track));
      }
    } catch(e) {
      console.warn("Audio mixing failed", e);
    }

    const mr = new MediaRecorder(stream, { mimeType: "video/webm" });
    mediaRecorderRef.current = mr;
    mr.ondataavailable = e => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      setDownloadUrl(URL.createObjectURL(blob));
      setRecording(false);
    };

    mr.start();

    runwayRef.current.currentTime = 0;
    didRef.current.currentTime = 0;
    runwayRef.current.play();
    didRef.current.play();

    runwayRef.current.onended = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }

  const hasVideos = scriptMeta?._runway_video_url && scriptMeta?._did_video_url;
  if (!hasVideos) return null;

  return (
    <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: 16, border: "1px solid rgba(201,168,76,.15)", marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: "rgba(201,168,76,.8)", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 12 }}>
        Studio Preview & Compositor
      </div>
      
      <div style={{ display: "none" }}>
        <video ref={runwayRef} src={`/api/proxy-video?url=${encodeURIComponent(scriptMeta._runway_video_url)}`} crossOrigin="anonymous" playsInline />
        <video ref={didRef} src={`/api/proxy-video?url=${encodeURIComponent(scriptMeta._did_video_url)}`} crossOrigin="anonymous" playsInline />
      </div>
      
      <div style={{ position: "relative", width: "100%", aspectRatio: "1280/720", background: "#000", borderRadius: 4, overflow: "hidden", marginBottom: 12 }}>
        <canvas ref={canvasRef} width={1280} height={720} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn" onClick={() => {
          runwayRef.current.currentTime = 0;
          didRef.current.currentTime = 0;
          runwayRef.current.play();
          didRef.current.play();
        }} style={{ flex: 1 }}>
          ▶ Play Preview
        </button>
        <button className="btn gold" onClick={startRecording} disabled={recording} style={{ flex: 1 }}>
          {recording ? "🔴 Recording..." : "⏺ Composite & Record"}
        </button>
      </div>

      {downloadUrl && (
        <a href={downloadUrl} download="cadence_creatures_video.webm" className="btn pri" style={{ display: "block", textAlign: "center", marginTop: 10, textDecoration: "none" }}>
          ↓ Download Final Video
        </a>
      )}
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

  async function retryService(service) {
    if (!selectedJob) return;
    try {
      const res = await fetch("/api/video", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: selectedJob.id, service }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Retry failed"); return; }
      // Optimistically update local state and start polling
      const updated = {
        ...selectedJob,
        status: "generating_video",
        ...(service === "runway" ? { runway_status: "processing" } : { did_status: "processing" }),
      };
      setSelectedJob(updated);
      setJobs(prev => prev.map(j => j.id === selectedJob.id ? updated : j));
      startPolling(selectedJob.id);
    } catch (e) {
      setError("Retry failed: " + e.message);
    }
  }

  return (
    <div>
      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes videoPulse {
          0%   { box-shadow: 0 0 0 0 currentColor; opacity: 1; }
          70%  { box-shadow: 0 0 0 6px transparent; opacity: .6; }
          100% { box-shadow: 0 0 0 0 transparent; opacity: 1; }
        }
        @keyframes shimmer {
          0%   { opacity: .55; }
          50%  { opacity: 1;   }
          100% { opacity: .55; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
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
        @media (max-width: 860px) {
          .video-layout { grid-template-columns: 1fr !important; }
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

      <div className="video-layout" style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24, alignItems: "start", minWidth: 0 }}>

        {/* ── LEFT: Compose + Queue ──────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0, overflow: "hidden" }}>

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
                style={{ resize: "vertical", fontFamily: "inherit", width: "100%", boxSizing: "border-box" }}
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
                    <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                      <div style={{
                        fontSize: 12, color: "rgba(250,246,240,.8)", marginBottom: 3,
                        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                        overflow: "hidden", lineHeight: 1.4,
                      }}>
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
        <div style={{ position: "sticky", top: 80, minWidth: 0, overflow: "hidden" }}>
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

                {/* Progress bar */}
                <ProgressBar job={selectedJob} />

                {/* Brief */}
                <div style={{ fontSize: 11, color: "rgba(196,188,178,.45)", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 6 }}>Brief</div>
                <div style={{ fontSize: 12, color: "rgba(250,246,240,.7)", marginBottom: 18, lineHeight: 1.5 }}>
                  {selectedJob.campaign_input}
                </div>

                {/* Retry buttons — only shown when a service fails */}
                {(selectedJob.did_status === "failed" || selectedJob.runway_status === "failed") && selectedJob.claude_script && (
                  <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                    {selectedJob.did_status === "failed" && (
                      <button className="btn sm" onClick={() => retryService("did")} style={{ fontSize: 10 }}>
                        ↺ Retry Presenter
                      </button>
                    )}
                    {selectedJob.runway_status === "failed" && (
                      <button className="btn sm" onClick={() => retryService("runway")} style={{ fontSize: 10 }}>
                        ↺ Retry B-Roll
                      </button>
                    )}
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

                {/* Output video via Compositor */}
                {selectedJob.status === "completed" && selectedJob.claude_script?._runway_video_url && selectedJob.claude_script?._did_video_url && (
                  <Compositor scriptMeta={selectedJob.claude_script} />
                )}

                {/* Fallback separate download links if compositing is not supported or videos are missing */}
                {selectedJob.output_url && (!selectedJob.claude_script?._runway_video_url || !selectedJob.claude_script?._did_video_url) && (
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
                      ↓ Download Primary Media
                    </a>
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
