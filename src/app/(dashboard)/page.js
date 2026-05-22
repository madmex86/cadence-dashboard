"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./hub.module.css";
import LogPrintsModal from "./LogPrintsModal";
import AddOrderModal from "./AddOrderModal";

export default function DashboardHub() {
  const router = useRouter();
  
  // Data State
  const [loading, setLoading] = useState(true);
  const [creatures, setCreatures] = useState([]);
  const [printers, setPrinters] = useState([]);
  const [queuedOrders, setQueuedOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [stats, setStats] = useState({ orders: 0, revenue: 0, totalAvail: 0, availList: [] });

  // Modal State
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const [invRes, creRes, ordersRes, finRes, prRes] = await Promise.all([
      supabase.from("inventory").select("spool_name, brand, color, spool_count, reorder_spool_threshold"),
      supabase.from("creatures").select("id, name, species, qty_on_hand, inventory_count"),
      supabase.from("orders").select("*").in("status", ["queued", "printing"]).order("created_at", { ascending: true }),
      supabase.from("finance").select("amount, entry_date, entry_type").eq("entry_type", "income"),
      supabase.from("printers").select("*"),
    ]);

    const allCreatures = creRes.data || [];
    const allPrinters = prRes.data || [];
    const qOrders = ordersRes.data || [];
    const fin = finRes.data || [];
    const inv = invRes.data || [];

    setCreatures(allCreatures);
    setPrinters(allPrinters);
    setQueuedOrders(qOrders);
    setInventory(inv);

    // Calc KPIs
    let totalAvail = 0;
    let availList = [];
    allCreatures.forEach(c => {
      let onHand = c.qty_on_hand ?? c.inventory_count ?? 0;
      let queuedForThis = 0;
      qOrders.filter(o => o.status === "queued").forEach(o => {
        if (Array.isArray(o.items)) {
          queuedForThis += o.items.filter(i => i.toLowerCase().includes(c.name.toLowerCase())).length;
        }
      });
      let avail = onHand - queuedForThis;
      if (avail < 0) avail = 0;
      totalAvail += avail;
      if (avail > 0) availList.push({ name: c.name, avail });
    });
    availList.sort((a, b) => b.avail - a.avail);

    const now = new Date();
    const moRev = fin.filter(e => {
      const d = new Date(e.entry_date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).reduce((sum, e) => sum + Number(e.amount), 0);

    setStats({
      orders: qOrders.filter(o => o.status === "queued").length,
      revenue: moRev,
      totalAvail,
      availList,
    });

    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Actions
  function handlePrintSaved() {
    setShowPrintModal(false);
    loadData();
  }

  function handleOrderSaved() {
    setShowOrderModal(false);
    loadData();
  }

  // Render Helpers
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div>
      <div className={styles.hubHeader}>
        <svg className={styles.hubCrown} width="44" height="34" viewBox="0 -2 76 52" fill="none">
          <path d="M6 44 L6 18 L22 32 L36 4 L50 32 L66 18 L66 44 Z" fill="none" stroke="#C9A84C" strokeWidth="2.5" strokeLinejoin="round" />
          <rect x="4" y="42" width="64" height="3" rx="1.5" fill="#C9A84C" />
          <circle cx="36" cy="4" r="5.5" fill="#E8D08A" />
          <circle cx="6" cy="18" r="4" fill="#5BBFD4" />
          <circle cx="66" cy="18" r="4" fill="#5BBFD4" />
        </svg>
        <div>
          <h1 className={styles.title}>Dashboard Hub</h1>
          <div className={styles.date}>{dateStr}</div>
        </div>
      </div>

      <div className={styles.quickActions}>
        <button className="btn pri" onClick={() => setShowPrintModal(true)}>📥 Log Finished Prints</button>
        <button className="btn" onClick={() => setShowOrderModal(true)}>➕ Add Order</button>
        <button className="btn" onClick={() => router.push('/queue?tab=cost-engine')}>💎 Cost Intelligence</button>
        <button className="btn" onClick={() => router.push('/queue')}>🗂 View Queue</button>
      </div>

      <div className={styles.kpiWrap}><div className="kpi-grid" style={{ marginBottom: "28px" }}>
        <div className="kpi">
          <div className="kpi-label">Unfulfilled Orders</div>
          <div className="kpi-val">{loading ? "—" : stats.orders}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Available for Sale</div>
          <div className="kpi-val">{loading ? "—" : stats.totalAvail}</div>
          <div style={{ fontSize: "11px", color: "rgba(196,188,178,0.5)", marginTop: "8px", lineHeight: 1.4 }}>
            {stats.availList.length > 0 
              ? <>Across <strong>{stats.availList.length}</strong> unique models<br/><span style={{ opacity: 0.7 }}>Top: {stats.availList.slice(0, 2).map(x => `${x.avail}x ${x.name}`).join(', ')}</span></> 
              : "Everything is sold out."}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Monthly Revenue</div>
          <div className="kpi-val">{loading ? "—" : `$${stats.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}</div>
        </div>
      </div></div>

      <div className={styles.panels}>
        {/* Live Printing */}
        <div className={styles.panel}>
          <h2 className={styles.panelTitle}><span>🖨</span> Live Printing</h2>
          {printers.length === 0 ? <div className={styles.notifEmpty}>No printers configured.</div> : (
            printers.map(p => {
              const curC = p.current_creature_id ? creatures.find(c => c.id === p.current_creature_id) : null;
              return (
                <div key={p.id} className={styles.notifItem}>
                  <strong>{p.name}:</strong>{" "}
                  {curC
                    ? <span style={{ color: "var(--goldl)" }}>Printing {curC.name}</span>
                    : <span style={{ color: "var(--dim)" }}>Idle</span>}
                </div>
              );
            })
          )}
        </div>

        {/* Next Up */}
        <div className={styles.panel}>
          <h2 className={styles.panelTitle}><span>🔜</span> Next Up to Print</h2>
          {(() => {
            const next = queuedOrders.filter(o => o.status === "queued").slice(0, 4);
            if (next.length === 0) return <div className={styles.notifEmpty}>Queue is clear!</div>;
            return next.map(o => (
              <div key={o.id} className={styles.notifItem}>
                ▶ {o.buyer_name || `Order ${o.id.slice(0, 5)}`}: {(o.items || []).join(", ")}
              </div>
            ));
          })()}
        </div>

        {/* Batching */}
        <div className={styles.panel}>
          <h2 className={styles.panelTitle}><span>🛠</span> Batching Assistant</h2>
          {(() => {
            const counts = {};
            queuedOrders.filter(o => o.status === "queued").forEach(o => {
              if (Array.isArray(o.items)) o.items.forEach(i => { counts[i] = (counts[i] || 0) + 1; });
            });
            const b = Object.entries(counts).sort((a, b) => b[1] - a[1]);
            if (b.length === 0) return <div className={styles.notifEmpty}>No items queued.</div>;
            return b.map(([name, qty]) => (
              <div key={name} className={styles.notifItem}>
                Print <strong style={{ color: "var(--goldl)" }}>{qty}×</strong> {name}
              </div>
            ));
          })()}
        </div>

        {/* Filament Alerts */}
        <div className={styles.panel}>
          <h2 className={styles.panelTitle}><span>🧵</span> Filament Alerts</h2>
          {(() => {
            const lowInv = inventory.filter(s => (s.spool_count ?? 0) <= (s.reorder_spool_threshold ?? 1));
            if (lowInv.length === 0) return <div className={styles.notifEmpty}>All spools good.</div>;
            return lowInv.map(s => {
              const label = [s.brand, s.color, s.spool_name].filter(Boolean).join(" ").trim() || "Unnamed spool";
              return (
                <div key={s.id || label} className={`${styles.notifItem} ${styles.critical}`}>
                  {label} — {s.spool_count} left
                </div>
              );
            });
          })()}
        </div>

        {/* Creature Stock */}
        <div className={styles.panel}>
          <h2 className={styles.panelTitle}><span>🦎</span> Creature Stock</h2>
          {(() => {
            const lowCre = creatures.filter(c => (c.qty_on_hand ?? c.inventory_count ?? 0) <= 2);
            if (lowCre.length === 0) return <div className={styles.notifEmpty}>All creatures stocked.</div>;
            return lowCre.map(c => (
              <div key={c.id} className={`${styles.notifItem} ${styles.critical}`}>
                {c.name} — {c.qty_on_hand ?? c.inventory_count ?? 0} on hand
              </div>
            ));
          })()}
        </div>
      </div>

      <LogPrintsModal 
        isOpen={showPrintModal} 
        onClose={() => setShowPrintModal(false)} 
        creatures={creatures} 
        onSave={handlePrintSaved} 
      />

      <AddOrderModal 
        isOpen={showOrderModal} 
        onClose={() => setShowOrderModal(false)} 
        creatures={creatures} 
        onSave={handleOrderSaved} 
      />
    </div>
  );
}
