"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "../../../lib/supabase/client";
import Link from "next/link";
import CreatureModal from "./CreatureModal";
import ScannerModal from "../ScannerModal";
import styles from "./creatures.module.css";

const ENV_COLORS = {
  forest: "#6B9E6E",
  ocean: "#5BBFD4",
  fantasy: "#9B8AC4",
  holiday: "#C9614A",
  space: "#4A7AA8",
};

export default function CreaturesPage() {
  const [creatures, setCreatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterEnv, setFilterEnv] = useState("");
  const [showBinScanner, setShowBinScanner] = useState(false);
  const [toast, setToast] = useState({ msg: "", type: "ok" });
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("creatures")
      .select("*")
      .order("log_number", { ascending: true });
    setCreatures(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() { setEditing(null); setModalOpen(true); }
  function openEdit(c) { setEditing(c); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditing(null); }

  async function handleSave(formData, id) {
    const supabase = createClient();
    let error;
    if (id) {
      ({ error } = await supabase.from("creatures").update(formData).eq("id", id));
    } else {
      ({ error } = await supabase.from("creatures").insert(formData));
    }
    if (error) {
      alert("Save failed: " + error.message);
      return;
    }
    closeModal();
    load();
  }

  async function toggleField(id, field, value) {
    const supabase = createClient();
    await supabase.from("creatures").update({ [field]: value }).eq("id", id);
    setCreatures(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  }

  async function adjustStock(id, delta) {
    const creature = creatures.find(c => c.id === id);
    if (!creature) return;
    const next = Math.max(0, (creature.qty_on_hand || 0) + delta);
    const supabase = createClient();
    await supabase.from("creatures").update({ qty_on_hand: next }).eq("id", id);
    setCreatures(prev => prev.map(c => c.id === id ? { ...c, qty_on_hand: next } : c));
  }

  function revealCountdown(reveal_date) {
    const diff = new Date(reveal_date) - now;
    if (diff <= 0) return null;
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  function showToast(msg, type = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "ok" }), 3500);
  }

  // ── Bin Label helpers ─────────────────────────────────────────────────────
  function labelHTML(c, qrUrl) {
    const env = c.environment ? c.environment.charAt(0).toUpperCase() + c.environment.slice(1) : "";
    return `
      <div class="label">
        <img class="qr" src="${qrUrl}" alt="QR" />
        <div class="info">
          <div class="name">${c.name || "—"}</div>
          <div class="sku">${c.sku || "No SKU"}</div>
          <div class="detail">${c.species || ""}${env ? " · " + env : ""}</div>
        </div>
      </div>`;
  }

  const LABEL_CSS = `
    @page { size: 2.25in 1.25in; margin: 0.07in; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #fff; color: #111; }
    .label {
      display: flex;
      align-items: center;
      gap: 5px;
      width: 2.11in;
      height: 1.11in;
      page-break-after: always;
      overflow: hidden;
    }
    .qr { width: 0.88in; height: 0.88in; flex-shrink: 0; display: block; }
    .info { flex: 1; overflow: hidden; display: flex; flex-direction: column; gap: 1.5px; }
    .name { font-size: 9pt; font-weight: bold; line-height: 1.15; word-break: break-word; }
    .sku  { font-size: 7pt; font-family: monospace; color: #333; letter-spacing: 0.03em; }
    .detail { font-size: 6.5pt; color: #555; }`;

  async function printBinLabel(creature) {
    const QRCode = (await import("qrcode")).default;
    const qrUrl = await QRCode.toDataURL(creature.id, { width: 90, margin: 1, color: { dark: "#111111", light: "#ffffff" } });
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Bin Label</title><style>${LABEL_CSS}</style></head><body>${labelHTML(creature, qrUrl)}</body></html>`;
    const w = window.open("", "_blank", "width=300,height=200");
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 350);
  }

  async function printAllBinLabels() {
    if (visible.length === 0) { showToast("No creatures to print", "err"); return; }
    const QRCode = (await import("qrcode")).default;
    const labelsHtml = await Promise.all(
      visible.map(async c => {
        const qrUrl = await QRCode.toDataURL(c.id, { width: 90, margin: 1, color: { dark: "#111111", light: "#ffffff" } });
        return labelHTML(c, qrUrl);
      })
    );
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Bin Labels</title><style>${LABEL_CSS}</style></head><body>${labelsHtml.join("")}</body></html>`;
    const w = window.open("", "_blank", "width=300,height=200");
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 400);
  }

  // ── Round Sticker helpers ─────────────────────────────────────────────────
  function stickerSVG(c, qrUrl) {
    const nameUC = (c.name || "Unnamed").toUpperCase();
    const logPad = String(c.log_number || "000").padStart(3, "0");
    const cid = c.id.replace(/-/g, "");
    const cs = 0.47;
    const ctx = (200 - 36 * cs).toFixed(1);
    const cty = (89  - 24 * cs).toFixed(1);
    const qrBlock = qrUrl
      ? `<image xlink:href="${qrUrl}" href="${qrUrl}" x="114" y="110" width="172" height="172"/>`
      : `<rect x="114" y="110" width="172" height="172" fill="none" stroke="black" stroke-width="1" stroke-dasharray="5 4" opacity="0.3"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 400 400" width="100%" height="100%">
  <defs>
    <clipPath id="cc${cid}"><circle cx="200" cy="200" r="191"/></clipPath>
    <path id="arcT${cid}" d="M 32,200 A 168,168 0 0,1 368,200"/>
  </defs>
  <circle cx="200" cy="200" r="195" fill="white" clip-path="url(#cc${cid})"/>
  <circle cx="200" cy="200" r="192" fill="none" stroke="black" stroke-width="3.5"/>
  <circle cx="200" cy="200" r="183" fill="none" stroke="black" stroke-width="0.9" stroke-dasharray="3 2.5" opacity="0.4"/>
  <text font-family="Lora, Georgia, serif" font-size="16" font-weight="600" fill="black" letter-spacing="2.8">
    <textPath href="#arcT${cid}" xlink:href="#arcT${cid}" startOffset="50%" text-anchor="middle">CADENCE CREATURES</textPath>
  </text>
  <g transform="translate(${ctx},${cty}) scale(${cs})">
    <path d="M6 44 L6 18 L22 32 L36 4 L50 32 L66 18 L66 44 Z" fill="none" stroke="black" stroke-width="4.5" stroke-linejoin="round"/>
    <rect x="4" y="41" width="64" height="6" rx="3" fill="black"/>
    <circle cx="36" cy="4" r="6.5" fill="black"/>
    <circle cx="6"  cy="18" r="5" fill="black"/>
    <circle cx="66" cy="18" r="5" fill="black"/>
  </g>
  ${qrBlock}
  <line x1="148" y1="294" x2="252" y2="294" stroke="black" stroke-width="0.75" opacity="0.28"/>
  <text x="200" y="317" text-anchor="middle" font-family="Lora, Georgia, serif" font-size="18" font-weight="600" fill="black" letter-spacing="2.5">${nameUC}</text>
  <circle cx="138" cy="313" r="2.2" fill="black" opacity="0.28"/>
  <circle cx="262" cy="313" r="2.2" fill="black" opacity="0.28"/>
  <text x="200" y="336" text-anchor="middle" font-family="Lora, Georgia, serif" font-size="11" fill="black" opacity="0.42" letter-spacing="2">LOG  ${logPad}</text>
  <text x="200" y="365" text-anchor="middle" font-family="Caveat, cursive" font-size="24" fill="black" opacity="0.55" letter-spacing="1">Thank You</text>
</svg>`;
  }

  const STICKER_CSS = `
    @page { size: 2in 2in; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: white; }
    .sticker { width: 2in; height: 2in; page-break-after: always; overflow: hidden; }`;

  const STICKER_HEAD = `
    <link rel="preconnect" href="https://fonts.googleapis.com"/>
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
    <link href="https://fonts.googleapis.com/css2?family=Lora:wght@600&family=Caveat:wght@500&display=swap" rel="stylesheet"/>`;

  async function printRoundSticker(creature) {
    const QRCode = (await import("qrcode")).default;
    const loreUrl = `https://cadencecreatures.com/logs/creature.html?name=${encodeURIComponent(creature.name || "")}`;
    const qrUrl = await QRCode.toDataURL(loreUrl, { width: 200, margin: 1, color: { dark: "#000000", light: "#ffffff" } });
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sticker</title>${STICKER_HEAD}<style>${STICKER_CSS}</style></head><body><div class="sticker">${stickerSVG(creature, qrUrl)}</div></body></html>`;
    const w = window.open("", "_blank", "width=320,height=320");
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 1200);
  }

  async function printAllRoundStickers() {
    if (visible.length === 0) { showToast("No creatures to print", "err"); return; }
    const QRCode = (await import("qrcode")).default;
    const stickersHtml = await Promise.all(
      visible.map(async c => {
        const loreUrl = `https://cadencecreatures.com/logs/creature.html?name=${encodeURIComponent(c.name || "")}`;
        const qrUrl = await QRCode.toDataURL(loreUrl, { width: 200, margin: 1, color: { dark: "#000000", light: "#ffffff" } });
        return `<div class="sticker">${stickerSVG(c, qrUrl)}</div>`;
      })
    );
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Stickers</title>${STICKER_HEAD}<style>${STICKER_CSS}</style></head><body>${stickersHtml.join("")}</body></html>`;
    const w = window.open("", "_blank", "width=320,height=320");
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 1400);
  }

  // ── Bin QR scanner ────────────────────────────────────────────────────────
  function handleBinScan(decoded) {
    setShowBinScanner(false);
    const match = creatures.find(c => c.id === decoded.trim());
    if (!match) { showToast("QR not linked to any creature", "err"); return; }
    showToast(`Found: ${match.name}`);
    openEdit(match);
  }

  const visible = creatures.filter(c => {
    const q = search.toLowerCase();
    if (q && !c.name?.toLowerCase().includes(q) && !c.species?.toLowerCase().includes(q) && !c.sku?.toLowerCase().includes(q)) return false;
    if (filterEnv && c.environment !== filterEnv) return false;
    return true;
  });

  return (
    <div>
      {toast.msg && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "var(--ink)", border: `1px solid ${toast.type === "err" ? "rgba(232,112,112,0.5)" : "var(--gold)"}`, color: toast.type === "err" ? "rgba(240,180,180,0.9)" : "var(--goldl)", fontSize: 12, letterSpacing: "0.08em", padding: "10px 22px", zIndex: 2000, whiteSpace: "nowrap", borderRadius: 3, fontFamily: "sans-serif" }}>
          {toast.msg}
        </div>
      )}

      <div className="sec-hdr">
        <h1 className={styles.title}>Creatures</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn sm" onClick={() => setShowBinScanner(true)}>📷 Scan Bin</button>
          <button className="btn sm" onClick={printAllBinLabels}>🏷 Print All Labels</button>
          <button className="btn sm" onClick={printAllRoundStickers}>⭕ Print All Stickers</button>
          <button className="btn gold" onClick={openNew}>+ Add Creature</button>
        </div>
      </div>

      <div className={styles.filters}>
        <input
          className="fi"
          style={{ maxWidth: 260 }}
          placeholder="Search name, species, SKU…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="fi" style={{ maxWidth: 160 }} value={filterEnv} onChange={e => setFilterEnv(e.target.value)}>
          <option value="">All environments</option>
          <option value="forest">Forest</option>
          <option value="ocean">Ocean</option>
          <option value="fantasy">Fantasy</option>
          <option value="holiday">Holiday</option>
          <option value="space">Space</option>
        </select>
        <span className={styles.count}>{visible.length} creatures</span>
      </div>

      {loading ? (
        <div className="empty-state">Loading creatures…</div>
      ) : visible.length === 0 ? (
        <div className="empty-state">No creatures found</div>
      ) : (
        <div className={styles.grid}>
          {visible.map(c => (
            <div
              key={c.id}
              className={styles.card}
              style={{ borderTopColor: ENV_COLORS[c.environment] || "transparent" }}
            >
              {c.image_url ? (
                <img src={c.image_url} alt={c.name} className={styles.img} />
              ) : (
                <div className={styles.imgPlaceholder}>No Image</div>
              )}

              <div className={styles.body}>
                <div className={styles.meta}>
                  #{String(c.log_number || "—").padStart(3, "0")} · {c.sku || "—"}
                </div>
                <div className={styles.name}>{c.name || "Unnamed"}</div>
                <div className={styles.species}>{c.species}</div>

                {c.reveal_date && (
                  <div className={`${styles.countdown} ${revealCountdown(c.reveal_date) ? styles.countdownPending : styles.countdownLive}`}>
                    {revealCountdown(c.reveal_date) ? `⏱ Reveals in ${revealCountdown(c.reveal_date)}` : "● Live on site"}
                  </div>
                )}

                <div className={styles.toggleRow}>
                  <button
                    className={`${styles.tog} ${c.active ? styles.togGreen : ""}`}
                    onClick={() => toggleField(c.id, "active", !c.active)}
                  >
                    <span className={styles.dot} />
                    {c.active ? "Active" : "Inactive"}
                  </button>
                  <button
                    className={`${styles.tog} ${c.is_featured ? styles.togGold : ""}`}
                    onClick={() => toggleField(c.id, "is_featured", !c.is_featured)}
                  >
                    <span className={styles.dot} />
                    Featured
                  </button>
                  <button
                    className={`${styles.tog} ${c.in_launch_queue ? styles.togTeal : ""}`}
                    onClick={() => toggleField(c.id, "in_launch_queue", !c.in_launch_queue)}
                  >
                    <span className={styles.dot} />
                    Queue
                  </button>
                </div>

                <div className={styles.stockRow}>
                  <button className={styles.adj} onClick={() => adjustStock(c.id, -1)}>−</button>
                  <span className={styles.stockVal}>{c.qty_on_hand ?? 0}</span>
                  <button className={styles.adj} onClick={() => adjustStock(c.id, 1)}>+</button>
                  <span className={styles.stockLbl}>in stock</span>
                </div>

                {(c.price_retail || c.price_etsy || c.cost_to_print) && (
                  <div className={styles.prices}>
                    {c.price_retail && <span>Retail ${parseFloat(c.price_retail).toFixed(2)}</span>}
                    {c.price_etsy && <span>Etsy ${parseFloat(c.price_etsy).toFixed(2)}</span>}
                    {c.cost_to_print && <span style={{ color: "var(--teal)" }}>Cost ${parseFloat(c.cost_to_print).toFixed(2)}</span>}
                  </div>
                )}

                <div className={styles.actions}>
                  <button className="btn sm" onClick={() => openEdit(c)}>Edit</button>
                  <Link className="btn sm" href={`/lure-forge?id=${c.id}`} style={{ color: "var(--goldl)", borderColor: "rgba(201,168,76,0.25)" }}>🪄 Lore</Link>
                  <button className="btn sm" style={{ color: "var(--teal)", borderColor: "rgba(91,191,212,0.3)" }} onClick={() => printBinLabel(c)}>🏷</button>
                  <button className="btn sm" style={{ color: "var(--goldl)", borderColor: "rgba(201,168,76,0.3)" }} onClick={() => printRoundSticker(c)}>⭕</button>
                  {c.etsy_url && (
                    <a className="btn sm" href={c.etsy_url} target="_blank" rel="noopener noreferrer">Etsy ↗</a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button className={styles.fab} onClick={openNew} aria-label="Add creature">+</button>

      {modalOpen && (
        <CreatureModal
          creature={editing}
          onClose={closeModal}
          onSave={handleSave}
        />
      )}

      <ScannerModal
        isOpen={showBinScanner}
        onClose={() => setShowBinScanner(false)}
        onScan={handleBinScan}
        mode="qr"
        title="Scan Bin Label"
        hint="Point at the QR code on a bin label to open that creature's edit modal."
      />
    </div>
  );
}
