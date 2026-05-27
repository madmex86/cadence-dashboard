"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./hub.module.css";

export default function AddOrderModal({ isOpen, onClose, creatures, onSave }) {
  const [oEid, setOEid] = useState("");
  const [oBuyer, setOBuyer] = useState("");
  const [oEmail, setOEmail] = useState("");
  const [oItems, setOItems] = useState([{ name: "", qty: 1 }]);
  const [oSt, setOSt] = useState("queued");
  const [oPrinter, setOPrinter] = useState("Vision");
  const [oAmt, setOAmt] = useState("");
  const [oDt, setODt] = useState(new Date().toISOString().slice(0, 10));
  const [oTrack, setOTrack] = useState("");
  const [oCarrier, setOCarrier] = useState("");
  const [oNote, setONote] = useState("");

  async function handleSave() {
    const items = oItems.map(i => {
      const name = i.name;
      if (!name) return null;
      return parseInt(i.qty) > 1 ? `${name} x${i.qty}` : name;
    }).filter(Boolean);

    const supabase = createClient();
    await supabase.from("orders").insert([{
      etsy_order_id: oEid,
      buyer_name: oBuyer,
      buyer_email: oEmail || null,
      items,
      status: oSt,
      printer_name: oPrinter,
      total_amount: oAmt,
      order_date: oDt || null,
      tracking_number: oTrack,
      carrier: oCarrier,
      shipping_note: oNote
    }]);

    // Reset state
    setOEid("");
    setOBuyer("");
    setOEmail("");
    setOItems([{ name: "", qty: 1 }]);
    setOSt("queued");
    setOPrinter("Vision");
    setOAmt("");
    setODt(new Date().toISOString().slice(0, 10));
    setOTrack("");
    setOCarrier("");
    setONote("");

    onSave();
  }

  return (
    <div className={`${styles.overlay} ${isOpen ? styles.open : ""}`}>
      <div className={styles.modal}>
        <div className={styles.modalTitle}>Add Order</div>
        <div className={styles.fg}>
          <div className={styles.fr}>
            <div><label className={styles.fl}>Etsy Order ID</label><input className="fi" value={oEid} onChange={e => setOEid(e.target.value)} placeholder="e.g. 1234567890" /></div>
            <div><label className={styles.fl}>Buyer Name</label><input className="fi" value={oBuyer} onChange={e => setOBuyer(e.target.value)} /></div>
          </div>
          <div><label className={styles.fl}>Buyer Email</label><input className="fi" type="email" value={oEmail} onChange={e => setOEmail(e.target.value)} placeholder="Optional" /></div>
          <div>
            <label className={styles.fl}>Items</label>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "6px" }}>
              {oItems.map((itm, i) => (
                <div key={i} style={{ display: "flex", gap: "8px" }}>
                  <input type="number" className="fi" style={{ width: "54px" }} min="1" value={itm.qty} onChange={e => {
                    const n = [...oItems]; n[i].qty = e.target.value; setOItems(n);
                  }} />
                  <select className="fi" value={itm.name} onChange={e => {
                    const n = [...oItems]; n[i].name = e.target.value; setOItems(n);
                  }}>
                    <option value="">Select creature…</option>
                    {creatures.map(c => <option key={c.id} value={c.name}>{c.name} {c.species ? '— '+c.species : ''}</option>)}
                  </select>
                  {oItems.length > 1 && (
                    <button className="btn sm red" onClick={() => {
                      const n = [...oItems]; n.splice(i, 1); setOItems(n);
                    }}>✕</button>
                  )}
                </div>
              ))}
            </div>
            <button className="btn sm" onClick={() => setOItems([...oItems, { name: "", qty: 1 }])}>+ Add Item</button>
          </div>
          <div className={styles.fr}>
            <div>
              <label className={styles.fl}>Status</label>
              <select className="fi" value={oSt} onChange={e => setOSt(e.target.value)}>
                <option value="queued">Queued</option>
                <option value="printing">Printing</option>
                <option value="printed">Printed</option>
                <option value="packaging">Packaging</option>
                <option value="shipped">Shipped</option>
                <option value="complete">Complete</option>
              </select>
            </div>
            <div>
              <label className={styles.fl}>Printer</label>
              <select className="fi" value={oPrinter} onChange={e => setOPrinter(e.target.value)}>
                <option value="Vision">Vision</option>
                <option value="In Stock">In Stock / No Print</option>
              </select>
            </div>
          </div>
          <div className={styles.fr}>
            <div><label className={styles.fl}>Total ($)</label><input type="number" className="fi" step="0.01" value={oAmt} onChange={e => setOAmt(e.target.value)} /></div>
            <div><label className={styles.fl}>Order Date</label><input type="date" className="fi" value={oDt} onChange={e => setODt(e.target.value)} /></div>
          </div>
          <div className={styles.fr}>
            <div><label className={styles.fl}>Tracking Number</label><input className="fi" value={oTrack} onChange={e => setOTrack(e.target.value)} placeholder="9400..." /></div>
            <div>
              <label className={styles.fl}>Carrier</label>
              <select className="fi" value={oCarrier} onChange={e => setOCarrier(e.target.value)}>
                <option value="">Auto-detect</option>
                <option value="usps">USPS</option>
                <option value="ups">UPS</option>
                <option value="fedex">FedEx</option>
              </select>
            </div>
          </div>
          <div><label className={styles.fl}>Shipping Note</label><input className="fi" value={oNote} onChange={e => setONote(e.target.value)} /></div>
        </div>
        <div className={styles.modalAct}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn pri" onClick={handleSave}>Save Order</button>
        </div>
      </div>
    </div>
  );
}
