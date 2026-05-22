"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import ScannerModal from "../ScannerModal";
import styles from "./inventory.module.css";

// ── Add / Edit Spool Modal ────────────────────────────────────────────────────
function SpoolModal({ isOpen, onClose, onSave, initial = {} }) {
  const [showUpcScanner, setShowUpcScanner] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    spool_name: "",
    brand: "",
    color: "",
    hex_color: "",
    material: "",
    spool_count: 1,
    reorder_spool_threshold: 2,
    cost_per_spool: "",
    purchase_url: "",
    upc_code: "",
    ...initial,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setFormError("");
    setForm({
      spool_name: initial.spool_name ?? "",
      brand: initial.brand ?? "",
      color: initial.color ?? "",
      hex_color: initial.hex_color ?? "",
      material: initial.material ?? "",
      spool_count: initial.spool_count ?? 1,
      reorder_spool_threshold: initial.reorder_spool_threshold ?? 2,
      cost_per_spool: initial.cost_per_spool ?? "",
      purchase_url: initial.purchase_url ?? "",
      upc_code: initial.upc_code ?? "",
      ...(initial.id ? { id: initial.id } : {}),
    });
  }, [isOpen]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSave() {
    if (!form.spool_name) return;
    setSaving(true);
    const supabase = createClient();
    const payload = { ...form, spool_count: Number(form.spool_count) || 0, cost_per_spool: Number(form.cost_per_spool) || null };
    
    // Convert empty strings to null for text columns to prevent constraint errors
    if (payload.hex_color === "") payload.hex_color = null;
    if (payload.upc_code === "") payload.upc_code = null;
    if (payload.purchase_url === "") payload.purchase_url = null;
    if (payload.brand === "") payload.brand = null;
    if (payload.color === "") payload.color = null;
    if (payload.material === "") payload.material = null;
    if (payload.reorder_spool_threshold === "") payload.reorder_spool_threshold = null;
    else payload.reorder_spool_threshold = Number(payload.reorder_spool_threshold);

    let result;
    if (form.id) {
      result = await supabase.from("inventory").update(payload).eq("id", form.id).select().single();
    } else {
      result = await supabase.from("inventory").insert(payload).select().single();
    }
    setSaving(false);
    
    if (result.error) {
      console.error("Save Error:", result.error);
      setSaving(false);
      setFormError(result.error.message);
    } else {
      onSave(result.data);
    }
  }

  if (!isOpen) return null;
  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{form.id ? "Edit Spool" : "Add Spool"}</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.fg}>
          <div className={styles.fr}>
            <div>
              <label className={styles.fl}>Spool Name *</label>
              <input className="fi" value={form.spool_name} onChange={e => set("spool_name", e.target.value)} placeholder="Polymaker PLA Matte Black" />
            </div>
            <div>
              <label className={styles.fl}>Brand</label>
              <input className="fi" value={form.brand} onChange={e => set("brand", e.target.value)} placeholder="Polymaker" />
            </div>
          </div>
          <div className={styles.fr}>
            <div>
              <label className={styles.fl}>Color Name</label>
              <input className="fi" value={form.color} onChange={e => set("color", e.target.value)} placeholder="Matte Black" />
            </div>
            <div>
              <label className={styles.fl}>Hex Color</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="color"
                  value={form.hex_color || "#888888"}
                  onChange={e => set("hex_color", e.target.value)}
                  className={styles.colorPicker}
                  title="Pick a color"
                />
                <input
                  className="fi"
                  value={form.hex_color}
                  onChange={e => set("hex_color", e.target.value)}
                  placeholder="#C9A84C"
                  style={{ flex: 1, fontFamily: "sans-serif", fontSize: 12 }}
                />
              </div>
            </div>
            <div>
              <label className={styles.fl}>Material</label>
              <input className="fi" value={form.material} onChange={e => set("material", e.target.value)} placeholder="PLA" />
            </div>
          </div>
          <div className={styles.fr}>
            <div>
              <label className={styles.fl}>Spools on Hand</label>
              <input className="fi" type="number" min="0" value={form.spool_count} onChange={e => set("spool_count", e.target.value)} />
            </div>
            <div>
              <label className={styles.fl}>Reorder At</label>
              <input className="fi" type="number" min="0" value={form.reorder_spool_threshold} onChange={e => set("reorder_spool_threshold", e.target.value)} />
            </div>
            <div>
              <label className={styles.fl}>Cost / Spool ($)</label>
              <input className="fi" type="number" step="0.01" min="0" value={form.cost_per_spool} onChange={e => set("cost_per_spool", e.target.value)} placeholder="24.99" />
            </div>
          </div>
          <div>
            <label className={styles.fl}>UPC / Barcode</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="fi" value={form.upc_code} onChange={e => set("upc_code", e.target.value)} placeholder="123456789012" style={{ flex: 1 }} />
              <button type="button" className="btn sm" onClick={() => setShowUpcScanner(true)} title="Scan barcode">📷</button>
            </div>
          </div>
          <div>
            <label className={styles.fl}>Purchase URL</label>
            <input className="fi" value={form.purchase_url} onChange={e => set("purchase_url", e.target.value)} placeholder="https://…" />
          </div>
        </div>
        {formError && (
          <div style={{ margin: "0 0 4px", padding: "9px 12px", background: "rgba(232,112,112,0.07)", border: "1px solid rgba(232,112,112,0.28)", borderRadius: 4, fontSize: 12, color: "rgba(240,180,180,0.9)", fontFamily: "sans-serif" }}>
            {formError}
          </div>
        )}
        <div className={styles.modalAct}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn pri" onClick={handleSave} disabled={saving || !form.spool_name}>
            {saving ? "Saving…" : "Save Spool"}
          </button>
        </div>
      </div>

      <ScannerModal
        isOpen={showUpcScanner}
        onClose={() => setShowUpcScanner(false)}
        onScan={(code) => { set("upc_code", code); setShowUpcScanner(false); }}
        mode="barcode"
        title="Scan UPC"
        hint="Point at the barcode on the spool box to fill in the UPC automatically."
      />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function InventoryPage() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ msg: "", type: "ok" }); // type: ok | err

  // Scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [scanMode, setScanMode] = useState("intake"); // "intake" | "deplete"

  // Spool modal state
  const [showSpoolModal, setShowSpoolModal] = useState(false);
  const [spoolModalInit, setSpoolModalInit] = useState({});

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("inventory")
      .select("id, spool_name, brand, color, hex_color, material, spool_count, reorder_spool_threshold, cost_per_spool, purchase_url, upc_code")
      .order("spool_name");
    setInventory(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function showToast(msg, type = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "ok" }), 3500);
  }

  async function adjustSpool(id, delta) {
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    const next = Math.max(0, (item.spool_count || 0) + delta);
    const supabase = createClient();
    await supabase.from("inventory").update({ spool_count: next }).eq("id", id);
    setInventory(prev => prev.map(i => i.id === id ? { ...i, spool_count: next } : i));
  }

  async function handleDelete(id) {
    if (!confirm("Delete this spool entry?")) return;
    const supabase = createClient();
    await supabase.from("inventory").delete().eq("id", id);
    load();
  }

  // ── Scanner callbacks ────────────────────────────────────────────────────────
  async function handleBarcodeScan(code) {
    setShowScanner(false);
    const supabase = createClient();
    const { data: match } = await supabase.from("inventory").select("*").eq("upc_code", code).maybeSingle();

    if (scanMode === "intake") {
      if (match) {
        // Known spool — increment by 1
        const next = (match.spool_count || 0) + 1;
        await supabase.from("inventory").update({ spool_count: next }).eq("id", match.id);
        setInventory(prev => prev.map(i => i.id === match.id ? { ...i, spool_count: next } : i));
        showToast(`+1 spool: ${match.spool_name} (now ${next})`);
      } else {
        // Unknown UPC — open add modal pre-filled with the barcode
        setSpoolModalInit({ upc_code: code, spool_count: 1 });
        setShowSpoolModal(true);
        showToast("New UPC — fill in the spool details", "err");
      }
    } else {
      // deplete mode
      if (match) {
        const next = Math.max(0, (match.spool_count || 0) - 1);
        await supabase.from("inventory").update({ spool_count: next }).eq("id", match.id);
        setInventory(prev => prev.map(i => i.id === match.id ? { ...i, spool_count: next } : i));
        showToast(`Depleted 1x ${match.spool_name} — ${next} remaining`);
      } else {
        showToast("UPC not found in inventory", "err");
      }
    }
  }

  function openScanner(mode) {
    setScanMode(mode);
    setShowScanner(true);
  }

  function handleSpoolSaved(data) {
    setShowSpoolModal(false);
    load();
    showToast(`Saved: ${data.spool_name}`);
  }

  return (
    <div>
      {/* Toast */}
      {toast.msg && (
        <div className={`${styles.toast} ${toast.type === "err" ? styles.toastErr : ""}`}>
          {toast.msg}
        </div>
      )}

      <div className="sec-hdr">
        <h1 className={styles.title}>Filament Inventory</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn sm" onClick={() => openScanner("intake")}>
            📷 Scan In New Box
          </button>
          <button className="btn sm" onClick={() => openScanner("deplete")} style={{ color: "rgba(235,185,185,0.85)", borderColor: "rgba(232,112,112,0.25)" }}>
            📷 Scan Depleted
          </button>
          <button className="btn sm pri" onClick={() => { setSpoolModalInit({}); setShowSpoolModal(true); }}>
            + Add Spool
          </button>
        </div>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Spool</th>
              <th>Brand</th>
              <th>Color</th>
              <th>Material</th>
              <th>On Hand</th>
              <th>Reorder At</th>
              <th>Cost</th>
              <th>UPC</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="9" style={{ textAlign: "center" }}>Loading…</td></tr>
            ) : inventory.length === 0 ? (
              <tr><td colSpan="9" style={{ textAlign: "center", color: "var(--dim)" }}>No spools found. Add one or scan a box.</td></tr>
            ) : (
              inventory.map(item => {
                const low = (item.spool_count ?? 0) <= (item.reorder_spool_threshold ?? 1);
                return (
                  <tr key={item.id} className={low ? styles.rowLow : ""}>
                    <td>
                      {(item.hex_color || item.color) && (
                        <span
                          className={styles.colorSwatch}
                          style={{ backgroundColor: item.hex_color || item.color }}
                          title={item.hex_color || item.color}
                        />
                      )}
                      <strong>{item.spool_name}</strong>
                    </td>
                    <td>{item.brand}</td>
                    <td>
                      <span>{item.color}</span>
                      {item.hex_color && (
                        <span style={{ fontFamily: "sans-serif", fontSize: 11, color: "var(--dim)", marginLeft: 6 }}>
                          {item.hex_color}
                        </span>
                      )}
                    </td>
                    <td>{item.material}</td>
                    <td>
                      <button className={styles.adj} onClick={() => adjustSpool(item.id, -1)}>−</button>
                      <span style={{ display: "inline-block", width: 22, textAlign: "center", color: low ? "#e87070" : "var(--goldl)", fontSize: 15, fontWeight: "bold" }}>
                        {item.spool_count || 0}
                      </span>
                      <button className={styles.adj} onClick={() => adjustSpool(item.id, 1)}>+</button>
                    </td>
                    <td>{item.reorder_spool_threshold || 0}</td>
                    <td>${item.cost_per_spool ? parseFloat(item.cost_per_spool).toFixed(2) : "—"}</td>
                    <td style={{ fontFamily: "sans-serif", fontSize: 11, color: "var(--dim)" }}>
                      {item.upc_code || <span style={{ opacity: 0.4 }}>—</span>}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button className="btn sm" onClick={() => { setSpoolModalInit(item); setShowSpoolModal(true); }}>Edit</button>
                        {item.purchase_url && (
                          <a href={item.purchase_url} target="_blank" rel="noopener noreferrer" className="btn sm">Buy ↗</a>
                        )}
                        <button className="btn sm" style={{ color: "#ff6b6b", borderColor: "rgba(255,107,107,0.2)" }} onClick={() => handleDelete(item.id)}>
                          Del
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ScannerModal
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleBarcodeScan}
        mode="barcode"
        title={scanMode === "intake" ? "Scan New Box" : "Scan Depleted Spool"}
        hint={
          scanMode === "intake"
            ? "Point at the UPC barcode on a new spool box. Known spools will be incremented; unknown UPCs will open the Add Spool form."
            : "Point at the UPC barcode on the empty spool. This will decrement the count by 1."
        }
      />

      <SpoolModal
        isOpen={showSpoolModal}
        onClose={() => setShowSpoolModal(false)}
        onSave={handleSpoolSaved}
        initial={spoolModalInit}
      />
    </div>
  );
}
