"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./mileage.module.css";
import hubStyles from "../hub.module.css";

export default function MileagePage() {
  const [mileage, setMileage] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal & Form State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState(null); // null = adding, object = editing
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formMiles, setFormMiles] = useState("");
  const [formPurpose, setFormPurpose] = useState("Post office — shipping");
  const [formRoundTrip, setFormRoundTrip] = useState(true);
  const [formNotes, setFormNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("mileage")
      .select("*")
      .order("trip_date", { ascending: false });
    
    setMileage(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id) {
    if (!confirm("Delete trip?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("mileage").delete().eq("id", id);
    if (error) {
      alert("Error deleting trip: " + error.message);
    } else {
      load();
    }
  }

  function openAddModal() {
    setEditingTrip(null);
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormMiles("");
    setFormPurpose("Post office — shipping");
    setFormRoundTrip(true);
    setFormNotes("");
    setModalOpen(true);
  }

  function openEditModal(trip) {
    setEditingTrip(trip);
    setFormDate(trip.trip_date || new Date().toISOString().slice(0, 10));
    setFormMiles(trip.miles || "");
    setFormPurpose(trip.purpose || "Post office — shipping");
    setFormRoundTrip(trip.round_trip !== false);
    setFormNotes(trip.notes || "");
    setModalOpen(true);
  }

  async function handleSave() {
    if (!formMiles || isNaN(parseFloat(formMiles)) || parseFloat(formMiles) <= 0) {
      alert("Please enter a valid number of miles.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const payload = {
      trip_date: formDate,
      miles: parseFloat(formMiles),
      purpose: formPurpose,
      round_trip: formRoundTrip,
      notes: formNotes || null
    };

    let error;
    if (editingTrip) {
      const { error: err } = await supabase
        .from("mileage")
        .update(payload)
        .eq("id", editingTrip.id);
      error = err;
    } else {
      const { error: err } = await supabase
        .from("mileage")
        .insert(payload);
      error = err;
    }

    setSaving(false);
    if (error) {
      alert("Error saving trip: " + error.message);
    } else {
      setModalOpen(false);
      load();
    }
  }

  // Calculate actual business miles (doubling miles if round_trip is true)
  const totalMiles = mileage.reduce((sum, m) => {
    const mi = Number(m.miles) || 0;
    return sum + (m.round_trip ? mi * 2 : mi);
  }, 0);

  const irsRate = 0.70; // 2025 IRS standard mileage rate
  const deduction = totalMiles * irsRate;
  
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const thisMonthMiles = mileage.filter(m => {
    if (!m.trip_date) return false;
    const d = new Date(m.trip_date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).reduce((sum, m) => {
    const mi = Number(m.miles) || 0;
    return sum + (m.round_trip ? mi * 2 : mi);
  }, 0);

  return (
    <div>
      <div className="sec-hdr">
        <div>
          <h1 className={styles.title}>Mileage Tracker</h1>
          <div style={{ fontSize: "13px", color: "var(--cream-dim)", marginTop: "4px" }}>
            Log supply runs, post office drops, and other business travel for tax deductions.
          </div>
        </div>
        <button className="btn sm pri" onClick={openAddModal}>+ Log Trip</button>
      </div>

      <div className={styles.kpiRow}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Total Deductible Miles</div>
          <div className={styles.kpiValue}>{totalMiles.toFixed(1)}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>IRS Tax Deduction</div>
          <div className={`${styles.kpiValue} ${styles.green}`}>${deduction.toFixed(2)}</div>
          <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 4 }}>@ $0.70/mile (2025 Standard Rate)</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>This Month</div>
          <div className={styles.kpiValue}>{thisMonthMiles.toFixed(1)}</div>
        </div>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Purpose</th>
              <th>Distance</th>
              <th>Round Trip?</th>
              <th>Notes</th>
              <th style={{ width: 140 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ textAlign: "center" }}>Loading trips...</td></tr>
            ) : mileage.length === 0 ? (
              <tr><td colSpan="6" style={{ textAlign: "center" }}>No trips logged yet. Click "+ Log Trip" to start.</td></tr>
            ) : (
              mileage.map(trip => (
                <tr key={trip.id}>
                  <td>{trip.trip_date ? new Date(trip.trip_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</td>
                  <td>
                    <span className="badge badge-purple">{trip.purpose || "Other business"}</span>
                  </td>
                  <td>
                    {trip.miles} mi {trip.round_trip && <span style={{ color: "var(--gold-light)", fontSize: 11, marginLeft: 4 }}>(×2 Round Trip)</span>}
                  </td>
                  <td>{trip.round_trip ? "Yes" : "No"}</td>
                  <td style={{ color: "var(--cream-dim)", fontSize: 12 }}>{trip.notes || "—"}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button className="btn sm" onClick={() => openEditModal(trip)}>
                        Edit
                      </button>
                      <button className="btn sm" style={{ color: '#ff6b6b', borderColor: 'rgba(255,107,107,0.2)' }} onClick={() => handleDelete(trip.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Log Trip Modal */}
      <div className={`${hubStyles.overlay} ${modalOpen ? hubStyles.open : ""}`}>
        <div className={hubStyles.modal}>
          <div className={hubStyles.modalTitle}>{editingTrip ? "Edit Trip" : "Log Trip"}</div>
          <div className={hubStyles.fg}>
            <div className={hubStyles.fr}>
              <div>
                <label className={hubStyles.fl}>Date</label>
                <input type="date" className="fi" value={formDate} onChange={e => setFormDate(e.target.value)} />
              </div>
              <div>
                <label className={hubStyles.fl}>Miles (One Way)</label>
                <input type="number" step="0.1" placeholder="e.g. 4.5" className="fi" value={formMiles} onChange={e => setFormMiles(e.target.value)} />
              </div>
            </div>
            <div>
              <label className={hubStyles.fl}>Purpose</label>
              <select className="fi" value={formPurpose} onChange={e => setFormPurpose(e.target.value)}>
                <option value="Post office — shipping">Post office — shipping</option>
                <option value="Office Depot / Staples">Office Depot / Staples</option>
                <option value="Supply run — filament">Supply run — filament</option>
                <option value="Supply run — packaging">Supply run — packaging</option>
                <option value="Bank deposit">Bank deposit</option>
                <option value="Other business">Other business</option>
              </select>
            </div>
            <div className={hubStyles.fr}>
              <div>
                <label className={hubStyles.fl}>Round Trip?</label>
                <select className="fi" value={String(formRoundTrip)} onChange={e => setFormRoundTrip(e.target.value === "true")}>
                  <option value="true">Yes — double miles deduction</option>
                  <option value="false">No — one way</option>
                </select>
              </div>
              <div>
                <label className={hubStyles.fl}>Notes</label>
                <input placeholder="optional notes..." className="fi" value={formNotes} onChange={e => setFormNotes(e.target.value)} />
              </div>
            </div>
          </div>
          <div className={hubStyles.modalAct}>
            <button className="btn" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn pri" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Trip"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
