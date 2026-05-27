"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "../../../lib/supabase/client";
import styles from "./fulfillment.module.css";

const COLUMNS = [
  { id: "queued", label: "Queued" },
  { id: "printing", label: "Printing" },
  { id: "printed", label: "Printed" },
  { id: "packaging", label: "Packaging" },
  { id: "shipped", label: "Recently Shipped" },
];

export default function FulfillmentPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draggedOrderId, setDraggedOrderId] = useState(null);
  const [toast, setToast] = useState({ msg: "", type: "ok" });

  // Bulk Mode State
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState("printing");

  const [dragOverCol, setDragOverCol] = useState(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("orders")
      .select("*")
      .in("status", ["queued", "printing", "printed", "packaging", "shipped"])
      .order("order_date", { ascending: false })
      .limit(150);
    setOrders(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function showToast(msg, type = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "ok" }), 3500);
  }

  async function triggerShippingEmail(order, tracking_number = null) {
    if (!order.buyer_email) return;
    try {
      await fetch('/api/send-shipping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyer_name: order.buyer_name,
          buyer_email: order.buyer_email,
          items: order.items,
          tracking_number: tracking_number || order.tracking_number,
          carrier: order.carrier
        })
      });
    } catch (e) {
      console.error("Failed to trigger shipping email", e);
    }
  }

  async function moveOrder(id, newStatus) {
    const supabase = createClient();
    const updateData = { status: newStatus };
    if (newStatus === "shipped") updateData.shipped_date = new Date().toISOString();
    
    const order = orders.find(o => o.id === id);

    // Optimistic update
    setOrders(prev => prev.map(o => o.id === id ? { ...o, ...updateData } : o));
    await supabase.from("orders").update(updateData).eq("id", id);

    if (newStatus === "shipped" && order && order.buyer_email) {
      triggerShippingEmail(order);
    }
  }

  async function toggleItem(orderId, itemIndex) {
    if (bulkMode) return;
    const order = orders.find(o => o.id === orderId);
    if (!order || !order.items) return;
    
    const newItems = [...order.items];
    const itm = newItems[itemIndex];
    if (itm.startsWith("[x] ")) newItems[itemIndex] = itm.slice(4);
    else newItems[itemIndex] = "[x] " + itm;

    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, items: newItems } : o));
    
    const supabase = createClient();
    await supabase.from("orders").update({ items: newItems }).eq("id", orderId);
  }

  async function quickShip(id, tracking_number) {
    const supabase = createClient();
    const updateData = { status: "shipped", tracking_number, shipped_date: new Date().toISOString() };
    const order = orders.find(o => o.id === id);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, ...updateData } : o));
    await supabase.from("orders").update(updateData).eq("id", id);

    if (order && order.buyer_email) {
      triggerShippingEmail(order, tracking_number);
    }
  }

  function handleDragStart(e, id) {
    if (bulkMode) {
      e.preventDefault();
      return;
    }
    setDraggedOrderId(id);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e, colId) {
    e.preventDefault();
    setDragOverCol(colId);
  }

  function handleDrop(e, colId) {
    e.preventDefault();
    setDragOverCol(null);
    if (draggedOrderId) {
      moveOrder(draggedOrderId, colId);
    }
    setDraggedOrderId(null);
  }

  function toggleOrderSelection(id) {
    if (!bulkMode) return;
    setSelectedOrders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function applyBulkMove() {
    if (selectedOrders.size === 0) return;
    const ids = Array.from(selectedOrders);
    const updateData = { status: bulkStatus };
    if (bulkStatus === "shipped") updateData.shipped_date = new Date().toISOString();
    
    const ordersToMove = orders.filter(o => ids.includes(o.id));

    setOrders(prev => prev.map(o => ids.includes(o.id) ? { ...o, ...updateData } : o));
    setBulkMode(false);
    setSelectedOrders(new Set());
    
    const supabase = createClient();
    await supabase.from("orders").update(updateData).in("id", ids);

    if (bulkStatus === "shipped") {
      for (const order of ordersToMove) {
        if (order.buyer_email) triggerShippingEmail(order);
      }
    }
  }

  function printLabel(order) {
    const orderNum = order.etsy_order_id || order.id.slice(0, 8).toUpperCase();
    const items = Array.isArray(order.items)
      ? order.items.map(i => (i.startsWith("[x] ") ? i.slice(4) : i))
      : [];
    const orderDate = order.order_date
      ? new Date(order.order_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "";

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Label — ${orderNum}</title>
  <style>
    @page { size: 4in 6in; margin: 0.18in; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Arial', sans-serif;
      width: 3.64in;
      height: 5.64in;
      overflow: hidden;
      color: #111;
      font-size: 10pt;
      display: flex;
      flex-direction: column;
      gap: 0;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 8px 0 6px;
      border-bottom: 1.5px solid #111;
    }
    .brand-name {
      font-size: 13pt;
      font-weight: bold;
      letter-spacing: 0.04em;
    }
    .brand-url {
      font-size: 7pt;
      color: #555;
      letter-spacing: 0.06em;
    }
    .section {
      padding: 7px 0;
      border-bottom: 1px solid #ccc;
    }
    .label {
      font-size: 7pt;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: #777;
      margin-bottom: 2px;
    }
    .value {
      font-size: 11pt;
      font-weight: bold;
    }
    .sub {
      font-size: 8.5pt;
      color: #444;
    }
    .items-list {
      list-style: none;
      margin-top: 4px;
    }
    .items-list li {
      font-size: 9.5pt;
      padding: 2px 0;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .items-list li::before {
      content: '';
      display: inline-block;
      width: 12px;
      height: 12px;
      border: 1.5px solid #111;
      border-radius: 2px;
      flex-shrink: 0;
    }
    .tracking {
      margin-top: auto;
      padding-top: 7px;
      font-size: 8pt;
      color: #333;
    }
    .tracking strong {
      font-size: 9pt;
    }
    .note {
      font-size: 8pt;
      color: #555;
      font-style: italic;
      margin-top: 4px;
    }
    .footer {
      text-align: center;
      font-size: 7pt;
      color: #aaa;
      padding-top: 5px;
      margin-top: auto;
      border-top: 1px dashed #ccc;
      letter-spacing: 0.08em;
    }
  </style>
</head>
<body>

  <!-- Brand header -->
  <div class="brand">
    <svg width="22" height="17" viewBox="0 -2 76 52" fill="none">
      <path d="M6 44 L6 18 L22 32 L36 4 L50 32 L66 18 L66 44 Z" fill="none" stroke="#111" stroke-width="3" stroke-linejoin="round"/>
      <rect x="4" y="42" width="64" height="3" rx="1.5" fill="#111"/>
      <circle cx="36" cy="4" r="5.5" fill="#111"/>
      <circle cx="6" cy="18" r="4" fill="#111"/>
      <circle cx="66" cy="18" r="4" fill="#111"/>
    </svg>
    <div>
      <div class="brand-name">Cadence Creatures</div>
      <div class="brand-url">cadencecreatures.com</div>
    </div>
  </div>

  <!-- Buyer -->
  <div class="section">
    <div class="label">Ship To</div>
    <div class="value">${order.buyer_name || "—"}</div>
    ${order.buyer_email ? `<div class="sub">${order.buyer_email}</div>` : ""}
  </div>

  <!-- Order info -->
  <div class="section">
    <div style="display:flex;justify-content:space-between;align-items:baseline;">
      <div>
        <div class="label">Order</div>
        <div class="value">#${orderNum}</div>
      </div>
      <div style="text-align:right;">
        <div class="label">Date</div>
        <div class="sub">${orderDate}</div>
      </div>
    </div>
  </div>

  <!-- Items -->
  <div class="section" style="flex:1;">
    <div class="label">Items (${items.length})</div>
    <ul class="items-list">
      ${items.map(i => `<li>${i}</li>`).join("")}
    </ul>
  </div>

  <!-- Tracking + note -->
  <div class="tracking">
    ${order.tracking_number
      ? `<div><strong>${order.carrier ? order.carrier + ": " : ""}${order.tracking_number}</strong></div>`
      : `<div style="color:#bbb;">No tracking yet</div>`
    }
    ${order.shipping_note ? `<div class="note">Note: ${order.shipping_note}</div>` : ""}
  </div>

  <div class="footer">Thank you for your order! ♥</div>
</body>
</html>`;

    const w = window.open("", "_blank", "width=430,height=620");
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 400);
  }

  function printPullList() {
    const pkgs = orders.filter(o => o.status === "packaging");
    if (pkgs.length === 0) {
      showToast("No orders in Packaging status", "err");
      return;
    }
    let html = '<html><head><title>Pull List</title><style>body{font-family:sans-serif;padding:20px;} h2{margin-bottom:5px;font-size:18px;} .order{border-bottom:1px solid #ccc;padding-bottom:15px;margin-bottom:15px;} ul{list-style:none;padding-left:0;} li{margin-bottom:8px;font-size:14px;} .check{display:inline-block;width:16px;height:16px;border:1.5px solid #000;margin-right:12px;position:relative;top:3px;border-radius:3px;}</style></head><body>';
    html += '<h1>📦 Cadence Creatures — Pull List</h1><p>Date: ' + new Date().toLocaleDateString() + '</p><hr/>';
    
    pkgs.forEach(o => {
      html += '<div class="order">';
      html += '<h2>Order #' + (o.etsy_order_id||o.id.slice(0,8)) + ' - ' + (o.buyer_name||'No Name') + '</h2>';
      html += '<ul>';
      const items = Array.isArray(o.items) ? o.items : [o.items].filter(Boolean);
      items.forEach(itm => {
        const isDone = itm.startsWith('[x] ');
        const text = isDone ? itm.slice(4) : itm;
        html += '<li><div class="check"></div>' + text + '</li>';
      });
      html += '</ul></div>';
    });
    html += '</body></html>';
    
    const w = window.open('','_blank');
    w.document.write(html);
    w.document.close();
    setTimeout(()=>w.print(), 500);
  }

  if (loading) return <div className="empty-state">Loading board…</div>;

  return (
    <div>
      {toast.msg && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: "var(--ink)", border: `1px solid ${toast.type === "err" ? "rgba(232,112,112,0.5)" : "var(--gold)"}`,
          color: toast.type === "err" ? "rgba(240,180,180,0.9)" : "var(--goldl)",
          fontSize: 12, letterSpacing: "0.08em", padding: "10px 22px",
          zIndex: 2000, whiteSpace: "nowrap", borderRadius: 3, fontFamily: "sans-serif",
        }}>
          {toast.msg}
        </div>
      )}
      <div className="sec-hdr" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 className={styles.title}>Fulfillment Board</h1>
          <div style={{ fontSize: "13px", color: "var(--cream-dim)", marginTop: "4px" }}>
            Check off items as they print and move orders through the pipeline.
          </div>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button className={`btn ${bulkMode ? "gold" : ""}`} onClick={() => { setBulkMode(!bulkMode); setSelectedOrders(new Set()); }}>
            ⚡ Batch Actions
          </button>
          <button className="btn" onClick={printPullList}>🖨 Print Packing Slip</button>
        </div>
      </div>

      <div className={styles.board}>
        {COLUMNS.map(col => {
          const colOrders = orders.filter(o => o.status === col.id);
          return (
            <div 
              key={col.id} 
              className={styles.col}
              onDragOver={e => handleDragOver(e, col.id)}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={e => handleDrop(e, col.id)}
            >
              <div className={styles.colHeader}>
                <span>{col.label}</span>
                <span className={styles.colCount}>{colOrders.length}</span>
              </div>
              <div className={`${styles.colBody} ${dragOverCol === col.id ? styles.dragOver : ""}`}>
                {colOrders.map(order => {
                  const isSelected = selectedOrders.has(order.id);
                  const isBulk = bulkMode;
                  
                  return (
                    <div
                      key={order.id}
                      draggable={!isBulk}
                      onDragStart={e => handleDragStart(e, order.id)}
                      onClick={() => toggleOrderSelection(order.id)}
                      className={`${styles.card} ${isSelected ? styles.cardSelected : ""} ${isBulk ? styles.cardBulkMode : ""}`}
                    >
                      <div className={styles.cardTop}>
                        <div>
                          <div className={styles.cardId}>#{order.etsy_order_id || order.id.slice(0, 8)}</div>
                          <div className={styles.cardBuyer}>{order.buyer_name || "No Name"}</div>
                        </div>
                        <div className={styles.cardDate}>
                          {order.order_date ? new Date(order.order_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ""}
                        </div>
                      </div>

                      <div className={styles.checklist}>
                        {(Array.isArray(order.items) ? order.items : []).map((itm, i) => {
                          const isDone = itm.startsWith("[x] ");
                          const rawText = isDone ? itm.slice(4) : itm;
                          return (
                            <div 
                              key={i} 
                              className={`${styles.chkItem} ${isDone ? styles.done : ""}`}
                              onClick={(e) => {
                                if (isBulk) return;
                                e.stopPropagation();
                                toggleItem(order.id, i);
                              }}
                            >
                              <div className={styles.chkBox}></div>
                              <span>{rawText}</span>
                            </div>
                          );
                        })}
                      </div>

                      {!isBulk && (
                        <div style={{ marginTop: "auto", paddingTop: "8px" }}>
                          {col.id === "queued" && <button className="btn sm" style={{width: "100%"}} onClick={() => moveOrder(order.id, "printing")}>Start Printing →</button>}
                          {col.id === "printing" && <button className="btn sm" style={{width: "100%"}} onClick={() => moveOrder(order.id, "printed")}>Mark Printed →</button>}
                          {col.id === "printed" && <button className="btn sm" style={{width: "100%"}} onClick={() => moveOrder(order.id, "packaging")}>To Packaging →</button>}
                          {col.id === "packaging" && (
                            <form
                              style={{ display: "flex", gap: "8px", flexDirection: "column" }}
                              onSubmit={e => {
                                e.preventDefault();
                                const tracking = e.target.tracking.value;
                                quickShip(order.id, tracking);
                              }}
                            >
                              <input className="fi" name="tracking" placeholder="Tracking #" style={{ fontSize: "11px", padding: "6px" }} defaultValue={order.tracking_number || ""} />
                              <div style={{ display: "flex", gap: "6px" }}>
                                <button
                                  type="button"
                                  className="btn sm"
                                  style={{ color: "var(--teal)", borderColor: "rgba(91,191,212,0.3)" }}
                                  onClick={e => { e.stopPropagation(); printLabel(order); }}
                                >
                                  🖨 Label
                                </button>
                                <button type="submit" className="btn sm pri" style={{ flex: 1 }}>📦 Mark Shipped</button>
                              </div>
                            </form>
                          )}
                          {col.id === "shipped" && (
                            <div style={{ fontSize: "10px", color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                              ✓ Shipped {order.tracking_number ? `(${order.tracking_number})` : ""}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {bulkMode && (
        <div className={styles.bulkBar}>
          <div style={{ color: "var(--goldl)", fontWeight: "500" }}><span>{selectedOrders.size}</span> Selected</div>
          <select className="fi" style={{ width: "160px", margin: 0, padding: "8px", fontSize: "12px" }} value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}>
            <option value="printing">Move to Printing</option>
            <option value="printed">Move to Printed</option>
            <option value="packaging">Move to Packaging</option>
            <option value="shipped">Move to Shipped</option>
          </select>
          <button className="btn pri" onClick={applyBulkMove}>Apply</button>
          <button className="btn" onClick={() => { setBulkMode(false); setSelectedOrders(new Set()); }}>Cancel</button>
        </div>
      )}
    </div>
  );
}
