"use client";
import { useState, useEffect } from "react";
import { createClient } from "../../../lib/supabase/client";
import styles from "./analytics.module.css";

export default function AnalyticsPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("orders")
        .select("id, total_amount, status, items, created_at, order_date")
        .order("created_at", { ascending: false });
      setOrders(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const shipped = orders.filter(o => ["shipped", "complete"].includes(o.status));
  const totalRevenue = shipped.reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0);
  const avgOrder = shipped.length ? totalRevenue / shipped.length : 0;

  // Monthly breakdown
  const byMonth = {};
  for (const o of shipped) {
    const d = new Date(o.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth[key]) byMonth[key] = { revenue: 0, count: 0 };
    byMonth[key].revenue += parseFloat(o.total_amount) || 0;
    byMonth[key].count++;
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
        <div className="kpi"><div className="kpi-label">Orders Shipped</div><div className="kpi-val">{shipped.length}</div></div>
        <div className="kpi"><div className="kpi-label">Avg Order Value</div><div className="kpi-val">${avgOrder.toFixed(0)}</div></div>
        <div className="kpi"><div className="kpi-label">Total Orders</div><div className="kpi-val">{orders.length}</div></div>
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
