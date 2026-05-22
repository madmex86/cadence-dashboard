"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function CamiPage() {
  const [creatures, setCreatures] = useState([]);
  const [portalEnabled, setPortalEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [creaturesRes, settingsRes] = await Promise.all([
        supabase.from("creatures").select("*").eq("is_cami_edition", true).order("log_number"),
        supabase.from("site_settings").select("cami_portal_enabled").eq("id", 1).single(),
      ]);
      setCreatures(creaturesRes.data || []);
      setPortalEnabled(settingsRes.data?.cami_portal_enabled ?? false);
      setLoading(false);
    }
    load();
  }, []);

  async function togglePortal() {
    const supabase = createClient();
    const newVal = !portalEnabled;
    await supabase.from("site_settings").update({ cami_portal_enabled: newVal }).eq("id", 1);
    setPortalEnabled(newVal);
  }

  async function adjustStock(id, delta) {
    const c = creatures.find(x => x.id === id);
    const newQty = Math.max(0, (c.qty_on_hand || 0) + delta);
    const supabase = createClient();
    await supabase.from("creatures").update({ qty_on_hand: newQty }).eq("id", id);
    setCreatures(prev => prev.map(x => x.id === id ? { ...x, qty_on_hand: newQty } : x));
  }

  async function toggleField(id, field, current) {
    const supabase = createClient();
    await supabase.from("creatures").update({ [field]: !current }).eq("id", id);
    setCreatures(prev => prev.map(x => x.id === id ? { ...x, [field]: !current } : x));
  }

  const totalStock = creatures.reduce((s, c) => s + (c.qty_on_hand || 0), 0);
  const available = creatures.filter(c => (c.qty_on_hand || 0) > 0).length;

  return (
    <div>
      <div className="sec-hdr">
        <h1 style={{ fontFamily: "var(--font-caveat), cursive", fontSize: "2rem", color: "var(--gold)", margin: 0 }}>✦ Cami Edition</h1>
      </div>

      <div style={{ background: "rgba(155,138,196,0.06)", border: "1px solid rgba(155,138,196,0.22)", borderRadius: 6, padding: "16px 20px", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, color: "var(--cream)", letterSpacing: "0.08em" }}>Cami Portal</div>
          <div style={{ fontSize: 11, color: "var(--dim)", fontFamily: "sans-serif", marginTop: 3 }}>
            Controls the ✦ stars on the public site that let visitors discover the Cami portal
          </div>
        </div>
        <button className={`btn${portalEnabled ? " gold" : ""}`} onClick={togglePortal}>
          {portalEnabled ? "✦ Portal Active" : "Portal Off"}
        </button>
      </div>

      <div className="kpi-grid">
        <div className="kpi"><div className="kpi-label">Creatures</div><div className="kpi-val">{creatures.length}</div></div>
        <div className="kpi"><div className="kpi-label">Total Stock</div><div className="kpi-val">{totalStock}</div></div>
        <div className="kpi"><div className="kpi-label">Available</div><div className="kpi-val">{available}</div></div>
        <div className="kpi"><div className="kpi-label">Sold Out</div><div className="kpi-val">{creatures.length - available}</div></div>
      </div>

      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : creatures.length === 0 ? (
        <div className="empty-state">No Cami Edition creatures yet — mark creatures as Cami Edition in the Creature Editor</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 16 }}>
          {creatures.map(c => (
            <div key={c.id} style={{ background: "rgba(155,138,196,0.04)", border: "1px solid rgba(155,138,196,0.18)", borderRadius: 8, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              {c.image_url && (
                <img src={c.image_url} alt={c.name} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover" }} />
              )}
              <div style={{ padding: "14px 16px", flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <div style={{ fontFamily: "var(--font-caveat), cursive", fontSize: 17, color: "var(--cream)" }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: "rgba(155,138,196,0.7)", fontFamily: "sans-serif", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                    Log #{String(c.log_number || 0).padStart(3, "0")} · {c.species || "Flexi Creature"}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button className="btn" style={{ width: 32, height: 32, padding: 0, fontSize: 18, lineHeight: 1 }} onClick={() => adjustStock(c.id, -1)}>−</button>
                  <span style={{ fontFamily: "var(--font-caveat), cursive", fontSize: 22, color: (c.qty_on_hand || 0) > 0 ? "var(--goldl)" : "#e87070", minWidth: 28, textAlign: "center" }}>
                    {c.qty_on_hand || 0}
                  </span>
                  <button className="btn" style={{ width: 32, height: 32, padding: 0, fontSize: 18, lineHeight: 1 }} onClick={() => adjustStock(c.id, 1)}>+</button>
                  <span style={{ fontSize: 11, color: "var(--dim)", fontFamily: "sans-serif" }}>
                    {(c.qty_on_hand || 0) > 0 ? "In Stock" : "Sold Out"}
                  </span>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button className={`btn sm${c.active ? " gold" : ""}`} onClick={() => toggleField(c.id, "active", c.active)}>Active</button>
                  <button className={`btn sm${c.is_featured ? " gold" : ""}`} onClick={() => toggleField(c.id, "is_featured", c.is_featured)}>Featured</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
