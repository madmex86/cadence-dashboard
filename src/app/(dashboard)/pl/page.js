"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./pl.module.css";

const IRS_RATE = 0.70;

// ── Finance Modal ─────────────────────────────────────────────────────────────
function FinanceModal({ isOpen, onClose, entry, type, onSaved }) {
  const [form, setForm] = useState({ amount: "", entry_date: "", category: "", description: "", invoice_number: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (entry) {
      setForm({ amount: entry.amount ?? "", entry_date: entry.entry_date ?? "", category: entry.category ?? "", description: entry.description ?? "", invoice_number: entry.invoice_number ?? "" });
    } else {
      setForm({ amount: "", entry_date: new Date().toISOString().slice(0, 10), category: "", description: "", invoice_number: "" });
    }
  }, [isOpen, entry]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const payload = {
      entry_type: type,
      amount: parseFloat(form.amount) || 0,
      category: form.category || null,
      description: form.description || null,
      invoice_number: form.invoice_number || null,
      entry_date: form.entry_date || new Date().toISOString().slice(0, 10),
    };
    if (entry?.id) {
      const { error } = await supabase.from("finance").update(payload).eq("id", entry.id);
      if (error) { alert("Error saving: " + error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("finance").insert(payload);
      if (error) { alert("Error saving: " + error.message); setSaving(false); return; }
    }
    setSaving(false);
    onSaved();
  }

  if (!isOpen) return null;
  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{entry ? `Edit ${type}` : `Add ${type}`}</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.fg}>
          <div className={styles.fr}>
            <div>
              <label className={styles.fl}>Amount ($)</label>
              <input className="fi" type="number" step="0.01" value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className={styles.fl}>Date</label>
              <input className="fi" type="date" value={form.entry_date} onChange={e => set("entry_date", e.target.value)} />
            </div>
          </div>
          <div className={styles.fr}>
            <div>
              <label className={styles.fl}>Category</label>
              <input className="fi" value={form.category} onChange={e => set("category", e.target.value)} placeholder={type === "income" ? "Etsy Sale, Convention…" : "Filament, Shipping…"} />
            </div>
            <div>
              <label className={styles.fl}>Description</label>
              <input className="fi" value={form.description} onChange={e => set("description", e.target.value)} />
            </div>
          </div>
          <div>
            <label className={styles.fl}>Invoice # (optional)</label>
            <input className="fi" value={form.invoice_number} onChange={e => set("invoice_number", e.target.value)} placeholder="INV-001" style={{ maxWidth: 200 }} />
          </div>
        </div>
        <div className={styles.modalAct}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn pri" onClick={handleSave} disabled={saving || !form.amount}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Mileage Modal ─────────────────────────────────────────────────────────────
function MileageModal({ isOpen, onClose, onSaved }) {
  const [form, setForm] = useState({ trip_date: "", miles: "", purpose: "", round_trip: "false", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setForm({ trip_date: new Date().toISOString().slice(0, 10), miles: "", purpose: "", round_trip: "false", notes: "" });
  }, [isOpen]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    await supabase.from("mileage").insert({
      trip_date: form.trip_date,
      miles: parseFloat(form.miles) || 0,
      purpose: form.purpose || null,
      round_trip: form.round_trip === "true",
      notes: form.notes || null,
    });
    setSaving(false);
    onSaved();
  }

  if (!isOpen) return null;
  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Log Trip</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.fg}>
          <div className={styles.fr}>
            <div>
              <label className={styles.fl}>Date</label>
              <input className="fi" type="date" value={form.trip_date} onChange={e => set("trip_date", e.target.value)} />
            </div>
            <div>
              <label className={styles.fl}>Miles</label>
              <input className="fi" type="number" step="0.1" value={form.miles} onChange={e => set("miles", e.target.value)} placeholder="0.0" />
            </div>
          </div>
          <div>
            <label className={styles.fl}>Purpose</label>
            <input className="fi" value={form.purpose} onChange={e => set("purpose", e.target.value)} placeholder="Post office run, supplies…" />
          </div>
          <div className={styles.fr}>
            <div>
              <label className={styles.fl}>Round Trip?</label>
              <select className="fi" value={form.round_trip} onChange={e => set("round_trip", e.target.value)}>
                <option value="false">One-way</option>
                <option value="true">Round trip</option>
              </select>
            </div>
            <div>
              <label className={styles.fl}>Notes</label>
              <input className="fi" value={form.notes} onChange={e => set("notes", e.target.value)} />
            </div>
          </div>
        </div>
        <div className={styles.modalAct}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn pri" onClick={handleSave} disabled={saving || !form.miles}>
            {saving ? "Saving…" : "Log Trip"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 30-day sparkline (pure SVG, no deps) ─────────────────────────────────────
function SparkChart({ fin }) {
  const W = 100, H = 50, DAYS = 30;
  const today = new Date();
  const buckets = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (DAYS - 1 - i));
    return { date: d.toISOString().slice(0, 10), rev: 0, exp: 0 };
  });
  fin.forEach(f => {
    const b = buckets.find(b => b.date === (f.entry_date || "").slice(0, 10));
    if (!b) return;
    const amt = Math.abs(parseFloat(f.amount) || 0);
    if (f.entry_type && String(f.entry_type).toLowerCase() === "income") b.rev += amt;
    else b.exp += amt;
  });
  const maxVal = Math.max(...buckets.map(b => Math.max(b.rev, b.exp)), 1);
  const pts = key => buckets.map((b, i) => `${(i / (DAYS - 1)) * W},${H - (b[key] / maxVal) * H * 0.88}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: "100%", display: "block" }}>
      <defs>
        <linearGradient id="revG" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#C9A84C" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#C9A84C" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${H} ${pts("rev")} ${W},${H}`} fill="url(#revG)" />
      <polyline points={pts("rev")} fill="none" stroke="#C9A84C" strokeWidth="0.8" />
      <polyline points={pts("exp")} fill="none" stroke="#a84444" strokeWidth="0.8" strokeDasharray="2 1.5" />
    </svg>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PLPage() {
  const [tab, setTab] = useState("overview");
  const [fin, setFin] = useState([]);
  const [miles, setMiles] = useState([]);
  const [creatures, setCreatures] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ msg: "", type: "ok" });
  const [finModal, setFinModal] = useState({ open: false, entry: null, type: "income" });
  const [mileModal, setMileModal] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());

  const loadFin = useCallback(async () => {
    const supabase = createClient();
    const [finRes, ordRes] = await Promise.all([
      supabase.from("finance").select("*").order("entry_date", { ascending: false }),
      supabase.from("orders").select("id, total_amount, status, order_date, etsy_order_id, buyer_name").neq("status", "cancelled")
    ]);
    const rawFin = finRes.data || [];
    const ords = ordRes.data || [];
    
    // Map orders to finance entries if they haven't been manually imported
    const existingOrderIds = new Set(rawFin.filter(f => f.order_id).map(f => f.order_id));
    const nowISO = new Date().toISOString().slice(0, 10);
    const orderFin = ords.filter(o => !existingOrderIds.has(o.id)).map(o => ({
      id: `virtual-${o.id}`,
      entry_type: "income",
      category: "Etsy Sale",
      description: `Order #${o.etsy_order_id || o.id.slice(0, 8)}${o.buyer_name ? " — " + o.buyer_name : ""}`,
      amount: o.total_amount,
      entry_date: o.order_date || nowISO,
      order_id: o.id,
      isVirtual: true // Mark as virtual so we don't try to edit/delete it as a finance row
    }));
    
    // Sort combined by date
    const combined = [...rawFin, ...orderFin].sort((a, b) => (b.entry_date || "").localeCompare(a.entry_date || ""));
    setFin(combined);
    setOrders(ords);
  }, []);

  const loadMiles = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("mileage").select("*").order("trip_date", { ascending: false });
    setMiles(data || []);
  }, []);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      await loadFin();
      const [miRes, creRes] = await Promise.all([
        supabase.from("mileage").select("*").order("trip_date", { ascending: false }),
        supabase.from("creatures").select("id, name, sku, log_number, price_retail, price_etsy, cost_to_print, qty_on_hand").order("log_number"),
      ]);
      setMiles(miRes.data || []);
      setCreatures(creRes.data || []);
      setLoading(false);
    }
    load();
  }, [loadFin]);

  function showToast(msg, type = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "ok" }), 3500);
  }

  const fmt = v => "$" + Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const now = new Date();

  // Available years derived from all stored data (always include current year)
  const years = [...new Set([
    now.getFullYear(),
    ...fin.map(f => f.entry_date ? parseInt(f.entry_date.slice(0, 4)) : null).filter(Boolean),
    ...miles.map(m => m.trip_date ? parseInt(m.trip_date.slice(0, 4)) : null).filter(Boolean),
  ])].sort((a, b) => b - a);

  // Year-filtered slices — all calculations below use these
  const finY = year === "All" ? fin : fin.filter(f => f.entry_date && parseInt(f.entry_date.slice(0, 4)) === year);
  const miY  = year === "All" ? miles : miles.filter(m => m.trip_date && parseInt(m.trip_date.slice(0, 4)) === year);

  const sumType = type => finY.filter(e => e.entry_type && String(e.entry_type).toLowerCase() === type).reduce((s, e) => s + Math.abs(parseFloat(e.amount) || 0), 0);

  const rev = sumType("income");
  const exp = sumType("expense");
  const net = rev - exp;
  const margin = rev > 0 ? (net / rev * 100) : 0;

  const targetYear = year === "All" ? now.getFullYear() : year;

  const moNet = finY.filter(e => {
    if (!e.entry_date) return false;
    const y = parseInt(e.entry_date.slice(0, 4));
    const m = parseInt(e.entry_date.slice(5, 7)) - 1;
    return m === now.getMonth() && y === targetYear;
  }).reduce((s, e) => s + (e.entry_type && String(e.entry_type).toLowerCase() === "income" ? 1 : -1) * Math.abs(parseFloat(e.amount) || 0), 0);

  const qtr = Math.floor(now.getMonth() / 3);
  const qtrNet = finY.filter(e => {
    if (!e.entry_date) return false;
    const y = parseInt(e.entry_date.slice(0, 4));
    const m = parseInt(e.entry_date.slice(5, 7)) - 1;
    return Math.floor(m / 3) === qtr && y === targetYear;
  }).reduce((s, e) => s + (e.entry_type && String(e.entry_type).toLowerCase() === "income" ? 1 : -1) * Math.abs(parseFloat(e.amount) || 0), 0);

  const totalMiles = miY.reduce((s, m) => s + (parseFloat(m.miles) || 0), 0);



  async function deleteFin(id) {
    const supabase = createClient();
    await supabase.from("finance").delete().eq("id", id);
    loadFin();
    showToast("Deleted");
    setDeleteFinConfirmId(null);
  }

  async function deleteMile(id) {
    const supabase = createClient();
    await supabase.from("mileage").delete().eq("id", id);
    loadMiles();
    showToast("Deleted");
    setDeleteMileConfirmId(null);
  }

  function exportCSV() {
    const timestamp = new Date().toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short"
    });
    const yrLabel = year === "All" ? "All Years" : year;
    const closingLine = "“And so another creature found its way into the world, carrying her name a little further.”";

    if (tab === "mileage") {
      const dedValStr = (totalMiles * IRS_RATE).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      
      const csvHeader = [
        `"Cadence Creatures — Mileage Log"`,
        `"${closingLine.replace(/"/g, '""')}"`,
        `"Exported On:","${timestamp}"`,
        `"Tax Year:","${yrLabel}"`,
        `"Total Miles:","${totalMiles.toFixed(1)} mi"`,
        `"Deductible Value:","$${dedValStr}"`,
        `"Trips Logged:","${miY.length}"`,
        `""` // Empty spacer row
      ];

      const headers = ["Date", "Year", "Purpose", "Miles", "Round Trip", "Notes", "Deductible Value"];
      const dataRows = miY.map(m => {
        const date = m.trip_date || "";
        const yrVal = date ? date.slice(0, 4) : "";
        const purpose = `"${(m.purpose || "").replace(/"/g, '""')}"`;
        const milesVal = Number(m.miles || 0).toFixed(1);
        const roundTrip = m.round_trip ? "Yes" : "No";
        const notes = `"${(m.notes || "").replace(/"/g, '""')}"`;
        const dedVal = (parseFloat(m.miles) * IRS_RATE).toFixed(2);
        
        return [date, yrVal, purpose, milesVal, roundTrip, notes, dedVal].join(",");
      });

      const csvRows = [...csvHeader, headers.join(","), ...dataRows];
      const csvContent = "\uFEFF" + csvRows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `cadence_creatures_mileage_${year === "All" ? "all_years" : year}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("Mileage log exported as CSV!");
    } else {
      const revStr = rev.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const expStr = exp.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const netStr = net.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const marginStr = margin.toFixed(1) + "%";

      const csvHeader = [
        `"Cadence Creatures — Financial Ledger"`,
        `"${closingLine.replace(/"/g, '""')}"`,
        `"Exported On:","${timestamp}"`,
        `"Tax Year:","${yrLabel}"`,
        `"Gross Revenue:","$${revStr}"`,
        `"Total Expenses:","-$${expStr}"`,
        `"Net Profit:","${(net >= 0 ? "" : "-")}$${Math.abs(net).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}"`,
        `"Profit Margin:","${marginStr}"`,
        `""` // Empty spacer row
      ];

      const headers = ["Date", "Year", "Type", "Category", "Description", "Invoice #", "Amount"];
      const dataRows = finY.map(e => {
        const date = e.entry_date || "";
        const yrVal = date ? date.slice(0, 4) : "";
        const type = e.entry_type || "";
        const cat = `"${(e.category || "").replace(/"/g, '""')}"`;
        const desc = `"${(e.description || "").replace(/"/g, '""')}"`;
        const inv = `"${(e.invoice_number || "").replace(/"/g, '""')}"`;
        const amt = (e.entry_type && String(e.entry_type).toLowerCase() === "income" ? 1 : -1) * Math.abs(parseFloat(e.amount) || 0);
        
        return [date, yrVal, type, cat, desc, inv, amt].join(",");
      });

      const csvRows = [...csvHeader, headers.join(","), ...dataRows];
      const csvContent = "\uFEFF" + csvRows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `cadence_creatures_ledger_${year === "All" ? "all_years" : year}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("Ledger exported as CSV!");
    }
  }

  // Tax calc
  const yr = year === "All" ? now.getFullYear() : year;
  const miDeduction = totalMiles * IRS_RATE;
  const grossProfit = rev - exp;
  const seTax = Math.max(0, grossProfit * 0.9235 * 0.153);
  const dedHalfSE = seTax / 2;
  const taxable = Math.max(0, grossProfit - dedHalfSE - miDeduction);
  const incomeTax = taxable * 0.22;
  const totalEst = seTax + incomeTax;
  const QUARTERS = [
    { label: "Q1", start: `${yr}-01-01`, end: `${yr}-03-31`, due: "Apr 15" },
    { label: "Q2", start: `${yr}-04-01`, end: `${yr}-06-30`, due: "Jun 15" },
    { label: "Q3", start: `${yr}-07-01`, end: `${yr}-09-30`, due: "Sep 15" },
    { label: "Q4", start: `${yr}-10-01`, end: `${yr}-12-31`, due: "Jan 15" },
  ];

  // Creature margins
  const creatureRows = creatures.map(c => {
    const fee = (c.price_etsy || 0) * 0.065;
    const m = c.price_etsy && c.cost_to_print ? ((c.price_etsy - c.cost_to_print - fee) / c.price_etsy * 100) : null;
    return { ...c, fee, margin: m, stockValue: (c.qty_on_hand || 0) * (c.cost_to_print || 0) };
  });
  const withMargin = creatureRows.filter(r => r.margin !== null);
  const avgMargin = withMargin.length ? withMargin.reduce((s, r) => s + r.margin, 0) / withMargin.length : null;

  const incomeEntries = finY.filter(e => e.entry_type && String(e.entry_type).toLowerCase() === "income");
  const expEntries = finY.filter(e => e.entry_type && String(e.entry_type).toLowerCase() === "expense");

  const dateCell = d => {
    if (!d) return "—";
    const parts = d.split("-");
    if (parts.length !== 3) return d;
    const [y, m, day] = parts;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthName = months[parseInt(m) - 1] || "";
    return `${monthName} ${parseInt(day)}, ${y}`;
  };

  function renderFinTable(entries, type) {
    return (
      <div className="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Year</th><th>Category</th><th>Description</th><th>Invoice #</th><th>Amount</th><th></th></tr></thead>
          <tbody>
            {entries.length === 0 ? (
              <tr><td colSpan="7" style={{ textAlign: "center", color: "var(--dim)", padding: 24 }}>No {type} entries yet.</td></tr>
            ) : entries.map(e => (
              <tr key={e.id}>
                <td style={{ color: "var(--dim)", fontSize: 12 }}>{dateCell(e.entry_date)}</td>
                <td style={{ color: "var(--dim)", fontSize: 12 }}>{e.entry_date ? e.entry_date.slice(0, 4) : "—"}</td>
                <td style={{ color: "var(--dim)", fontSize: 12 }}>{e.category || "—"}</td>
                <td>{e.description || "—"}</td>
                <td style={{ color: "var(--dim)", fontSize: 11 }}>{e.invoice_number || ""}</td>
                <td style={{ fontWeight: 500, color: type === "income" ? "#7dc994" : "#e09090" }}>
                  {type === "income" ? "+" : "−"}{fmt(Math.abs(parseFloat(e.amount) || 0))}
                </td>
                <td>
                  {!e.isVirtual && (
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn sm" onClick={() => setFinModal({ open: true, entry: e, type })}>Edit</button>
                      {deleteFinConfirmId === e.id ? (
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="btn sm" onClick={() => setDeleteFinConfirmId(null)}>Cancel</button>
                          <button className="btn sm" style={{ color: "#e87070", borderColor: "rgba(232,112,112,0.3)" }} onClick={() => deleteFin(e.id)}>Confirm</button>
                        </div>
                      ) : (
                        <button className="btn sm" style={{ color: "#ff6b6b", borderColor: "rgba(255,107,107,0.2)" }} onClick={() => setDeleteFinConfirmId(e.id)}>✕</button>
                      )}
                    </div>
                  )}
                  {e.isVirtual && (
                    <span style={{ fontSize: 10, color: "var(--dim)" }}>Auto-synced from Orders</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "income", label: "Income" },
    { id: "expenses", label: "Expenses" },
    { id: "mileage", label: "Mileage" },
    { id: "tax", label: "Tax Estimate" },
    { id: "creatures", label: "Creatures" },
  ];

  return (
    <div>
      {toast.msg && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "var(--ink)", border: `1px solid ${toast.type === "err" ? "rgba(232,112,112,0.5)" : "var(--gold)"}`, color: toast.type === "err" ? "rgba(240,180,180,0.9)" : "var(--goldl)", fontSize: 12, letterSpacing: "0.08em", padding: "10px 22px", zIndex: 2000, whiteSpace: "nowrap", borderRadius: 3, fontFamily: "sans-serif" }}>
          {toast.msg}
        </div>
      )}

      <div className="sec-hdr">
        <h1 className={styles.title}>P&amp;L Tracker</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--dim)", fontFamily: "sans-serif" }}>Tax Year:</label>
          <select value={year} onChange={e => setYear(e.target.value === "All" ? "All" : parseInt(e.target.value))} className={styles.yearSelect}>
            <option value="All">All Years</option>
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button className="btn sm" onClick={exportCSV} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", height: "30px" }}>
            📥 Export CSV
          </button>
        </div>
      </div>

      <div className={styles.tabs}>
        {TABS.map(t => (
          <button key={t.id} className={`${styles.tab} ${tab === t.id ? styles.tabActive : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <div className="empty-state">Loading…</div> : (
        <>
          {/* ── OVERVIEW ── */}
          {tab === "overview" && (
            <div>
              <div className={styles.chartBox}>
                <div style={{ fontSize: 10, color: "var(--dim)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8, display: "flex", gap: 16, fontFamily: "sans-serif" }}>
                  <span style={{ color: "#C9A84C" }}>— Revenue</span>
                  <span style={{ color: "#a84444" }}>-- Expenses</span>
                  <span style={{ marginLeft: "auto" }}>Last 30 days</span>
                </div>
                <SparkChart fin={fin} />
              </div>
              <div className="kpi-grid">
                <div className="kpi"><div className="kpi-label">Gross Revenue</div><div className="kpi-val">{fmt(rev)}</div></div>
                <div className="kpi"><div className="kpi-label">Total Expenses</div><div className="kpi-val">{fmt(exp)}</div></div>
                <div className="kpi"><div className="kpi-label">Net Profit</div><div className="kpi-val" style={{ color: net >= 0 ? "#7dc994" : "#e09090" }}>{(net >= 0 ? "+" : "") + fmt(net)}</div></div>
                <div className="kpi"><div className="kpi-label">Profit Margin</div><div className="kpi-val">{margin.toFixed(1)}%</div></div>
              </div>
              <div className="kpi-grid" style={{ marginTop: 12 }}>
                <div className="kpi"><div className="kpi-label">This Month</div><div className="kpi-val" style={{ color: moNet >= 0 ? "#7dc994" : "#e09090" }}>{(moNet >= 0 ? "+" : "") + fmt(moNet)}</div></div>
                <div className="kpi"><div className="kpi-label">This Quarter</div><div className="kpi-val" style={{ color: qtrNet >= 0 ? "#7dc994" : "#e09090" }}>{(qtrNet >= 0 ? "+" : "") + fmt(qtrNet)}</div></div>
                <div className="kpi"><div className="kpi-label">Total Mileage</div><div className="kpi-val">{totalMiles.toFixed(1)} mi</div><div className="kpi-sub">{fmt(totalMiles * IRS_RATE)} deductible</div></div>
                <div className="kpi"><div className="kpi-label">Orders Recorded</div><div className="kpi-val">{incomeEntries.filter(e => e.order_id).length}</div><div className="kpi-sub">from queue</div></div>
              </div>

            </div>
          )}

          {/* ── INCOME ── */}
          {tab === "income" && (
            <div>
              <div className="sec-hdr">
                <span className="sec-title">Income entries</span>
                <button className="btn sm pri" onClick={() => setFinModal({ open: true, entry: null, type: "income" })}>+ Add income</button>
              </div>
              {renderFinTable(incomeEntries, "income")}
            </div>
          )}

          {/* ── EXPENSES ── */}
          {tab === "expenses" && (
            <div>
              <div className="sec-hdr">
                <span className="sec-title">Expense entries</span>
                <button className="btn sm pri" onClick={() => setFinModal({ open: true, entry: null, type: "expense" })}>+ Add expense</button>
              </div>
              {renderFinTable(expEntries, "expense")}
            </div>
          )}

          {/* ── MILEAGE ── */}
          {tab === "mileage" && (
            <div>
              <div className="kpi-grid">
                <div className="kpi"><div className="kpi-label">Total Miles</div><div className="kpi-val">{totalMiles.toFixed(1)} mi</div></div>
                <div className="kpi"><div className="kpi-label">Deductible Value</div><div className="kpi-val" style={{ color: "#7dc994" }}>{fmt(totalMiles * IRS_RATE)}</div><div className="kpi-sub">@ $0.70/mile (2025 IRS)</div></div>
                <div className="kpi"><div className="kpi-label">Trips Logged</div><div className="kpi-val">{miles.length}</div></div>
              </div>
              <div className="sec-hdr">
                <span className="sec-title">Mileage log</span>
                <button className="btn sm pri" onClick={() => setMileModal(true)}>+ Log trip</button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Date</th><th>Purpose</th><th>Miles</th><th>Round Trip</th><th>Notes</th><th></th></tr></thead>
                  <tbody>
                    {miles.length === 0 ? (
                      <tr><td colSpan="6" style={{ textAlign: "center", color: "var(--dim)", padding: 24 }}>No trips logged yet.</td></tr>
                    ) : miles.map(m => (
                      <tr key={m.id}>
                        <td style={{ color: "var(--dim)", fontSize: 12 }}>{dateCell(m.trip_date)}</td>
                        <td>{m.purpose || "—"}</td>
                        <td style={{ fontWeight: 500 }}>{Number(m.miles || 0).toFixed(1)} mi</td>
                        <td style={{ color: "var(--dim)", fontSize: 12 }}>{m.round_trip ? "Yes" : "No"}</td>
                        <td style={{ color: "var(--dim)", fontSize: 12 }}>{m.notes || ""}</td>
                        <td>
                          {deleteMileConfirmId === m.id ? (
                            <div style={{ display: "flex", gap: 4 }}>
                              <button className="btn sm" onClick={() => setDeleteMileConfirmId(null)}>Cancel</button>
                              <button className="btn sm" style={{ color: "#e87070", borderColor: "rgba(232,112,112,0.3)" }} onClick={() => deleteMile(m.id)}>Confirm</button>
                            </div>
                          ) : (
                            <button className="btn sm" style={{ color: "#ff6b6b", borderColor: "rgba(255,107,107,0.2)" }} onClick={() => setDeleteMileConfirmId(m.id)}>✕</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── TAX ESTIMATE ── */}
          {tab === "tax" && (
            <div>
              {year === "All" && (
                <div style={{ background: "rgba(201, 168, 76, 0.08)", border: "1px solid rgba(201, 168, 76, 0.2)", borderRadius: 4, padding: "12px 16px", marginBottom: 16, fontSize: 12, color: "var(--goldl)", fontFamily: "sans-serif", display: "flex", alignItems: "center", gap: 8 }}>
                  <span>ℹ️ Showing tax estimates for {yr} (current year). Select a specific year from the dropdown in the header to view other years.</span>
                </div>
              )}
              <div className={styles.qGrid}>
                {QUARTERS.map(q => {
                  const qNet = fin.filter(e => e.entry_date && e.entry_date >= q.start && e.entry_date <= q.end)
                    .reduce((s, e) => s + (e.entry_type && String(e.entry_type).toLowerCase() === "income" ? 1 : -1) * Math.abs(parseFloat(e.amount) || 0), 0);
                  const est = Math.max(0, qNet * 0.153 * 0.9);
                  return (
                    <div key={q.label} className={styles.qCard}>
                      <div className={styles.qLabel}>{q.label} {yr}</div>
                      <div className={styles.qVal} style={{ color: qNet >= 0 ? "#7dc994" : "#e09090" }}>{fmt(qNet)}</div>
                      <div style={{ fontSize: 12, color: "var(--goldl)", margin: "4px 0" }}>Est. tax: {fmt(est)}</div>
                      <div className={styles.qDue}>Due {q.due}</div>
                    </div>
                  );
                })}
              </div>
              <div className={styles.taxCard}>
                <h3>Schedule C Estimate</h3>
                {[
                  ["Gross Revenue", fmt(rev), "var(--cream)"],
                  ["Business Expenses", "−" + fmt(exp), "#e09090"],
                  ["Mileage Deduction", "−" + fmt(miDeduction), "#e09090"],
                  ["Gross Profit", fmt(grossProfit), grossProfit >= 0 ? "#7dc994" : "#e09090"],
                  ["Self-Employment Tax (15.3%)", "−" + fmt(seTax), "#e09090"],
                  ["½ SE Deduction", "−" + fmt(dedHalfSE), "#e09090"],
                  ["Estimated Taxable Income", fmt(taxable), "var(--cream)"],
                  ["Est. Income Tax (22% bracket)", fmt(incomeTax), "#e09090"],
                ].map(([label, val, color]) => (
                  <div key={label} className={styles.taxRow}>
                    <span>{label}</span>
                    <span style={{ color, fontWeight: 500 }}>{val}</span>
                  </div>
                ))}
                <div className={`${styles.taxRow} ${styles.taxTotal}`}>
                  <span>Estimated Total Tax Liability</span>
                  <span style={{ color: "#e09090" }}>{fmt(totalEst)}</span>
                </div>
              </div>
              <p style={{ fontSize: 11, color: "var(--dim)", fontStyle: "italic", marginTop: 8, fontFamily: "sans-serif" }}>
                ⚠ Estimates only. Consult a tax professional. SE tax ~15.3%, income tax rate varies.
              </p>
            </div>
          )}

          {/* ── CREATURES ── */}
          {tab === "creatures" && (
            <div>
              <div className="kpi-grid">
                <div className="kpi"><div className="kpi-label">Avg Etsy Margin</div><div className="kpi-val">{avgMargin !== null ? avgMargin.toFixed(1) + "%" : "—"}</div></div>
                <div className="kpi"><div className="kpi-label">Inventory Value</div><div className="kpi-val">{fmt(creatureRows.reduce((s, r) => s + r.stockValue, 0))}</div><div className="kpi-sub">at cost to print</div></div>
                <div className="kpi"><div className="kpi-label">Creatures Tracked</div><div className="kpi-val">{creatures.length}</div></div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>#</th><th>Creature</th><th>SKU</th><th>COGS</th><th>Retail</th><th>Etsy</th><th>Etsy Fee</th><th>Net Margin</th><th>Stock</th><th>Stock Value</th></tr>
                  </thead>
                  <tbody>
                    {creatureRows.map(r => (
                      <tr key={r.id}>
                        <td style={{ color: "var(--dim)", fontSize: 11 }}>#{String(r.log_number || "—").padStart(3, "0")}</td>
                        <td>{r.name}</td>
                        <td style={{ color: "var(--dim)", fontSize: 11 }}>{r.sku || "—"}</td>
                        <td>{r.cost_to_print != null ? "$" + parseFloat(r.cost_to_print).toFixed(2) : "—"}</td>
                        <td>{r.price_retail != null ? "$" + parseFloat(r.price_retail).toFixed(2) : "—"}</td>
                        <td>{r.price_etsy != null ? "$" + parseFloat(r.price_etsy).toFixed(2) : "—"}</td>
                        <td style={{ color: "var(--dim)" }}>{r.price_etsy ? "$" + r.fee.toFixed(2) : "—"}</td>
                        <td>
                          {r.margin !== null ? (
                            <span style={{ color: r.margin < 20 ? "#e87070" : r.margin < 40 ? "var(--gold)" : "#7dc994" }}>
                              {r.margin.toFixed(1)}%
                            </span>
                          ) : "—"}
                        </td>
                        <td>{r.qty_on_hand ?? 0}</td>
                        <td style={{ color: "var(--dim)" }}>${r.stockValue.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <FinanceModal
        isOpen={finModal.open}
        onClose={() => setFinModal(m => ({ ...m, open: false }))}
        entry={finModal.entry}
        type={finModal.type}
        onSaved={() => { setFinModal(m => ({ ...m, open: false })); loadFin(); showToast("Saved"); }}
      />
      <MileageModal
        isOpen={mileModal}
        onClose={() => setMileModal(false)}
        onSaved={() => { setMileModal(false); loadMiles(); showToast("Trip logged"); }}
      />
    </div>
  );
}
