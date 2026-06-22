"use client";

import { useState } from "react";
import { createClient } from "../../../lib/supabase/client";

function slugify(str) {
  return str.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const ITEM_TYPE_LABELS = {
  creature:    "Creature",
  mini:        "Mini",
  keychain:    "Keychain",
  random_mini: "Random Mini",
};

const BLANK_ITEM = { creature_id: "", item_type: "creature", quantity: 1, is_random: false, notes: "" };

export default function BundleModal({ bundle, creatures, onSave, onClose }) {
  const [form, setForm] = useState({
    name:             bundle?.name             || "",
    slug:             bundle?.slug             || "",
    bundle_type:      bundle?.bundle_type      || "mini_pack",
    description:      bundle?.description      || "",
    price:            bundle?.price            ?? "",
    compare_at_price: bundle?.compare_at_price ?? "",
    badge_text:       bundle?.badge_text       || "",
    image_url:        bundle?.image_url        || "",
    is_active:        bundle?.is_active        ?? true,
    is_featured:      bundle?.is_featured      ?? false,
    stripe_price_id:  bundle?.stripe_price_id  || "",
  });

  const [items, setItems] = useState(
    (bundle?.bundle_items || []).map(i => ({
      creature_id: i.creature_id || "",
      item_type:   i.item_type   || "creature",
      quantity:    i.quantity    || 1,
      is_random:   i.is_random   || false,
      notes:       i.notes       || "",
    }))
  );

  const [newItem, setNewItem] = useState({ ...BLANK_ITEM });
  const [saving,  setSaving]  = useState(false);

  function setField(k, v) {
    setForm(prev => ({
      ...prev,
      [k]: v,
      ...(k === "name" && !bundle?.slug ? { slug: slugify(v) } : {}),
    }));
  }

  function addItem() {
    if (!newItem.creature_id && !newItem.is_random) return;
    setItems(prev => [...prev, { ...newItem }]);
    setNewItem({ ...BLANK_ITEM });
  }

  function removeItem(idx) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  function updateItemQty(idx, delta) {
    setItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
    ));
  }

  // — Margin math —
  const totalCost = items.reduce((sum, item) => {
    const c = creatures.find(cr => cr.id === item.creature_id);
    return sum + (c?.cost_to_print || 0) * (item.quantity || 1);
  }, 0);
  const price      = parseFloat(form.price) || 0;
  const profit     = price - totalCost;
  const margin     = price > 0 ? (profit / price) * 100 : null;
  const marginBad  = margin !== null && margin < 50;

  const suggestMin  = totalCost * 2;
  const suggestRec  = totalCost * 4;
  const suggestPrem = totalCost * 6;

  async function save() {
    if (!form.name.trim()) { alert("Bundle name is required."); return; }
    setSaving(true);
    const supabase = createClient();
    const slug = form.slug.trim() || slugify(form.name);

    const payload = {
      name:             form.name.trim(),
      slug,
      bundle_type:      form.bundle_type,
      description:      form.description.trim() || null,
      price:            parseFloat(form.price) || 0,
      compare_at_price: form.compare_at_price !== "" ? parseFloat(form.compare_at_price) : null,
      badge_text:       form.badge_text.trim()       || null,
      image_url:        form.image_url.trim()        || null,
      is_active:        form.is_active,
      is_featured:      form.is_featured,
      stripe_price_id:  form.stripe_price_id.trim()  || null,
      updated_at:       new Date().toISOString(),
    };

    let bundleId;
    if (bundle?.id) {
      bundleId = bundle.id;
      const { error } = await supabase.from("bundles").update(payload).eq("id", bundleId);
      if (error) { alert("Save failed: " + error.message); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from("bundles").insert(payload).select("id").single();
      if (error) { alert("Create failed: " + error.message); setSaving(false); return; }
      bundleId = data.id;
    }

    // Atomic item replacement: delete then re-insert
    await supabase.from("bundle_items").delete().eq("bundle_id", bundleId);
    if (items.length > 0) {
      const { error: itemErr } = await supabase.from("bundle_items").insert(
        items.map(item => ({
          bundle_id:   bundleId,
          creature_id: item.creature_id || null,
          item_type:   item.item_type,
          quantity:    item.quantity,
          is_random:   item.is_random,
          notes:       item.notes || null,
        }))
      );
      if (itemErr) { alert("Items save failed: " + itemErr.message); }
    }

    onSave();
  }

  return (
    <div
      className="modal-bg open"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-box" style={{ maxWidth: 820 }}>
        <button className="modal-close" onClick={onClose} type="button">×</button>
        <h2 className="modal-title">{bundle ? "Edit Bundle" : "New Bundle"}</h2>

        {/* Core fields */}
        <div className="form-grid" style={{ marginBottom: 20 }}>
          <div>
            <label className="fl">Bundle Name</label>
            <input className="fi" value={form.name} onChange={e => setField("name", e.target.value)} placeholder="e.g. Mini 3-Pack" />
          </div>
          <div>
            <label className="fl">Slug</label>
            <input className="fi" value={form.slug} onChange={e => setField("slug", slugify(e.target.value))} placeholder="auto-generated from name" />
          </div>
          <div>
            <label className="fl">Bundle Type</label>
            <select className="fi" value={form.bundle_type} onChange={e => setField("bundle_type", e.target.value)}>
              <option value="mini_pack">Mini Pack — quantity-based minis</option>
              <option value="hero_bundle">Hero Bundle — flagship + mini add-on</option>
              <option value="mixed">Mixed — fully custom</option>
            </select>
          </div>
          <div>
            <label className="fl">Badge Text (optional)</label>
            <input className="fi" value={form.badge_text} onChange={e => setField("badge_text", e.target.value)} placeholder="e.g. Best Value, Mystery" />
          </div>
          <div>
            <label className="fl">Price ($)</label>
            <input className="fi" type="number" step="0.01" min="0" value={form.price} onChange={e => setField("price", e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <label className="fl">Compare-At ($) — strikethrough on site</label>
            <input className="fi" type="number" step="0.01" min="0" value={form.compare_at_price} onChange={e => setField("compare_at_price", e.target.value)} placeholder="optional" />
          </div>
          <div className="form-full">
            <label className="fl">Description</label>
            <textarea className="fi" rows={2} value={form.description} onChange={e => setField("description", e.target.value)} placeholder="Short description shown on the site" style={{ resize: "vertical" }} />
          </div>
          <div>
            <label className="fl">Image URL</label>
            <input className="fi" value={form.image_url} onChange={e => setField("image_url", e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <label className="fl">Stripe Price ID</label>
            <input className="fi" value={form.stripe_price_id} onChange={e => setField("stripe_price_id", e.target.value)} placeholder="price_…" />
            <div style={{ fontSize: 10, fontFamily: "sans-serif", marginTop: 5, color: form.stripe_price_id ? "#7dc994" : "var(--dim)" }}>
              {form.stripe_price_id ? "◉  Connected to Stripe" : "◯  Not connected — wire up after Stripe account is live"}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label className="fl">Visibility</label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontFamily: "sans-serif", color: "var(--cream-dim)", paddingTop: 4 }}>
              <input type="checkbox" checked={form.is_active} onChange={e => setField("is_active", e.target.checked)} style={{ accentColor: "var(--gold)", width: 14, height: 14 }} />
              Active (visible on site)
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontFamily: "sans-serif", color: "var(--cream-dim)" }}>
              <input type="checkbox" checked={form.is_featured} onChange={e => setField("is_featured", e.target.checked)} style={{ accentColor: "var(--gold)", width: 14, height: 14 }} />
              Featured (shown in spotlight)
            </label>
          </div>
        </div>

        {/* Margin + Pricing side by side */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>

          {/* Margin calculator */}
          <div style={{
            border: `1px solid ${marginBad ? "rgba(232,112,112,0.35)" : "var(--gold-border)"}`,
            padding: "14px 16px",
            background: marginBad ? "rgba(232,112,112,0.04)" : "rgba(201,168,76,0.02)",
          }}>
            <div style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(201,168,76,0.55)", fontFamily: "sans-serif", marginBottom: 12 }}>
              Margin Calculator
            </div>
            {[
              { label: "Item cost",    val: `$${totalCost.toFixed(2)}`,                      color: "var(--cream-dim)" },
              { label: "Bundle price", val: price > 0 ? `$${price.toFixed(2)}` : "—",        color: "var(--goldl)" },
              { label: "Gross profit", val: price > 0 ? `$${profit.toFixed(2)}` : "—",       color: price > 0 ? (profit >= 0 ? "#7dc994" : "#e87070") : "var(--dim)" },
              { label: "Margin",       val: margin !== null ? `${margin.toFixed(1)}%` : "—", color: marginBad ? "#e87070" : "#7dc994" },
            ].map(r => (
              <div key={r.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: "sans-serif", paddingBottom: 7 }}>
                <span style={{ color: "var(--dim)" }}>{r.label}</span>
                <span style={{ color: r.color, fontWeight: r.label === "Margin" ? "bold" : "normal" }}>{r.val}</span>
              </div>
            ))}
            {marginBad && (
              <div style={{ fontSize: 11, color: "#e87070", fontFamily: "sans-serif", borderTop: "1px solid rgba(232,112,112,0.2)", paddingTop: 8, marginTop: 4 }}>
                ⚠ Margin below 50% — consider raising the price.
              </div>
            )}
          </div>

          {/* Pricing suggestions */}
          <div style={{ border: "1px solid var(--gold-border)", padding: "14px 16px", background: "rgba(201,168,76,0.02)" }}>
            <div style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(201,168,76,0.55)", fontFamily: "sans-serif", marginBottom: 12 }}>
              Pricing Suggestions
            </div>
            {totalCost === 0 ? (
              <div style={{ fontSize: 12, color: "var(--dim)", fontFamily: "sans-serif" }}>Add items with known costs to see suggestions.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {[
                  { label: "Minimum (2×)",      val: suggestMin,  sub: "Cost recovery" },
                  { label: "Recommended (4×)",  val: suggestRec,  sub: "Target margin" },
                  { label: "Premium (6×)",      val: suggestPrem, sub: "High-value" },
                ].map(s => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => setField("price", s.val.toFixed(2))}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "1px solid var(--gold-border)", borderRadius: 3, padding: "7px 10px", cursor: "pointer", textAlign: "left" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(201,168,76,0.06)"}
                    onMouseLeave={e => e.currentTarget.style.background = "none"}
                  >
                    <div>
                      <div style={{ fontSize: 11, color: "var(--dim)", fontFamily: "sans-serif" }}>{s.label}</div>
                      <div style={{ fontSize: 9, color: "rgba(196,188,178,0.35)", fontFamily: "sans-serif" }}>{s.sub}</div>
                    </div>
                    <span style={{ fontSize: 15, color: "var(--goldl)", fontFamily: "sans-serif" }}>${s.val.toFixed(2)}</span>
                  </button>
                ))}
                <div style={{ fontSize: 9, color: "var(--dim)", fontFamily: "sans-serif", textAlign: "right" }}>click to apply →</div>
              </div>
            )}
          </div>
        </div>

        {/* Bundle items */}
        <div className="sec-hdr" style={{ marginBottom: 12 }}>
          <span className="sec-title">Bundle Items</span>
          <span style={{ fontSize: 11, color: "var(--dim)", fontFamily: "sans-serif" }}>
            {items.length} {items.length === 1 ? "item" : "items"}
            {totalCost > 0 && ` · $${totalCost.toFixed(2)} total cost`}
          </span>
        </div>

        {items.length === 0 && (
          <div style={{ fontSize: 12, color: "var(--dim)", fontFamily: "sans-serif", paddingBottom: 14 }}>
            No items yet. Use the form below to add creatures to this bundle.
          </div>
        )}

        {/* Item list */}
        {items.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {items.map((item, idx) => {
              const creature = creatures.find(c => c.id === item.creature_id);
              const lineCost = (creature?.cost_to_print || 0) * item.quantity;
              return (
                <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center", padding: "9px 0", borderBottom: "1px solid rgba(201,168,76,0.06)", flexWrap: "wrap" }}>
                  <span style={{ flex: "1 1 160px", fontSize: 13, fontFamily: "sans-serif", color: item.is_random ? "var(--teal)" : "var(--cream-dim)" }}>
                    {item.is_random ? "Random pick" : (creature?.name || "Unknown")}
                    {creature?.is_mini && <span style={{ marginLeft: 5, fontSize: 10, color: "var(--teal)" }}>(mini)</span>}
                  </span>
                  <span className="badge badge-dim" style={{ fontSize: 9, flexShrink: 0 }}>
                    {ITEM_TYPE_LABELS[item.item_type]}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <button type="button" className="btn sm" style={{ padding: "2px 8px", minWidth: 28 }} onClick={() => updateItemQty(idx, -1)}>−</button>
                    <span style={{ minWidth: 22, textAlign: "center", fontSize: 13, fontFamily: "sans-serif", color: "var(--cream)" }}>{item.quantity}</span>
                    <button type="button" className="btn sm" style={{ padding: "2px 8px", minWidth: 28 }} onClick={() => updateItemQty(idx, 1)}>+</button>
                  </div>
                  {lineCost > 0 && (
                    <span style={{ fontSize: 11, color: "var(--dim)", fontFamily: "sans-serif", minWidth: 44, textAlign: "right" }}>
                      ${lineCost.toFixed(2)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    style={{ background: "none", border: "none", color: "#e87070", cursor: "pointer", fontSize: 18, padding: "0 4px", lineHeight: 1 }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Add item row */}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", padding: "12px 14px", border: "1px dashed rgba(201,168,76,0.2)", background: "rgba(201,168,76,0.015)", marginBottom: 24 }}>
          <div style={{ flex: "2 1 150px" }}>
            <label className="fl">Creature</label>
            <select
              className="fi"
              style={{ padding: "7px 32px 7px 10px" }}
              value={newItem.creature_id}
              onChange={e => setNewItem(prev => ({ ...prev, creature_id: e.target.value }))}
              disabled={newItem.is_random}
            >
              <option value="">— select —</option>
              <optgroup label="Standard">
                {creatures.filter(c => !c.is_mini).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </optgroup>
              {creatures.some(c => c.is_mini) && (
                <optgroup label="Minis">
                  {creatures.filter(c => c.is_mini).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <div style={{ flex: "1 1 110px" }}>
            <label className="fl">Item Type</label>
            <select className="fi" style={{ padding: "7px 32px 7px 10px" }} value={newItem.item_type} onChange={e => setNewItem(prev => ({ ...prev, item_type: e.target.value }))}>
              <option value="creature">Creature</option>
              <option value="mini">Mini</option>
              <option value="keychain">Keychain</option>
              <option value="random_mini">Random Mini</option>
            </select>
          </div>
          <div style={{ flex: "0 0 64px" }}>
            <label className="fl">Qty</label>
            <input
              className="fi"
              type="number"
              min="1"
              value={newItem.quantity}
              style={{ padding: "9px 8px" }}
              onChange={e => setNewItem(prev => ({ ...prev, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
            />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, fontFamily: "sans-serif", color: "var(--dim)", whiteSpace: "nowrap", paddingBottom: 10 }}>
            <input
              type="checkbox"
              checked={newItem.is_random}
              style={{ accentColor: "var(--gold)" }}
              onChange={e => setNewItem(prev => ({ ...prev, is_random: e.target.checked, creature_id: e.target.checked ? "" : prev.creature_id }))}
            />
            Random
          </label>
          <button type="button" className="btn sm gold" onClick={addItem} style={{ alignSelf: "flex-end", marginBottom: 1 }}>
            + Add
          </button>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn gold" onClick={save} disabled={saving} type="button">
            {saving ? "Saving…" : bundle ? "Save Changes" : "Create Bundle"}
          </button>
          <button className="btn" onClick={onClose} type="button">Cancel</button>
        </div>
      </div>
    </div>
  );
}
