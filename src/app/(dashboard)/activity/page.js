"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const TYPE_COLORS = {
  Create: "#7dc994",
  Update: "var(--goldl)",
  Delete: "#e87070",
  Status: "var(--teal)",
  Other: "var(--cream-dim)",
};

function getType(action) {
  const a = (action || "").toLowerCase();
  if (a.includes("creat") || a.includes("add")) return "Create";
  if (a.includes("delet") || a.includes("remov")) return "Delete";
  if (a.includes("status") || a.includes("ship") || a.includes("complet")) return "Status";
  if (a.includes("updat") || a.includes("edit") || a.includes("chang")) return "Update";
  return "Other";
}

function relTime(ts) {
  const diff = (Date.now() - new Date(ts)) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export default function ActivityPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300)
      .then(({ data }) => { setLogs(data || []); setLoading(false); });

    const channel = supabase
      .channel("activity-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_log" }, payload => {
        setLogs(prev => [payload.new, ...prev]);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const today = new Date();
  const todayCount = logs.filter(l => {
    const d = new Date(l.created_at);
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  }).length;

  const users = [...new Set(logs.map(l => l.user_name).filter(Boolean))];

  const filtered = logs.filter(l => {
    const matchSearch = !search ||
      (l.action || "").toLowerCase().includes(search.toLowerCase()) ||
      (l.user_name || "").toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "All" || getType(l.action) === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div>
      <div className="sec-hdr">
        <h1 style={{ fontFamily: "var(--font-caveat), cursive", fontSize: "2rem", color: "var(--gold)", margin: 0 }}>Activity Log</h1>
      </div>

      <div className="kpi-grid">
        <div className="kpi"><div className="kpi-label">Total Events</div><div className="kpi-val">{logs.length}</div></div>
        <div className="kpi"><div className="kpi-label">Today</div><div className="kpi-val">{todayCount}</div></div>
        <div className="kpi"><div className="kpi-label">Team Members</div><div className="kpi-val">{users.length}</div></div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <input
          className="fi"
          style={{ maxWidth: 260 }}
          placeholder="Search actions, users…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["All", "Create", "Update", "Delete", "Status", "Other"].map(t => (
            <button key={t} className={`btn sm${typeFilter === t ? " gold" : ""}`} onClick={() => setTypeFilter(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">No activity found</div>
      ) : (
        <div>
          {filtered.map((log, i) => {
            const type = getType(log.action);
            const color = TYPE_COLORS[type];
            return (
              <div key={log.id || i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 14px", borderBottom: "1px solid rgba(201,168,76,0.06)" }}>
                <span style={{
                  flexShrink: 0, fontSize: 10, fontFamily: "sans-serif",
                  padding: "2px 8px", background: `rgba(0,0,0,0.15)`,
                  border: `1px solid ${color}`, color,
                  borderRadius: 3, textAlign: "center",
                  textTransform: "uppercase", letterSpacing: "0.08em",
                  marginTop: 2, whiteSpace: "nowrap",
                }}>{type}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "var(--cream-dim)", lineHeight: 1.4 }}>{log.action}</div>
                  {log.order_id && (
                    <div style={{ fontSize: 11, color: "var(--dim)", fontFamily: "sans-serif", marginTop: 2 }}>Order #{log.order_id}</div>
                  )}
                </div>
                <div style={{ flexShrink: 0, textAlign: "right" }}>
                  {log.user_name && <div style={{ fontSize: 11, fontFamily: "sans-serif", color: "var(--goldl)" }}>{log.user_name}</div>}
                  <div style={{ fontSize: 11, fontFamily: "sans-serif", color: "var(--dim)", marginTop: 2 }}>{relTime(log.created_at)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
