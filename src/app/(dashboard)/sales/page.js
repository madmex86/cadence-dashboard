"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SalesPage() {
  const [orders, setOrders] = useState([]);
  const [creatures, setCreatures] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [oRes, cRes] = await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("creatures").select("id, name, log_number, qty_on_hand, price_retail").order("log_number"),
      ]);
      setOrders(oRes.data || []);
      setCreatures(cRes.data || []);
      setLoading(false);
    }
    load();
  }, []);

  const now = new Date();
  const weekAgo = new Date(now - 7 * 86400000);

  const shipped = orders.filter(o => ["shipped", "complete"].includes(o.status));
  const weekOrders = orders.filter(o => new Date(o.created_at) >= weekAgo);
  const totalRevenue = shipped.reduce((s, o) => s + (parseFloat(o.total_price || o.total_amount) || 0), 0);

  // Creature sales frequency from order items
  const itemCounts = {};
  for (const o of orders) {
    const items = Array.isArray(o.items) ? o.items : [];
    for (const item of items) {
      const key = typeof item === "string" ? item : (item.name || item.creature_name || JSON.stringify(item));
      itemCounts[key] = (itemCounts[key] || 0) + 1;
    }
  }
  const topSellers = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topSeller = topSellers[0]?.[0] || "—";

  // Revenue by week (last 8 weeks)
  const byWeek = {};
  for (const o of shipped) {
    const d = new Date(o.created_at);
    const weekStart = new Date(d - d.getDay() * 86400000);
    const key = weekStart.toISOString().slice(0, 10);
    if (!byWeek[key]) byWeek[key] = { revenue: 0, count: 0 };
    byWeek[key].revenue += parseFloat(o.total_price || o.total_amount) || 0;
    byWeek[key].count++;
  }
  const weeks = Object.entries(byWeek).sort().slice(-8).reverse();

  // Print queue recommendations (high demand, low stock)
  const recommendations = creatures
    .map(c => {
      const sold = itemCounts[c.name] || 0;
      return { ...c, sold };
    })
    .filter(c => c.sold > 0)
    .sort((a, b) => {
      const aScore = b.sold / Math.max(1, a.qty_on_hand || 0);
      const bScore = a.sold / Math.max(1, b.qty_on_hand || 0);
      return aScore - bScore;
    })
    .slice(0, 5);

  return (
    <div>
      <div className="sec-hdr">
        <h1 style={{ fontFamily: "var(--font-caveat), cursive", fontSize: "2rem", color: "var(--gold)", margin: 0 }}>Sales Intelligence</h1>
      </div>

      <div className="kpi-grid">
        <div className="kpi"><div className="kpi-label">Total Orders</div><div className="kpi-val">{orders.length}</div></div>
        <div className="kpi"><div className="kpi-label">This Week</div><div className="kpi-val">{weekOrders.length}</div></div>
        <div className="kpi"><div className="kpi-label">Revenue</div><div className="kpi-val">${totalRevenue.toFixed(0)}</div></div>
        <div className="kpi"><div className="kpi-label">Top Seller</div><div className="kpi-val" style={{ fontSize: 14 }}>{topSeller}</div></div>
      </div>

      {loading ? <div className="empty-state">Loading…</div> : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {/* Revenue by week */}
          <div>
            <div className="sec-hdr"><span className="sec-title">Revenue by Week</span></div>
            {weeks.length === 0 ? (
              <div className="empty-state">No data yet</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Week of</th><th>Orders</th><th>Revenue</th></tr></thead>
                  <tbody>
                    {weeks.map(([week, d]) => (
                      <tr key={week}>
                        <td style={{ fontFamily: "sans-serif" }}>{week}</td>
                        <td>{d.count}</td>
                        <td style={{ color: "var(--goldl)" }}>${d.revenue.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Top sellers */}
          <div>
            <div className="sec-hdr"><span className="sec-title">Top Sellers</span></div>
            {topSellers.length === 0 ? (
              <div className="empty-state">No sales data yet</div>
            ) : (
              <div>
                {topSellers.map(([name, count], i) => {
                  const maxCount = topSellers[0][1];
                  const pct = Math.round((count / maxCount) * 100);
                  return (
                    <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <span style={{ fontFamily: "sans-serif", fontSize: 11, color: "var(--goldl)", width: 20, textAlign: "right" }}>#{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                          <span style={{ fontSize: 12, color: "var(--cream-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                          <span style={{ fontSize: 12, color: "var(--dim)", fontFamily: "sans-serif", flexShrink: 0, marginLeft: 8 }}>{count} sold</span>
                        </div>
                        <div style={{ height: 4, background: "rgba(201,168,76,0.1)", borderRadius: 2 }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: "var(--gold)", borderRadius: 2, transition: "width 0.4s" }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Print queue recommendations */}
          <div style={{ gridColumn: "1 / -1" }}>
            <div className="sec-hdr"><span className="sec-title">Print Queue Recommendations</span></div>
            {recommendations.length === 0 ? (
              <div className="empty-state">Sell some creatures first to see recommendations</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
                {recommendations.map(c => (
                  <div key={c.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--gold-border)", borderRadius: 6, padding: "14px 16px" }}>
                    <div style={{ fontFamily: "var(--font-caveat), cursive", fontSize: 16, color: "var(--cream)", marginBottom: 4 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: "var(--dim)", fontFamily: "sans-serif" }}>{c.sold} sold · {c.qty_on_hand || 0} in stock</div>
                    <div style={{ marginTop: 8 }}>
                      <span className={`badge ${(c.qty_on_hand || 0) < 3 ? "badge-red" : (c.qty_on_hand || 0) < 8 ? "badge-gold" : "badge-green"}`}>
                        {(c.qty_on_hand || 0) < 3 ? "Print Now" : (c.qty_on_hand || 0) < 8 ? "Low Stock" : "OK"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
