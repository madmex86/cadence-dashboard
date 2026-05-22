"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_LINKS = [
  { id: 1, label: "Etsy Shop", sub_label: "Browse all creatures", url: "https://etsy.com/shop/CadenceCreatures", icon: "🛒", enabled: true },
  { id: 2, label: "The Bestiary", sub_label: "All creatures", url: "https://cadencecreatures.com/the-bestiary", icon: "📖", enabled: true },
  { id: 3, label: "Instagram", sub_label: "@cadencecreatures", url: "https://instagram.com/cadencecreatures", icon: "📸", enabled: true },
];

export default function LinksPage() {
  const [links, setLinks] = useState([]);
  const [tagline, setTagline] = useState("Find your creature.");
  const [footer, setFooter] = useState("© 2026 Cadence Creatures");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase.from("site_settings").select("links_config").eq("id", 1).single();
      if (data?.links_config) {
        const cfg = typeof data.links_config === "string" ? JSON.parse(data.links_config) : data.links_config;
        setLinks(cfg.links || DEFAULT_LINKS);
        setTagline(cfg.tagline || "Find your creature.");
        setFooter(cfg.footer || "© 2026 Cadence Creatures");
      } else {
        setLinks(DEFAULT_LINKS);
      }
      setLoading(false);
    }
    load();
  }, []);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  async function save() {
    setSaving(true);
    const supabase = createClient();
    await supabase.from("site_settings").update({
      links_config: JSON.stringify({ links, tagline, footer }),
    }).eq("id", 1);
    setSaving(false);
    showToast("Links saved");
  }

  function addLink() {
    setLinks(prev => [...prev, { id: Date.now(), label: "", sub_label: "", url: "", icon: "🔗", enabled: true }]);
  }

  function removeLink(id) {
    setLinks(prev => prev.filter(l => l.id !== id));
  }

  function updateLink(id, field, value) {
    setLinks(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  }

  function move(id, dir) {
    const idx = links.findIndex(l => l.id === id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= links.length) return;
    const newLinks = [...links];
    [newLinks[idx], newLinks[newIdx]] = [newLinks[newIdx], newLinks[idx]];
    setLinks(newLinks);
  }

  return (
    <div>
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "var(--ink)", border: "1px solid var(--gold)", color: "var(--goldl)", fontSize: 12, letterSpacing: "0.1em", padding: "10px 20px", zIndex: 2000, whiteSpace: "nowrap", borderRadius: 3 }}>
          {toast}
        </div>
      )}

      <div className="sec-hdr">
        <h1 style={{ fontFamily: "var(--font-caveat), cursive", fontSize: "2rem", color: "var(--gold)", margin: 0 }}>Links Manager</h1>
        <button className="btn gold" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save All"}</button>
      </div>

      {loading ? <div className="empty-state">Loading…</div> : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24 }}>
          {/* Editor */}
          <div>
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--gold-border)", borderRadius: 8, padding: "20px 24px", marginBottom: 16 }}>
              <div className="sec-hdr" style={{ marginBottom: 14 }}><span className="sec-title">Brand</span></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label className="fl">Tagline</label>
                  <input className="fi" value={tagline} onChange={e => setTagline(e.target.value)} />
                </div>
                <div>
                  <label className="fl">Footer Text</label>
                  <input className="fi" value={footer} onChange={e => setFooter(e.target.value)} />
                </div>
              </div>
            </div>

            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--gold-border)", borderRadius: 8, padding: "20px 24px" }}>
              <div className="sec-hdr" style={{ marginBottom: 14 }}>
                <span className="sec-title">Links</span>
                <button className="btn" onClick={addLink}>+ Add Link</button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {links.map((link, i) => (
                  <div key={link.id} style={{ background: "rgba(0,0,0,0.15)", border: "1px solid var(--gold-border)", borderRadius: 4, padding: "12px" }}>
                    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <input className="fi" style={{ width: 48, textAlign: "center", padding: "8px 4px" }} value={link.icon} onChange={e => updateLink(link.id, "icon", e.target.value)} placeholder="🔗" />
                      <input className="fi" style={{ flex: 1 }} value={link.label} onChange={e => updateLink(link.id, "label", e.target.value)} placeholder="Label" />
                      <input className="fi" style={{ flex: 1 }} value={link.sub_label} onChange={e => updateLink(link.id, "sub_label", e.target.value)} placeholder="Sub-label" />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input className="fi" style={{ flex: 1 }} value={link.url} onChange={e => updateLink(link.id, "url", e.target.value)} placeholder="https://…" />
                      <button className={`btn sm${link.enabled ? " gold" : ""}`} onClick={() => updateLink(link.id, "enabled", !link.enabled)}>
                        {link.enabled ? "On" : "Off"}
                      </button>
                      <button className="btn sm" onClick={() => move(link.id, -1)} disabled={i === 0}>▲</button>
                      <button className="btn sm" onClick={() => move(link.id, 1)} disabled={i === links.length - 1}>▼</button>
                      <button className="btn sm" style={{ color: "#e87070", borderColor: "rgba(232,112,112,0.3)" }} onClick={() => removeLink(link.id)}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div>
            <div style={{ background: "var(--ink)", border: "1px solid var(--gold-border)", borderRadius: 8, overflow: "hidden", position: "sticky", top: 80 }}>
              <div style={{ background: "rgba(201,168,76,0.06)", borderBottom: "1px solid var(--gold-border)", padding: "8px 12px" }}>
                <span style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--dim)", fontFamily: "sans-serif" }}>Preview</span>
              </div>
              <div style={{ padding: 24, textAlign: "center" }}>
                <svg width="36" height="28" viewBox="0 -2 76 52" fill="none" style={{ marginBottom: 12 }}>
                  <path d="M6 44 L6 18 L22 32 L36 4 L50 32 L66 18 L66 44 Z" fill="none" stroke="#C9A84C" strokeWidth="2.5" strokeLinejoin="round" />
                  <rect x="4" y="42" width="64" height="3" rx="1.5" fill="#C9A84C" />
                  <circle cx="36" cy="4" r="5.5" fill="#E8D08A" />
                  <circle cx="6" cy="18" r="4" fill="#5BBFD4" />
                  <circle cx="66" cy="18" r="4" fill="#5BBFD4" />
                </svg>
                <div style={{ fontFamily: "var(--font-caveat), cursive", fontSize: 20, color: "var(--gold)", marginBottom: 4 }}>Cadence Creatures</div>
                <div style={{ fontSize: 11, color: "var(--dim)", fontFamily: "sans-serif", marginBottom: 20 }}>{tagline}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {links.filter(l => l.enabled).map(link => (
                    <div key={link.id} style={{ background: "rgba(201,168,76,0.06)", border: "1px solid var(--gold-border)", borderRadius: 4, padding: "10px 14px", textAlign: "left" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 16 }}>{link.icon}</span>
                        <div>
                          <div style={{ fontSize: 12, color: "var(--cream)", letterSpacing: "0.06em" }}>{link.label || "—"}</div>
                          {link.sub_label && <div style={{ fontSize: 10, color: "var(--dim)", fontFamily: "sans-serif" }}>{link.sub_label}</div>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 20, fontSize: 10, color: "var(--dim)", fontFamily: "sans-serif" }}>{footer}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
