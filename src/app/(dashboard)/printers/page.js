"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import ScannerModal from "../ScannerModal";
import styles from "./printers.module.css";

// ── Maintenance Log Modal ─────────────────────────────────────────────────────
const MAINTENANCE_TYPES = [
  "Nozzle Replaced",
  "Bed Leveled",
  "Jam Cleared",
  "PTFE Tube Replaced",
  "Lubricated Rails",
  "Firmware Updated",
  "Calibrated",
  "Other",
];

function MaintenanceModal({ isOpen, onClose, printer, onSaved }) {
  const [type, setType] = useState(MAINTENANCE_TYPES[0]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) { setType(MAINTENANCE_TYPES[0]); setNotes(""); }
  }, [isOpen]);

  async function handleSave() {
    if (!printer) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("activity_log").insert({
      action: `Maintenance — ${printer.name}: ${type}${notes ? " — " + notes : ""}`,
      details: { printer_id: printer.id, printer_name: printer.name, maintenance_type: type, notes: notes || null },
    });
    setSaving(false);
    onSaved();
  }

  if (!isOpen || !printer) return null;
  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Log Maintenance</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--dim)", fontFamily: "sans-serif" }}>
          Printer: <strong style={{ color: "var(--goldl)" }}>{printer.name}</strong>
        </p>
        <div className={styles.fg}>
          <div>
            <label className={styles.fl}>Maintenance Type</label>
            <select className="fi" value={type} onChange={e => setType(e.target.value)}>
              {MAINTENANCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={styles.fl}>Notes (optional)</label>
            <textarea className="fi" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. 0.4mm brass nozzle, ~200hrs" />
          </div>
        </div>
        <div className={styles.modalAct}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn pri" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Log Entry"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Assign Job Modal ──────────────────────────────────────────────────────────
function AssignJobModal({ isOpen, onClose, printer, onAssigned }) {
  const [creaturesList, setCreaturesList] = useState([]);
  const [job, setJob] = useState("Other");
  const [customJob, setCustomJob] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setCustomJob("");
    async function fetchCreatures() {
      const supabase = createClient();
      const { data } = await supabase.from("creatures").select("id, name").order("name");
      const list = data || [];
      setCreaturesList(list);
      setJob(list[0]?.name || "Other");
    }
    fetchCreatures();
  }, [isOpen]);

  async function handleAssign() {
    if (!printer) return;
    setSaving(true);
    const finalJob = job === "Other" ? customJob : job;

    // Resolve current_creature_id by name lookup
    const matchingCreature = job !== "Other" ? creaturesList.find(c => c.name === job) : null;
    const creatureId = matchingCreature ? matchingCreature.id : null;

    const supabase = createClient();
    
    const { data, error } = await supabase
      .from("printers")
      .update({ 
        current_job: finalJob, 
        status: "printing",
        current_creature_id: creatureId
      })
      .eq("id", printer.id)
      .select()
      .single();
      
    setSaving(false);
    if (!error) onAssigned(data);
  }

  if (!isOpen || !printer) return null;
  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Assign Job</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--dim)" }}>
          Printer: <strong style={{ color: "var(--goldl)" }}>{printer.name}</strong>
        </p>
        <div className={styles.fg}>
          <div>
            <label className={styles.fl}>Select Creature</label>
            <select className="fi" value={job} onChange={e => setJob(e.target.value)}>
              {creaturesList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              <option value="Other">Other</option>
            </select>
          </div>
          {job === "Other" && (
            <div>
              <label className={styles.fl}>Custom Job Name</label>
              <input className="fi" value={customJob} onChange={e => setCustomJob(e.target.value)} placeholder="e.g. Test Cube" />
            </div>
          )}
        </div>
        <div className={styles.modalAct}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn pri" onClick={handleAssign} disabled={saving || (job === "Other" && !customJob)}>
            {saving ? "Assigning…" : "Start Print"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Printer Modal ─────────────────────────────────────────────────────────
function AddPrinterModal({ isOpen, onClose, onSaved }) {
  const [form, setForm] = useState({ name: "", type: "Bambu Lab A1 Mini", ip_address: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (isOpen) { setForm({ name: "", type: "Bambu Lab A1 Mini", ip_address: "" }); setFormError(""); }
  }, [isOpen]);

  async function handleSave() {
    if (!form.name) return;
    setSaving(true);
    const supabase = createClient();
    
    const payload = {
      name: form.name,
      type: form.type,
      model: form.type, // Sync model column with type
      ip_address: form.ip_address || null,
      status: "idle",
      current_job: null
    };

    const result = await supabase.from("printers").insert(payload).select().single();
    setSaving(false);
    
    if (result.error) {
      console.error(result.error);
      setSaving(false);
      setFormError(result.error.message);
    } else {
      onSaved(result.data);
    }
  }

  if (!isOpen) return null;
  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Add Printer</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.fg}>
          <div>
            <label className={styles.fl}>Printer Name *</label>
            <input className="fi" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Printer 04" />
          </div>
          <div>
            <label className={styles.fl}>Model / Type</label>
            <select className="fi" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
              <option value="Bambu Lab A1 Mini">Bambu Lab A1 Mini</option>
              <option value="Bambu Lab P1S">Bambu Lab P1S</option>
              <option value="Bambu Lab X1C">Bambu Lab X1C</option>
              <option value="Prusa MK4">Prusa MK4</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className={styles.fl}>IP Address (Optional)</label>
            <input className="fi" value={form.ip_address} onChange={e => setForm({...form, ip_address: e.target.value})} placeholder="192.168.1.x" />
          </div>
        </div>
        {formError && (
          <div style={{ margin: "0 0 4px", padding: "9px 12px", background: "rgba(232,112,112,0.07)", border: "1px solid rgba(232,112,112,0.28)", borderRadius: 4, fontSize: 12, color: "rgba(240,180,180,0.9)", fontFamily: "sans-serif" }}>
            {formError}
          </div>
        )}
        <div className={styles.modalAct}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn pri" onClick={handleSave} disabled={saving || !form.name}>
            {saving ? "Saving…" : "Save Printer"}
          </button>
        </div>
      </div>
    </div>
  );
}
  
// ── Edit Printer Modal ─────────────────────────────────────────────────────────
function EditPrinterModal({ isOpen, onClose, printer, onSaved }) {
  const [form, setForm] = useState({ name: "", type: "Bambu Lab A1 Mini", ip_address: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (isOpen && printer) {
      setForm({
        name: printer.name || "",
        type: printer.type || "Bambu Lab A1 Mini",
        ip_address: printer.ip_address || ""
      });
      setFormError("");
    }
  }, [isOpen, printer]);

  async function handleSave() {
    if (!form.name || !printer) return;
    setSaving(true);
    const supabase = createClient();
    
    const payload = {
      name: form.name,
      type: form.type,
      model: form.type, // Sync model column with type
      ip_address: form.ip_address || null
    };

    const { data, error } = await supabase
      .from("printers")
      .update(payload)
      .eq("id", printer.id)
      .select()
      .single();

    setSaving(false);
    
    if (error) {
      console.error(error);
      setFormError(error.message);
    } else {
      onSaved(data);
    }
  }

  if (!isOpen || !printer) return null;
  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Edit Printer</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.fg}>
          <div>
            <label className={styles.fl}>Printer Name *</label>
            <input className="fi" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Printer 04" />
          </div>
          <div>
            <label className={styles.fl}>Model / Type</label>
            <select className="fi" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
              <option value="Bambu Lab A1 Mini">Bambu Lab A1 Mini</option>
              <option value="Bambu Lab P1S">Bambu Lab P1S</option>
              <option value="Bambu Lab X1C">Bambu Lab X1C</option>
              <option value="Prusa MK4">Prusa MK4</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className={styles.fl}>IP Address (Optional)</label>
            <input className="fi" value={form.ip_address} onChange={e => setForm({...form, ip_address: e.target.value})} placeholder="192.168.1.x" />
          </div>
        </div>
        {formError && (
          <div style={{ margin: "0 0 4px", padding: "9px 12px", background: "rgba(232,112,112,0.07)", border: "1px solid rgba(232,112,112,0.28)", borderRadius: 4, fontSize: 12, color: "rgba(240,180,180,0.9)", fontFamily: "sans-serif" }}>
            {formError}
          </div>
        )}
        <div className={styles.modalAct}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn pri" onClick={handleSave} disabled={saving || !form.name}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PrintersPage() {
  const [printers, setPrinters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ msg: "", type: "ok" });

  // Scanner
  const [showScanner, setShowScanner] = useState(false);
  const highlightRef = useRef(null); // id of printer card to scroll-highlight

  // Maintenance modal
  const [showMaintenance, setShowMaintenance] = useState(false);
  const [activePrinter, setActivePrinter] = useState(null);

  // Add Printer modal
  const [showAddModal, setShowAddModal] = useState(false);

  // Edit Printer modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editPrinter, setEditPrinter] = useState(null);

  // Assign Job modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignPrinter, setAssignPrinter] = useState(null);

  const cardRefs = useRef({});

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("printers")
      .select("id, name, type, status, current_job, ip_address, current_creature_id")
      .order("name");
    setPrinters(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function showToast(msg, type = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "ok" }), 3500);
  }

  async function clearJob(id) {
    const supabase = createClient();
    await supabase.from("printers").update({ current_job: null, status: "idle", current_creature_id: null }).eq("id", id);
    setPrinters(prev => prev.map(p => p.id === id ? { ...p, current_job: null, status: "idle", current_creature_id: null } : p));
    showToast("Job cleared");
  }

  // ── Scanner callback ──────────────────────────────────────────────────────
  function handleQrScan(decoded) {
    setShowScanner(false);

    // QR sticker encodes the printer's Supabase UUID (plain text)
    const scannedId = decoded.trim();
    const found = printers.find(p => p.id === scannedId);

    if (!found) {
      showToast("QR code not linked to a printer in this fleet", "err");
      return;
    }

    // Scroll to and highlight the card, then open maintenance modal
    showToast(`Found: ${found.name}`);
    highlightRef.current = found.id;

    setTimeout(() => {
      cardRefs.current[found.id]?.scrollIntoView({ behavior: "smooth", block: "center" });
      setActivePrinter(found);
      setShowMaintenance(true);
    }, 300);
  }

  function openMaintenanceFor(printer) {
    setActivePrinter(printer);
    setShowMaintenance(true);
  }

  function handleMaintenanceSaved() {
    setShowMaintenance(false);
    showToast("Maintenance entry logged");
  }

  function handlePrinterEdited(updatedPrinter) {
    setShowEditModal(false);
    setPrinters(prev => prev.map(p => p.id === updatedPrinter.id ? updatedPrinter : p));
    showToast(`Updated ${updatedPrinter.name}`);
  }

  return (
    <div>
      {toast.msg && (
        <div className={`${styles.toast} ${toast.type === "err" ? styles.toastErr : ""}`}>
          {toast.msg}
        </div>
      )}

      <div className="sec-hdr">
        <h1 className={styles.title}>Printers & Fleet</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn sm" onClick={() => setShowScanner(true)}>
            📷 Scan Printer QR
          </button>
          <button className="btn sm pri" onClick={() => setShowAddModal(true)}>+ Add Printer</button>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">Loading printers…</div>
      ) : printers.length === 0 ? (
        <div className="empty-state">No printers found.</div>
      ) : (
        <div className={styles.grid}>
          {printers.map(printer => {
            const isHighlighted = highlightRef.current === printer.id;
            return (
              <div
                key={printer.id}
                ref={el => { cardRefs.current[printer.id] = el; }}
                className={`${styles.card} ${isHighlighted ? styles.cardHighlight : ""}`}
                onAnimationEnd={() => { highlightRef.current = null; }}
              >
                <div className={styles.cardHeader}>
                  <div className={styles.name}>{printer.name}</div>
                  <div
                    className={`${styles.statusIndicator} ${styles["status-" + (printer.status || "offline").toLowerCase()]}`}
                    title={printer.status}
                  />
                </div>

                <div className={styles.detailRow}>
                  Model: <strong>{printer.type || "Unknown"}</strong>
                </div>
                <div className={styles.detailRow}>
                  Status: <strong style={{ textTransform: "capitalize" }}>{printer.status || "Offline"}</strong>
                </div>
                {printer.current_job && (
                  <div className={styles.detailRow}>
                    Current Job: <strong>{printer.current_job}</strong>
                  </div>
                )}
                {printer.ip_address && (
                  <div className={styles.detailRow}>
                    IP: <strong>{printer.ip_address}</strong>
                  </div>
                )}

                <div className={styles.actions}>
                  {printer.current_job ? (
                    <button 
                      className="btn sm" 
                      style={{ color: "#ff6b6b", borderColor: "rgba(255,107,107,0.3)" }}
                      onClick={() => clearJob(printer.id)}
                    >
                      Clear Job
                    </button>
                  ) : (
                    <button 
                      className="btn sm" 
                      style={{ color: "var(--teal)", borderColor: "rgba(91,191,212,0.3)" }}
                      onClick={() => { setAssignPrinter(printer); setShowAssignModal(true); }}
                    >
                      Assign Job
                    </button>
                  )}
                  <button 
                    className="btn sm" 
                    style={{ color: "var(--goldl)", borderColor: "rgba(201,168,76,0.3)" }} 
                    onClick={() => { setEditPrinter(printer); setShowEditModal(true); }}
                  >
                    Edit
                  </button>
                  <button className="btn sm" style={{ color: "var(--goldl)", borderColor: "rgba(201,168,76,0.3)" }} onClick={() => openMaintenanceFor(printer)}>
                    + Maintenance
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* QR code hint strip */}
      <div className={styles.qrHint}>
        <span>💡</span>
        <span>
          Each printer's QR sticker should encode its Supabase ID (found in the URL when you add a printer).
          Scanning the sticker jumps straight to the maintenance log.
        </span>
      </div>

      <ScannerModal
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleQrScan}
        mode="qr"
        title="Scan Printer QR"
        hint="Point at the QR sticker on the printer. You'll be taken straight to its maintenance log."
      />

      <MaintenanceModal
        isOpen={showMaintenance}
        onClose={() => setShowMaintenance(false)}
        printer={activePrinter}
        onSaved={handleMaintenanceSaved}
      />

      <AddPrinterModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSaved={(newPrinter) => {
          setShowAddModal(false);
          load();
          showToast(`Added ${newPrinter.name}`);
        }}
      />

      <EditPrinterModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        printer={editPrinter}
        onSaved={handlePrinterEdited}
      />

      <AssignJobModal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        printer={assignPrinter}
        onAssigned={(updatedPrinter) => {
          setShowAssignModal(false);
          setPrinters(prev => prev.map(p => p.id === updatedPrinter.id ? updatedPrinter : p));
          showToast(`Assigned ${updatedPrinter.current_job} to ${updatedPrinter.name}`);
        }}
      />
    </div>
  );
}

