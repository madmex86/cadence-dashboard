"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "../../../lib/supabase/client";
import CostEngine from "./CostEngine";
import styles from "./queue.module.css";

const STATUS_ORDER = ["queued", "printing", "printed", "packaging", "shipped", "complete"];

const STATUS_COLORS = {
  queued: "#9B8AC4",
  printing: "#5BBFD4",
  printed: "#6B9E6E",
  packaging: "#C9A84C",
  shipped: "#C9614A",
  complete: "rgba(196,188,178,0.4)",
};

export default function QueuePage() {
  const [tab, setTab] = useState("orders");
  const [orders, setOrders] = useState([]);
  const [creatures, setCreatures] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [settings, setSettings] = useState({ kwh_rate: 0.18, labor_rate: 0, maintenance_fee: 0.50 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [expandedOrder, setExpandedOrder] = useState(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [ordersRes, creaturesRes, inventoryRes, settingsRes] = await Promise.all([
      supabase
        .from("orders")
        .select("id, etsy_order_id, buyer_name, buyer_email, items, status, printer_name, total_amount, tracking_number, carrier, shipping_note, order_date, shipped_date, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("creatures")
        .select("id, name, species, sku, log_number, environment, price_etsy, price_retail, cost_to_print, filament_color, print_recipe, qty_on_hand")
        .eq("active", true)
        .order("log_number"),
      supabase
        .from("inventory")
        .select("id, spool_name, hex_color, color, cost_per_spool")
        .order("spool_name"),
      supabase
        .from("settings")
        .select("key, value")
    ]);
    setOrders(ordersRes.data || []);
    setCreatures(creaturesRes.data || []);
    setInventory(inventoryRes.data || []);
    
    // Parse global settings
    if (settingsRes.data) {
      const s = { kwh_rate: 0.18, labor_rate: 0, maintenance_fee: 0.50 };
      settingsRes.data.forEach(item => {
        if (item.key === "kwh_rate") s.kwh_rate = parseFloat(item.value) || 0;
        if (item.key === "labor_rate") s.labor_rate = parseFloat(item.value) || 0;
        if (item.key === "maintenance_fee") s.maintenance_fee = parseFloat(item.value) || 0;
      });
      setSettings(s);
    }
    
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(id, status) {
    const supabase = createClient();
    await supabase.from("orders").update({ status }).eq("id", id);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
  }

  async function updateTracking(id, tracking_number, carrier) {
    const supabase = createClient();
    await supabase.from("orders").update({ tracking_number, carrier, status: "shipped", shipped_date: new Date().toISOString() }).eq("id", id);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, tracking_number, carrier, status: "shipped" } : o));
  }

  const visible = orders.filter(o => {
    if (filterStatus && o.status !== filterStatus) return false;
    const q = search.toLowerCase();
    if (q && !o.buyer_name?.toLowerCase().includes(q) && !o.etsy_order_id?.toLowerCase().includes(q)) return false;
    return true;
  });

  const counts = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = orders.filter(o => o.status === s).length;
    return acc;
  }, {});

  return (
    <div>
      <div className="sec-hdr">
        <h1 className={styles.title}>Queue & Orders</h1>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button className="btn sm" onClick={() => setTab("cost-engine")}>🖨 Print Cost</button>
          <button className="btn sm" onClick={() => alert("Import Etsy: Not implemented yet")}>Import Etsy</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: "20px", marginBottom: "20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", background: "rgba(0,0,0,0.2)", border: "1px solid var(--border)", borderRadius: "3px", overflow: "hidden" }}>
          <div style={{ padding: "18px 14px", textAlign: "center", borderRight: "1px solid var(--border)", background: "rgba(91,191,212,.04)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontSize: "9px", letterSpacing: ".15em", textTransform: "uppercase", color: "var(--cream-faint)", marginBottom: "5px" }}>Queued</div>
            <div style={{ fontSize: "22px", fontWeight: "600", color: "#5BBFD4" }}>{counts["queued"] || 0}</div>
          </div>
          <div style={{ padding: "18px 14px", textAlign: "center", borderRight: "1px solid var(--border)", background: "rgba(201,168,76,.04)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontSize: "9px", letterSpacing: ".15em", textTransform: "uppercase", color: "var(--cream-faint)", marginBottom: "5px" }}>Printing</div>
            <div style={{ fontSize: "22px", fontWeight: "600", color: "var(--gold-light)" }}>{counts["printing"] || 0}</div>
          </div>
          <div style={{ padding: "18px 14px", textAlign: "center", borderRight: "1px solid var(--border)", background: "rgba(147,112,219,.04)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontSize: "9px", letterSpacing: ".15em", textTransform: "uppercase", color: "var(--cream-faint)", marginBottom: "5px" }}>Printed</div>
            <div style={{ fontSize: "22px", fontWeight: "600", color: "#b89de8" }}>{counts["printed"] || 0}</div>
          </div>
          <div style={{ padding: "18px 14px", textAlign: "center", borderRight: "1px solid var(--border)", background: "rgba(224,138,88,.04)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontSize: "9px", letterSpacing: ".15em", textTransform: "uppercase", color: "var(--cream-faint)", marginBottom: "5px" }}>Packaging</div>
            <div style={{ fontSize: "22px", fontWeight: "600", color: "#e08a58" }}>{counts["packaging"] || 0}</div>
          </div>
          <div style={{ padding: "18px 14px", textAlign: "center", borderRight: "1px solid var(--border)", background: "rgba(74,140,92,.04)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontSize: "9px", letterSpacing: ".15em", textTransform: "uppercase", color: "var(--cream-faint)", marginBottom: "5px" }}>Shipped</div>
            <div style={{ fontSize: "22px", fontWeight: "600", color: "#7dc994" }}>{counts["shipped"] || 0}</div>
          </div>
          <div style={{ padding: "18px 14px", textAlign: "center", background: "rgba(74,140,92,.07)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ fontSize: "9px", letterSpacing: ".15em", textTransform: "uppercase", color: "var(--cream-faint)", marginBottom: "5px" }}>Complete</div>
            <div style={{ fontSize: "22px", fontWeight: "600", color: "#7dc994" }}>{counts["complete"] || 0}</div>
          </div>
        </div>
        
        <div style={{ background: "rgba(255,255,255,.02)", border: "1px solid var(--border)", borderRadius: "3px", textAlign: "center", padding: "24px 16px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontFamily: "'Lora',Georgia,serif", fontSize: "10px", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--cream-dim)", marginBottom: "12px" }}>Available for Sale</div>
          <div style={{ fontFamily: "'Lora',Georgia,serif", fontSize: "36px", fontWeight: "600", color: "var(--gold-light)", marginBottom: "12px", lineHeight: "1" }}>
            {creatures.reduce((acc, c) => acc + (c.qty_on_hand || 0), 0)}
          </div>
          <div style={{ fontFamily: "'Lora',Georgia,serif", fontSize: "13px", color: "var(--cream-faint)", lineHeight: "1.6" }}>
            Total stock across all creatures
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "rgba(91,191,212,.05)", border: "1px solid rgba(91,191,212,.18)", borderRadius: "3px", padding: "10px 16px", marginBottom: "16px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "9px", letterSpacing: ".18em", textTransform: "uppercase", color: "#5BBFD4", flexShrink: 0 }}>⚡ Etsy Webhook</span>
        <code style={{ fontSize: "11px", color: "var(--cream-dim)", background: "rgba(0,0,0,.25)", padding: "3px 8px", borderRadius: "2px", cursor: "pointer", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} onClick={() => navigator.clipboard.writeText('https://ufqiysdgmxrhonnfsgts.supabase.co/functions/v1/etsy-webhook')}>
          https://ufqiysdgmxrhonnfsgts.supabase.co/functions/v1/etsy-webhook
        </code>
        <button className="btn sm" onClick={() => navigator.clipboard.writeText('https://ufqiysdgmxrhonnfsgts.supabase.co/functions/v1/etsy-webhook')} style={{ flexShrink: 0 }}>Copy URL</button>
        <span style={{ fontSize: "10px", color: "var(--cream-faint)", flexShrink: 0 }}>Set <code style={{ fontSize: "10px", background: "rgba(0,0,0,.2)", padding: "1px 4px" }}>ETSY_HMAC_KEY</code> in Supabase secrets</span>
      </div>

      <div className={styles.tabs}>
        {["orders", "shipments", "cost-engine"].map(t => (
          <button
            key={t}
            type="button"
            className={`${styles.tab} ${tab === t ? styles.tabActive : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "orders" ? "Orders" : t === "shipments" ? "Shipments" : "Cost Engine"}
          </button>
        ))}
      </div>

      {tab === "orders" && (
        <>
          <div className={styles.statusBar}>
            {STATUS_ORDER.map(s => (
              <button
                key={s}
                className={`${styles.statusPill} ${filterStatus === s ? styles.pillActive : ""}`}
                style={{ "--pill-color": STATUS_COLORS[s] }}
                onClick={() => setFilterStatus(filterStatus === s ? "" : s)}
              >
                {s} <span className={styles.pillCount}>{counts[s]}</span>
              </button>
            ))}
          </div>

          <div className={styles.searchRow}>
            <input
              className="fi"
              style={{ maxWidth: 300 }}
              placeholder="Search buyer, order ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <span style={{ fontSize: 11, color: "var(--dim)", fontFamily: "sans-serif" }}>
              {visible.length} of {orders.length} orders
            </span>
          </div>

          {loading ? (
            <div className="empty-state">Loading orders…</div>
          ) : visible.length === 0 ? (
            <div className="empty-state">No orders found</div>
          ) : (
            <div className={styles.orderList}>
              {visible.map(order => (
                <OrderRow
                  key={order.id}
                  order={order}
                  expanded={expandedOrder === order.id}
                  onToggle={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                  onStatusChange={updateStatus}
                  onTrackingUpdate={updateTracking}
                />
              ))}
            </div>
          )}
        </>
      )}

      {tab === "shipments" && (
        <ShipmentsTab orders={orders} />
      )}

      {tab === "cost-engine" && (
        <CostEngine creatures={creatures} inventory={inventory} globalSettings={settings} onSaved={load} />
      )}
    </div>
  );
}

function OrderRow({ order, expanded, onToggle, onStatusChange, onTrackingUpdate }) {
  const [trackingInput, setTrackingInput] = useState(order.tracking_number || "");
  const [carrierInput, setCarrierInput] = useState(order.carrier || "usps");
  const [savingTracking, setSavingTracking] = useState(false);

  const items = Array.isArray(order.items)
    ? order.items.join(", ")
    : (order.items || "—");

  const statusColor = STATUS_COLORS[order.status] || "var(--dim)";

  async function saveTracking() {
    setSavingTracking(true);
    await onTrackingUpdate(order.id, trackingInput, carrierInput);
    setSavingTracking(false);
  }

  return (
    <div className={styles.orderCard}>
      <div className={styles.orderHeader} onClick={onToggle}>
        <div className={styles.orderLeft}>
          <span className={styles.orderId}>#{order.etsy_order_id || order.id.slice(0, 8)}</span>
          <span className={styles.orderBuyer}>{order.buyer_name || "Unknown"}</span>
          <span className={styles.orderItems}>{items}</span>
        </div>
        <div className={styles.orderRight}>
          {order.total_amount && (
            <span className={styles.orderAmount}>${parseFloat(order.total_amount).toFixed(2)}</span>
          )}
          <span className={styles.orderStatus} style={{ color: statusColor, borderColor: statusColor }}>
            {order.status}
          </span>
          <span className={styles.chevron}>{expanded ? "▲" : "▾"}</span>
        </div>
      </div>

      {expanded && (
        <div className={styles.orderDetail}>
          <div className={styles.detailGrid}>
            <div>
              <div className="fl">Status</div>
              <select
                className="fi"
                value={order.status}
                onChange={e => onStatusChange(order.id, e.target.value)}
              >
                {STATUS_ORDER.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="fl">Printer</div>
              <div style={{ color: "var(--cream-dim)", fontSize: 13, padding: "9px 0" }}>
                {order.printer_name || "—"}
              </div>
            </div>
            {order.buyer_email && (
              <div>
                <div className="fl">Email</div>
                <div style={{ color: "var(--cream-dim)", fontSize: 13, padding: "9px 0" }}>
                  {order.buyer_email}
                </div>
              </div>
            )}
            <div>
              <div className="fl">Order Date</div>
              <div style={{ color: "var(--cream-dim)", fontSize: 13, padding: "9px 0" }}>
                {order.order_date ? new Date(order.order_date).toLocaleDateString() : "—"}
              </div>
            </div>
          </div>

          <div className={styles.trackingRow}>
            <div style={{ flex: 1 }}>
              <div className="fl">Tracking Number</div>
              <input
                className="fi"
                placeholder="1Z999AA10123456784"
                value={trackingInput}
                onChange={e => setTrackingInput(e.target.value)}
              />
            </div>
            <div>
              <div className="fl">Carrier</div>
              <select className="fi" value={carrierInput} onChange={e => setCarrierInput(e.target.value)}>
                <option value="usps">USPS</option>
                <option value="ups">UPS</option>
                <option value="fedex">FedEx</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button className="btn gold" onClick={saveTracking} disabled={savingTracking}>
                {savingTracking ? "Saving…" : "Save & Ship"}
              </button>
            </div>
          </div>

          {order.shipping_note && (
            <div style={{ marginTop: 10, fontSize: 12, color: "var(--dim)", fontFamily: "sans-serif" }}>
              Note: {order.shipping_note}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Shipments Tab ────────────────────────────────────────────────────────────

const TRACKING_STATUS = {
  DELIVERED:   { label: 'Delivered',   color: '#7dc994' },
  TRANSIT:     { label: 'In Transit',  color: '#5BBFD4' },
  PRE_TRANSIT: { label: 'Pre-Transit', color: '#C9A84C' },
  RETURNED:    { label: 'Returned',    color: '#e07070' },
  FAILURE:     { label: 'Failed',      color: '#e07070' },
  UNKNOWN:     { label: 'Unknown',     color: 'rgba(250,246,240,0.3)' },
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function ShipmentsTab({ orders }) {
  const [trackingData, setTrackingData] = useState({})
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [error, setError] = useState(null)

  const shipped = orders.filter(o => o.tracking_number)

  useEffect(() => {
    if (!shipped.length) return
    setLoading(true)
    setError(null)
    Promise.all(
      shipped.map(o =>
        fetch(`/api/tracking?carrier=${encodeURIComponent(o.carrier || 'usps')}&tracking_number=${encodeURIComponent(o.tracking_number)}`)
          .then(r => r.json())
          .then(data => ({ id: o.id, data }))
          .catch(() => ({ id: o.id, data: null }))
      )
    ).then(results => {
      const map = {}
      results.forEach(({ id, data }) => { map[id] = data })
      setTrackingData(map)
      setLoading(false)
      if (results.every(r => r.data?.error)) setError('Could not reach Shippo — check SHIPPO_API_KEY in .env.local')
    })
  }, [])

  if (!shipped.length) {
    return <div className="empty-state">No orders with tracking numbers yet.</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 16 }}>
      {loading && (
        <div style={{ fontSize: 12, color: 'var(--dim)', fontFamily: 'sans-serif', paddingBottom: 8 }}>
          Fetching tracking data…
        </div>
      )}
      {error && (
        <div style={{ fontSize: 12, color: '#e07070', fontFamily: 'sans-serif', padding: '10px 14px', background: 'rgba(224,112,112,0.08)', borderRadius: 6, border: '1px solid rgba(224,112,112,0.2)', marginBottom: 4 }}>
          {error}
        </div>
      )}
      {shipped.map(order => {
        const td = trackingData[order.id]
        const ts = td?.tracking_status
        const info = TRACKING_STATUS[ts?.status] ?? TRACKING_STATUS.UNKNOWN
        const loc = ts?.location
        const locStr = loc ? [loc.city, loc.state].filter(Boolean).join(', ') : null
        const history = (td?.tracking_history ?? []).slice().reverse()
        const isExpanded = expandedId === order.id

        return (
          <div key={order.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(201,168,76,0.12)', borderRadius: 8, overflow: 'hidden' }}>
            <div
              onClick={() => setExpandedId(isExpanded ? null : order.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', cursor: 'pointer' }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{order.buyer_name}</span>
                  <span style={{ fontSize: 11, color: 'var(--dim)', fontFamily: 'sans-serif' }}>#{order.etsy_order_id}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--dim)', fontFamily: 'monospace' }}>
                  {(order.carrier || 'USPS').toUpperCase()} · {order.tracking_number}
                </div>
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {ts ? (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, color: info.color, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>
                      {info.label}
                    </div>
                    {locStr && <div style={{ fontSize: 11, color: 'rgba(250,246,240,0.5)', fontFamily: 'sans-serif' }}>{locStr}</div>}
                    {ts.status_date && (
                      <div style={{ fontSize: 10, color: 'rgba(250,246,240,0.3)', fontFamily: 'sans-serif' }}>
                        {timeAgo(ts.status_date)}
                      </div>
                    )}
                  </>
                ) : loading ? (
                  <div style={{ fontSize: 11, color: 'var(--dim)' }}>…</div>
                ) : (
                  <div style={{ fontSize: 11, color: 'rgba(250,246,240,0.25)' }}>No data</div>
                )}
              </div>

              <span style={{ fontSize: 11, color: 'var(--dim)', marginLeft: 4 }}>{isExpanded ? '▲' : '▼'}</span>
            </div>

            {isExpanded && history.length > 0 && (
              <div style={{ borderTop: '1px solid rgba(201,168,76,0.08)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {history.map((h, i) => {
                  const hInfo = TRACKING_STATUS[h.status] ?? TRACKING_STATUS.UNKNOWN
                  const hLoc = h.location
                  const hLocStr = hLoc ? [hLoc.city, hLoc.state].filter(Boolean).join(', ') : null
                  return (
                    <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: hInfo.color, marginTop: 4, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: 'rgba(250,246,240,0.75)', fontFamily: 'sans-serif' }}>{h.status_details}</div>
                        {hLocStr && <div style={{ fontSize: 11, color: 'rgba(250,246,240,0.4)', fontFamily: 'sans-serif' }}>{hLocStr}</div>}
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(250,246,240,0.3)', flexShrink: 0, fontFamily: 'sans-serif', whiteSpace: 'nowrap' }}>
                        {new Date(h.status_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {' '}
                        {new Date(h.status_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {isExpanded && !loading && history.length === 0 && (
              <div style={{ borderTop: '1px solid rgba(201,168,76,0.08)', padding: '12px 16px', fontSize: 12, color: 'var(--dim)', fontFamily: 'sans-serif' }}>
                No scan history available yet.
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
