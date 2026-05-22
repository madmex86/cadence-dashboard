"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./hub.module.css";

export default function LogPrintsModal({ isOpen, onClose, creatures, onSave }) {
  const [printCreatureId, setPrintCreatureId] = useState("");
  const [printQty, setPrintQty] = useState(1);

  async function handleSave() {
    if (!printCreatureId) return;
    const qty = parseInt(printQty) || 1;
    const c = creatures.find((x) => x.id === printCreatureId);
    if (!c) return;

    const newQty = (c.qty_on_hand ?? c.inventory_count ?? 0) + qty;
    const supabase = createClient();
    await supabase.from("creatures").update({ qty_on_hand: newQty }).eq("id", printCreatureId);
    
    // Reset state
    setPrintCreatureId("");
    setPrintQty(1);

    onSave();
  }

  return (
    <div className={`${styles.overlay} ${isOpen ? styles.open : ""}`}>
      <div className={styles.modal}>
        <div className={styles.modalTitle}>📥 Log Finished Prints</div>
        <div className={styles.fg}>
          <div>
            <label className={styles.fl}>Creature</label>
            <select className="fi" value={printCreatureId} onChange={e => setPrintCreatureId(e.target.value)}>
              <option value="">Select creature...</option>
              {creatures.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className={styles.fl}>Quantity Produced</label>
            <input type="number" className="fi" min="1" value={printQty} onChange={e => setPrintQty(e.target.value)} />
          </div>
        </div>
        <p style={{ fontSize: "11px", color: "var(--dim)", marginTop: "14px", lineHeight: 1.4 }}>
          This will add the quantity to your <strong>Total On-Hand</strong> inventory, automatically increasing what's <em>Available for Sale</em>.
        </p>
        <div className={styles.modalAct}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn pri" onClick={handleSave}>Add to Stock</button>
        </div>
      </div>
    </div>
  );
}
