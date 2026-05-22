"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

function checklist(c) {
  return [
    { label: "Image set", ok: !!c.image_url },
    { label: "Etsy link", ok: !!c.etsy_url },
    { label: "Featured", ok: !!c.is_featured },
    { label: "In stock", ok: (c.qty_on_hand || 0) > 0 },
  ];
}

export default function LaunchPage() {
  const [creatures, setCreatures] = useState([]);
  const [subCount, setSubCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [revealDate, setRevealDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [cRes, sRes] = await Promise.all([
        supabase.from("creatures").select("*").eq("in_launch_queue", true).order("log_number"),
        supabase.from("subscribers").select("id", { count: "exact", head: true }).eq("subscribed", true),
      ]);
      setCreatures(cRes.data || []);
      setSubCount(sRes.count || 0);
      setLoading(false);
    }
    load();
  }, []);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  async function scheduleReveal(id) {
    if (!revealDate) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("creatures").update({ reveal_date: new Date(revealDate).toISOString(), is_revealed: false }).eq("id", id);
    setCreatures(prev => prev.map(c => c.id === id ? { ...c, reveal_date: revealDate, is_revealed: false } : c));
    setSaving(false);
    setSelected(null);
    setRevealDate("");
    showToast("Reveal scheduled");
  }

  async function releaseNow(id) {
    setSaving(true);
    const supabase = createClient();
    await supabase.from("creatures").update({ is_revealed: true, reveal_date: null }).eq("id", id);
    setCreatures(prev => prev.map(c => c.id === id ? { ...c, is_revealed: true, reveal_date: null } : c));
    setSaving(false);
    showToast("Creature released!");
  }

  async function clearReveal(id) {
    const supabase = createClient();
    await supabase.from("creatures").update({ reveal_date: null }).eq("id", id);
    setCreatures(prev => prev.map(c => c.id === id ? { ...c, reveal_date: null } : c));
    showToast("Reveal cleared");
  }

  const ready = creatures.filter(c => checklist(c).every(x => x.ok)).length;

  return (
    <div>
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "var(--ink)", border: "1px solid var(--gold)", color: "var(--goldl)", fontSize: 12, letterSpacing: "0.1em", padding: "10px 20px", zIndex: 2000, whiteSpace: "nowrap", borderRadius: 3 }}>
          {toast}
        </div>
      )}

      <div className="sec-hdr">
        <h1 style={{ fontFamily: "var(--font-caveat), cursive", fontSize: "2rem", color: "var(--gold)", margin: 0 }}>🚀 Drop Launch</h1>
      </div>

      <div className="kpi-grid">
        <div className="kpi"><div className="kpi-label">In Queue</div><div className="kpi-val">{creatures.length}</div></div>
        <div className="kpi">
          <div className="kpi-label">Ready</div>
          <div className="kpi-val" style={{ color: ready === creatures.length && creatures.length > 0 ? "#7dc994" : "var(--goldl)" }}>
            {ready}/{creatures.length}
          </div>
        </div>
        <div className="kpi"><div className="kpi-label">Subscribers</div><div className="kpi-val">{subCount}</div></div>
      </div>

      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : creatures.length === 0 ? (
        <div className="empty-state">No creatures in the launch queue — set <code>in_launch_queue</code> on creatures in the Creature Editor</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
          {creatures.map(c => {
            const checks = checklist(c);
            const allReady = checks.every(x => x.ok);
            const isSelected = selected === c.id;

            return (
              <div key={c.id} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${allReady ? "rgba(125,201,148,0.35)" : "var(--gold-border)"}`, borderRadius: 8, overflow: "hidden" }}>
                {c.image_url && <img src={c.image_url} alt={c.name} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover" }} />}
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ fontFamily: "var(--font-caveat), cursive", fontSize: 17, color: "var(--cream)", marginBottom: 10 }}>{c.name}</div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 14 }}>
                    {checks.map(ch => (
                      <div key={ch.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontFamily: "sans-serif" }}>
                        <span style={{ color: ch.ok ? "#7dc994" : "#e87070" }}>{ch.ok ? "✓" : "✗"}</span>
                        <span style={{ color: ch.ok ? "var(--cream-dim)" : "var(--dim)" }}>{ch.label}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    {c.is_revealed ? (
                      <span className="badge badge-green">Live</span>
                    ) : c.reveal_date ? (
                      <span className="badge badge-gold">Scheduled: {new Date(c.reveal_date).toLocaleDateString()}</span>
                    ) : (
                      <span className="badge badge-dim">Not Scheduled</span>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button className="btn sm gold" onClick={() => releaseNow(c.id)} disabled={saving}>Release Now</button>
                    <button className="btn sm" onClick={() => setSelected(isSelected ? null : c.id)}>
                      {isSelected ? "Cancel" : "Schedule"}
                    </button>
                    {c.reveal_date && (
                      <button className="btn sm" style={{ color: "#e87070", borderColor: "rgba(232,112,112,0.3)" }} onClick={() => clearReveal(c.id)}>Clear</button>
                    )}
                  </div>

                  {isSelected && (
                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                      <input
                        type="datetime-local"
                        className="fi"
                        value={revealDate}
                        onChange={e => setRevealDate(e.target.value)}
                        style={{ fontSize: 12 }}
                      />
                      <button
                        className="btn gold"
                        onClick={() => scheduleReveal(c.id)}
                        disabled={!revealDate || saving}
                        style={{ width: "100%", justifyContent: "center" }}
                      >
                        {saving ? "Saving…" : "💾 Save Schedule"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
