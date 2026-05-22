"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "../../../lib/supabase/client";
import styles from "./live.module.css";

export default function LivePage() {
  const [orders, setOrders] = useState([]);
  const [creatures, setCreatures] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [ordersRes, creaturesRes] = await Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("creatures").select("id, name, qty_on_hand, active, log_number, sku, price_etsy").order("log_number"),
    ]);
    setOrders(ordersRes.data || []);
    setCreatures(creaturesRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const supabase = createClient();
    const channel = supabase
      .channel("live-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [load]);

  const today = new Date().toDateString();
  const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === today);
  const todayRevenue = todayOrders.reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0);
  const activeCreatures = creatures.filter(c => c.active);
  const lowStock = creatures.filter(c => c.active && (c.qty_on_hand || 0) < 3);

  return (
    <div>
      <div className={styles.liveHeader}>
        <h1 className={styles.title}>Live Analytics</h1>
        <span className={styles.pulse}><span className={styles.dot} /> Live</span>
      </div>

      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">Orders Today</div>
          <div className="kpi-val">{loading ? "—" : todayOrders.length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Revenue Today</div>
          <div className="kpi-val">{loading ? "—" : `$${todayRevenue.toFixed(0)}`}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Active Creatures</div>
          <div className="kpi-val">{loading ? "—" : activeCreatures.length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Low Stock (&lt;3)</div>
          <div className="kpi-val" style={{ color: lowStock.length > 0 ? "#e87070" : "var(--goldl)" }}>
            {loading ? "—" : lowStock.length}
          </div>
        </div>
      </div>

      <div className={styles.panels}>
        <div>
          <div className="sec-hdr"><span className="sec-title">Recent Orders</span></div>
          {loading ? (
            <div className="empty-state">Loading…</div>
          ) : orders.length === 0 ? (
            <div className="empty-state">No orders yet</div>
          ) : (
            <div className={styles.feed}>
              {orders.slice(0, 20).map(o => (
                <div key={o.id} className={styles.feedItem}>
                  <div className={styles.feedMeta}>
                    <span className={styles.feedTime}>{formatTime(o.created_at)}</span>
                    <span className={`badge ${o.status === "shipped" ? "badge-green" : o.status === "complete" ? "badge-dim" : "badge-gold"}`}>
                      {o.status}
                    </span>
                  </div>
                  <div className={styles.feedBuyer}>{o.buyer_name || "Unknown"}</div>
                  <div className={styles.feedItems}>
                    {Array.isArray(o.items) ? o.items.join(", ") : (o.items || "—")}
                  </div>
                  {o.total_amount && (
                    <div className={styles.feedAmount}>${parseFloat(o.total_amount).toFixed(2)}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="sec-hdr"><span className="sec-title">Stock Status</span></div>
          {loading ? (
            <div className="empty-state">Loading…</div>
          ) : (
            <div className={styles.stockList}>
              {creatures.filter(c => c.active).map(c => (
                <div key={c.id} className={styles.stockRow}>
                  <span className={styles.stockName}>
                    #{String(c.log_number || "—").padStart(3, "0")} {c.name}
                  </span>
                  <div className={styles.stockBar}>
                    <div
                      className={styles.stockFill}
                      style={{
                        width: `${Math.min(100, ((c.qty_on_hand || 0) / 20) * 100)}%`,
                        background: (c.qty_on_hand || 0) < 3 ? "#e87070" : (c.qty_on_hand || 0) < 8 ? "var(--gold)" : "#7dc994",
                      }}
                    />
                  </div>
                  <span className={styles.stockQty}>{c.qty_on_hand ?? 0}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
