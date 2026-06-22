"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "../../../lib/supabase/client";
import BundleModal from "./BundleModal";

const TYPE_LABELS = {
  mini_pack:    "Mini Pack",
  hero_bundle:  "Hero Bundle",
  mixed:        "Mixed",
};

const TYPE_COLORS = {
  mini_pack:   { bg: "rgba(91,191,212,0.12)",  color: "#5BBFD4",      border: "rgba(91,191,212,0.3)" },
  hero_bundle: { bg: "rgba(201,168,76,0.12)",  color: "var(--goldl)", border: "rgba(201,168,76,0.3)" },
  mixed:       { bg: "rgba(155,138,196,0.12)", color: "#9B8AC4",      border: "rgba(155,138,196,0.3)" },
};

function computeMargin(bundle) {
  const totalCost = (bundle.bundle_items || []).reduce((sum, item) => {
    return sum + (item.creatures?.cost_to_print || 0) * (item.quantity || 1);
  }, 0);
  const price = parseFloat(bundle.price) || 0;
  const margin = price > 0 ? ((price - totalCost) / price) * 100 : null;
  return { totalCost, margin };
}

export default function BundlesPage() {
  const [bundles,          setBundles]          = useState([]);
  const [creatures,        setCreatures]        = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [typeFilter,       setTypeFilter]       = useState("");
  const [editing,          setEditing]          = useState(null);
  const [modalOpen,        setModalOpen]        = useState(false);
  const [confirmDeleteId,  setConfirmDeleteId]  = useState(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [bundlesRes, creaturesRes] = await Promise.all([
      supabase
        .from("bundles")
        .select("*, bundle_items(*, creatures(id, name, cost_to_print))")
        .order("created_at", { ascending: false }),
      supabase
        .from("creatures")
        .select("id, name, cost_to_print, is_mini")
        .eq("active", true)
        .order("name"),
    ]);
    setBundles(bundlesRes.data || []);
    setCreatures(creaturesRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew()    { setEditing(null); setModalOpen(true); }
  function openEdit(b)  { setEditing(b);    setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditing(null); }

  async function toggleField(id, field, current) {
    const supabase = createClient();
    await supabase.from("bundles").update({ [field]: !current }).eq("id", id);
    setBundles(prev => prev.map(b => b.id === id ? { ...b, [field]: !current } : b));
  }

  async function deleteBundle(id) {
    const supabase = createClient();
    await supabase.from("bundles").delete().eq("id", id);
    setConfirmDeleteId(null);
    setBundles(prev => prev.filter(b => b.id !== id));
  }

  const filtered = typeFilter ? bundles.filter(b => b.bundle_type === typeFilter) : bundles;

  const active      = bundles.filter(b => b.is_active);
  const featured    = bundles.filter(b => b.is_featured);
  const revPotential = active.reduce((s, b) => s + (parseFloat(b.price) || 0), 0);

  if (loading) return <div className="empty-state">Loading…</div>;

  return (
    <div>
      <div className="sec-hdr">
        <h1 style={{ fontFamily: "var(--font-caveat), cursive", fontSize: 28, color: "var(--goldl)", fontWeight: "normal" }}>
          Bundles &amp; Packs
        </h1>
      </div>

      {/* KPI tiles */}
      <div className="kpi-grid" style={{ marginBottom: 28 }}>
        <div className="kpi">
          <div className="kpi-label">Total</div>
          <div className="kpi-val">{bundles.length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Active</div>
          <div className="kpi-val" style={{ color: "#7dc994" }}>{active.length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Featured</div>
          <div className="kpi-val" style={{ color: "var(--goldl)" }}>{featured.length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Rev Potential</div>
          <div className="kpi-val">${revPotential.toFixed(0)}</div>
          <div className="kpi-sub">active bundles</div>
        </div>
      </div>

      {/* Filter bar + New Bundle */}
      <div className="sec-hdr">
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span className="sec-title" style={{ marginRight: 4 }}>All Bundles</span>
          {["", "mini_pack", "hero_bundle", "mixed"].map(t => (
            <button
              key={t}
              type="button"
              className="btn sm"
              style={{
                background:   typeFilter === t ? "rgba(201,168,76,0.12)" : "none",
                borderColor:  typeFilter === t ? "var(--gold)" : "var(--gold-border)",
                color:        typeFilter === t ? "var(--goldl)" : "var(--dim)",
              }}
              onClick={() => setTypeFilter(t)}
            >
              {t ? TYPE_LABELS[t] : "All"}
            </button>
          ))}
        </div>
        <button className="btn sm gold" type="button" onClick={openNew}>+ New Bundle</button>
      </div>

      {/* Bundle table */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          {typeFilter ? `No ${TYPE_LABELS[typeFilter]} bundles yet.` : "No bundles yet. Create one to get started."}
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Price</th>
                <th>Items</th>
                <th>Margin</th>
                <th>Active</th>
                <th>Featured</th>
                <th>Stripe</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => {
                const { margin } = computeMargin(b);
                const marginColor = margin === null
                  ? "var(--dim)"
                  : margin < 50 ? "#e87070" : "#7dc994";
                const ts = TYPE_COLORS[b.bundle_type] || TYPE_COLORS.mixed;
                return (
                  <tr key={b.id}>
                    <td>
                      <div style={{ fontFamily: "var(--font-caveat), cursive", fontSize: 16, color: "var(--cream)" }}>
                        {b.name}
                      </div>
                      {b.badge_text && (
                        <div style={{ fontSize: 10, color: "var(--gold)", fontFamily: "sans-serif", marginTop: 2 }}>
                          {b.badge_text}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="badge" style={{ background: ts.bg, color: ts.color, border: `1px solid ${ts.border}` }}>
                        {TYPE_LABELS[b.bundle_type]}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: "var(--goldl)", fontFamily: "sans-serif" }}>
                        ${parseFloat(b.price).toFixed(2)}
                      </span>
                      {b.compare_at_price && (
                        <span style={{ fontSize: 11, color: "var(--dim)", textDecoration: "line-through", marginLeft: 6, fontFamily: "sans-serif" }}>
                          ${parseFloat(b.compare_at_price).toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td style={{ color: "var(--dim)", fontSize: 12, fontFamily: "sans-serif" }}>
                      {(b.bundle_items || []).length}
                    </td>
                    <td>
                      {margin !== null ? (
                        <span style={{ color: marginColor, fontSize: 12, fontFamily: "sans-serif", fontWeight: margin < 50 ? "bold" : "normal" }}>
                          {margin.toFixed(0)}%
                          {margin < 50 && <span style={{ marginLeft: 4 }}>⚠</span>}
                        </span>
                      ) : (
                        <span style={{ color: "var(--dim)", fontSize: 12, fontFamily: "sans-serif" }}>—</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => toggleField(b.id, "is_active", b.is_active)}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                      >
                        <span className={`badge ${b.is_active ? "badge-green" : "badge-dim"}`}>
                          {b.is_active ? "Live" : "Off"}
                        </span>
                      </button>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => toggleField(b.id, "is_featured", b.is_featured)}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                        title={b.is_featured ? "Remove from featured" : "Mark as featured"}
                      >
                        <span style={{ fontSize: 18, opacity: b.is_featured ? 1 : 0.2, color: "var(--gold)" }}>★</span>
                      </button>
                    </td>
                    <td>
                      <span style={{ fontSize: 10, fontFamily: "sans-serif", color: b.stripe_price_id ? "#7dc994" : "var(--dim)" }}>
                        {b.stripe_price_id ? "◉ Connected" : "◯ Not set"}
                      </span>
                    </td>
                    <td>
                      {confirmDeleteId === b.id ? (
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="btn sm" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                          <button
                            className="btn sm"
                            style={{ color: "#e87070", borderColor: "rgba(232,112,112,0.3)" }}
                            onClick={() => deleteBundle(b.id)}
                          >
                            Delete
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 5 }}>
                          <button className="btn sm" onClick={() => openEdit(b)}>Edit</button>
                          <button
                            className="btn sm"
                            style={{ color: "#e87070", borderColor: "rgba(232,112,112,0.3)" }}
                            onClick={() => setConfirmDeleteId(b.id)}
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <BundleModal
          bundle={editing}
          creatures={creatures}
          onSave={() => { load(); closeModal(); }}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
