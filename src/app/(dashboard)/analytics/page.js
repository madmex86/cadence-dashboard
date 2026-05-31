"use client";
import { useState, useEffect } from "react";
import { createClient } from "../../../lib/supabase/client";
import styles from "./analytics.module.css";

export default function AnalyticsPage() {
  const [orders, setOrders] = useState([]);
  const [finance, setFinance] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [ordRes, finRes] = await Promise.all([
        supabase.from("orders").select("id, total_amount, status, items, created_at, order_date").order("created_at", { ascending: false }),
        supabase.from("finance").select("amount, entry_date, order_id").eq("entry_type", "income")
      ]);
      setOrders(ordRes.data || []);
      setFinance(finRes.data || []);
      setLoading(false);
    }
    load();
  }, []);

  const activeOrders = orders.filter(o => o.status !== "cancelled");
  const shipped = activeOrders.filter(o => ["shipped", "complete"].includes(o.status));
  const manualFinance = finance.filter(f => !f.order_id);

  const totalRevenue = activeOrders.reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0) + 
                       manualFinance.reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);
  const avgOrder = activeOrders.length ? totalRevenue / activeOrders.length : 0;

  // Monthly breakdown
  const byMonth = {};
  
  for (const o of activeOrders) {
    const d = new Date(o.order_date || o.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth[key]) byMonth[key] = { revenue: 0, count: 0 };
    byMonth[key].revenue += parseFloat(o.total_amount) || 0;
    byMonth[key].count++;
  }
  
  for (const f of manualFinance) {
    const d = new Date(f.entry_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth[key]) byMonth[key] = { revenue: 0, count: 0 };
    byMonth[key].revenue += parseFloat(f.amount) || 0;
  }

  const months = Object.entries(byMonth).sort().slice(-6).reverse();

  // Item frequency
  const itemCounts = {};
  for (const o of orders) {
    const items = Array.isArray(o.items) ? o.items : [o.items].filter(Boolean);
    for (const item of items) {
      itemCounts[item] = (itemCounts[item] || 0) + 1;
    }
  }
  const topItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  return (
    <div>
      <div className="sec-hdr">
        <h1 className={styles.title}>Analytics</h1>
      </div>

      <div className="kpi-grid">
        <div className="kpi"><div className="kpi-label">Total Revenue</div><div className="kpi-val">${totalRevenue.toFixed(0)}</div></div>
        <div className="kpi"><div className="kpi-label">Active Orders</div><div className="kpi-val">{activeOrders.length}</div></div>
        <div className="kpi"><div className="kpi-label">Avg Revenue/Order</div><div className="kpi-val">${avgOrder.toFixed(0)}</div></div>
        <div className="kpi"><div className="kpi-label">Orders Shipped</div><div className="kpi-val">{shipped.length}</div></div>
      </div>

      <div className={styles.panels}>
        <div>
          <div className="sec-hdr"><span className="sec-title">Revenue by Month</span></div>
          {loading ? <div className="empty-state">Loading…</div> : months.length === 0 ? (
            <div className="empty-state">No data yet</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Month</th><th>Orders</th><th>Revenue</th></tr></thead>
                <tbody>
                  {months.map(([month, d]) => (
                    <tr key={month}>
                      <td style={{ fontFamily: "sans-serif" }}>{month}</td>
                      <td>{d.count}</td>
                      <td style={{ color: "var(--goldl)" }}>${d.revenue.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <div className="sec-hdr"><span className="sec-title">Top Selling Creatures</span></div>
          {loading ? <div className="empty-state">Loading…</div> : topItems.length === 0 ? (
            <div className="empty-state">No data yet</div>
          ) : (
            <div className={styles.topList}>
              {topItems.map(([item, count], i) => (
                <div key={item} className={styles.topRow}>
                  <span className={styles.rank}>#{i + 1}</span>
                  <span className={styles.item}>{item}</span>
                  <span className={styles.count}>{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
