"use client";

import { useState, useEffect } from "react";
import { createClient } from "../../../lib/supabase/client";
import styles from "./creatures.module.css";

const BLANK = {
  name: "", species: "", sku: "", log_number: "", environment: "forest",
  price_retail: "", price_etsy: "", qty_on_hand: 0, cost_to_print: "",
  tagline: "", etsy_url: "", image_url: "", model_url: "", notes: "",
  lore_location: "", lore_entry_date: "", lore_story: ["", "", ""], lore_observations: "",
  active: true, is_featured: false, in_launch_queue: false, is_cami_edition: false,
  is_revealed: true, reveal_date: "", print_recipe: null, filament_color: "",
};

const DEFAULT_TAGLINES = {
  forest: "Found wandering the forest floor.",
  ocean: "Washed ashore from the deep.",
  fantasy: "A magical companion from another realm.",
  holiday: "A festive friend for the season.",
  space: "Fell from the stars above."
};

export default function CreatureModal({ creature, onClose, onSave }) {
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState("info");

  useEffect(() => {
    if (creature) {
      const sanitized = {};
      for (const key in BLANK) {
        sanitized[key] = creature[key] ?? BLANK[key];
      }
      
      setForm({
        ...sanitized,
        lore_story: Array.isArray(creature.lore_story)
          ? [...creature.lore_story, "", "", ""].slice(0, 3)
          : ["", "", ""],
        // datetime-local needs "YYYY-MM-DDTHH:MM" — trim timezone/seconds from Supabase timestamp
        reveal_date: sanitized.reveal_date ? sanitized.reveal_date.slice(0, 16) : "",
      });
    } else {
      setForm(BLANK);
    }
    setTab("info");
  }, [creature]);

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function setStory(i, value) {
    setForm(prev => {
      const s = [...prev.lore_story];
      s[i] = value;
      return { ...prev, lore_story: s };
    });
  }

  async function uploadImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `creature_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("creature-images").upload(path, file, { upsert: true });
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("creature-images").getPublicUrl(path);
      set("image_url", publicUrl);
    } else {
      console.error("Upload error:", error);
      alert(`Image upload failed: ${error.message}`);
    }
    setUploading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      log_number: form.log_number ? parseInt(form.log_number) : null,
      price_retail: form.price_retail ? parseFloat(form.price_retail) : null,
      price_etsy: form.price_etsy ? parseFloat(form.price_etsy) : null,
      cost_to_print: form.cost_to_print ? parseFloat(form.cost_to_print) : null,
      qty_on_hand: parseInt(form.qty_on_hand) || 0,
      lore_story: form.lore_story.filter(Boolean),
      lore_observations: form.lore_observations || null,
      reveal_date: form.reveal_date || null,
    };
    delete payload.id;
    await onSave(payload, creature?.id);
    setSaving(false);
  }

  const TABS = ["info", "pricing", "lore", "flags"];

  return (
    <div className="modal-bg open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 700 }}>
        <button className="modal-close" onClick={onClose} type="button">×</button>
        <h2 className="modal-title">{creature ? `Edit — ${creature.name}` : "New Creature"}</h2>

        <div className={styles.tabs}>
          {TABS.map(t => (
            <button
              key={t}
              type="button"
              className={`${styles.tab} ${tab === t ? styles.tabActive : ""}`}
              onClick={() => setTab(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {tab === "info" && (
            <div className="form-grid">
              <div>
                <label className="fl">Name *</label>
                <input className="fi" required value={form.name} onChange={e => set("name", e.target.value)} />
              </div>
              <div>
                <label className="fl">Species</label>
                <input className="fi" value={form.species} onChange={e => set("species", e.target.value)} />
              </div>
              <div>
                <label className="fl">SKU</label>
                <input className="fi" maxLength={11} value={form.sku} onChange={e => set("sku", e.target.value)} />
              </div>
              <div>
                <label className="fl">Log #</label>
                <input className="fi" type="number" value={form.log_number} onChange={e => set("log_number", e.target.value)} />
              </div>
              <div>
                <label className="fl">Environment</label>
                <select className="fi" value={form.environment} onChange={e => {
                  const val = e.target.value;
                  setForm(prev => {
                    const next = { ...prev, environment: val };
                    if (!next.tagline || Object.values(DEFAULT_TAGLINES).includes(next.tagline)) {
                      next.tagline = DEFAULT_TAGLINES[val] || "";
                    }
                    return next;
                  });
                }}>
                  <option value="forest">Forest</option>
                  <option value="ocean">Ocean</option>
                  <option value="fantasy">Fantasy</option>
                  <option value="holiday">Holiday</option>
                  <option value="space">Space</option>
                </select>
              </div>
              <div>
                <label className="fl">Stock On Hand</label>
                <input className="fi" type="number" min="0" value={form.qty_on_hand} onChange={e => set("qty_on_hand", e.target.value)} />
              </div>
              <div className="form-full">
                <label className="fl">Tagline</label>
                <input className="fi" value={form.tagline} onChange={e => set("tagline", e.target.value)} />
              </div>
              <div className="form-full">
                <label className="fl">Etsy Listing URL</label>
                <input className="fi" type="url" value={form.etsy_url} onChange={e => set("etsy_url", e.target.value)} />
              </div>
              <div className="form-full">
                <label className="fl">Image URL</label>
                <input className="fi" value={form.image_url} onChange={e => set("image_url", e.target.value)} />
                <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                  <label className={styles.uploadBtn}>
                    {uploading ? "Uploading…" : "Upload Image"}
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={uploadImage} disabled={uploading} />
                  </label>
                  {form.image_url && <img src={form.image_url} alt="" style={{ height: 48, width: 48, objectFit: "cover", borderRadius: 3 }} />}
                </div>
              </div>
              <div className="form-full">
                <label className="fl">3D Model URL (GLB)</label>
                <input className="fi" value={form.model_url} onChange={e => set("model_url", e.target.value)} />
              </div>
              <div className="form-full">
                <label className="fl">Notes</label>
                <textarea className="fi" rows={3} value={form.notes} onChange={e => set("notes", e.target.value)} style={{ resize: "vertical" }} />
              </div>
            </div>
          )}

          {tab === "pricing" && (
            <div className="form-grid">
              <div>
                <label className="fl">Retail Price ($)</label>
                <input className="fi" type="number" step="0.01" min="0" value={form.price_retail} onChange={e => set("price_retail", e.target.value)} />
              </div>
              <div>
                <label className="fl">Etsy Price ($)</label>
                <input className="fi" type="number" step="0.01" min="0" value={form.price_etsy} onChange={e => set("price_etsy", e.target.value)} />
              </div>
              <div>
                <label className="fl">Cost to Print ($)</label>
                <input className="fi" type="number" step="0.01" min="0" value={form.cost_to_print || ""} onChange={e => set("cost_to_print", e.target.value)} />
              </div>
              <div className="form-full">
                <label className="fl">Print Recipe (from Queue)</label>
                {(() => {
                  let recipeData = null;
                  if (form.print_recipe) {
                    try {
                      recipeData = typeof form.print_recipe === "string" ? JSON.parse(form.print_recipe) : form.print_recipe;
                      if (typeof recipeData === "string") recipeData = JSON.parse(recipeData);
                    } catch(e){}
                  }
                  
                  if (!recipeData) {
                    return (
                      <div style={{ padding: 12, background: "rgba(0,0,0,0.2)", borderRadius: 4, fontSize: 12, color: "var(--dim)", border: "1px solid rgba(255,255,255,0.05)" }}>
                        No recipe data saved. Run Cost Engine to generate.
                      </div>
                    );
                  }

                  return (
                    <div style={{ background: "rgba(0,0,0,0.2)", padding: 12, borderRadius: 4, fontSize: 13, border: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", marginBottom: 12 }}>
                        <div><span style={{ color: "var(--dim)" }}>Batch Size:</span> <span style={{ color: "var(--goldl)" }}>{recipeData.batch}</span></div>
                        <div><span style={{ color: "var(--dim)" }}>Packaging:</span> <span style={{ color: "var(--goldl)" }}>${recipeData.pkg}</span></div>
                        <div><span style={{ color: "var(--dim)" }}>Print Time:</span> <span style={{ color: "var(--goldl)" }}>{recipeData.printHours} hrs</span></div>
                        <div><span style={{ color: "var(--dim)" }}>Solar Offset:</span> <span style={{ color: "var(--goldl)" }}>{recipeData.solarOn ? "Yes" : "No"}</span></div>
                      </div>
                      
                      {recipeData.recipe && recipeData.recipe.length > 0 && (
                        <div style={{ borderTop: "1px dashed rgba(255,255,255,0.1)", paddingTop: 12 }}>
                          <strong style={{ color: "var(--dim)", fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase" }}>Filament Usage</strong>
                          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                            {recipeData.recipe.map((r, i) => {
                              const totalGrams = (parseFloat(r.model||0) + parseFloat(r.purged||0) + parseFloat(r.tower||0)).toFixed(1);
                              return (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", color: "var(--cream)" }}>
                                  <div>
                                    <span>{r.label || "Part"}</span>
                                    {r.filName && <div style={{ fontSize: 10, color: "var(--dim)", marginTop: 2 }}>{r.filName}</div>}
                                  </div>
                                  <div style={{ textAlign: "right" }}>
                                    <span>{totalGrams}g</span>
                                    <div style={{ color: "var(--dim)", fontSize: 10, marginTop: 2 }}>(Model + Purge)</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
                <p style={{ fontSize: 11, color: "rgba(196,188,178,0.5)", marginTop: 6 }}>Set automatically by the Queue / Cost Engine.</p>
              </div>
            </div>
          )}

          {tab === "lore" && (
            <div className="form-grid">
              <div>
                <label className="fl">Discovery Location</label>
                <input className="fi" value={form.lore_location} onChange={e => set("lore_location", e.target.value)} />
              </div>
              <div>
                <label className="fl">Entry Date</label>
                <input className="fi" value={form.lore_entry_date} onChange={e => set("lore_entry_date", e.target.value)} />
              </div>
              {[0, 1, 2].map(i => (
                <div className="form-full" key={i}>
                  <label className="fl">Story Paragraph {i + 1}</label>
                  <textarea className="fi" rows={3} value={form.lore_story[i] || ""} onChange={e => setStory(i, e.target.value)} style={{ resize: "vertical" }} />
                </div>
              ))}
              <div className="form-full">
                <label className="fl">Field Observations</label>
                <textarea className="fi" rows={3} value={form.lore_observations || ""} onChange={e => set("lore_observations", e.target.value)} style={{ resize: "vertical" }} />
              </div>
              {form.name && (
                <div className="form-full" style={{ marginTop: '10px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--cream-faint)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    NFC / Lore URL: 
                    <a href={`https://cadencecreatures.com/logs/creature.html?name=${encodeURIComponent(form.name)}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'monospace', color: 'rgba(201,168,76,.6)', textDecoration: 'none' }}>
                      cadencecreatures.com/logs/creature.html?name={encodeURIComponent(form.name)}
                    </a>
                    <button 
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`https://cadencecreatures.com/logs/creature.html?name=${encodeURIComponent(form.name)}`);
                        alert("Copied for NFC chip!");
                      }} 
                      style={{ fontSize: '9px', letterSpacing: '.1em', textTransform: 'uppercase', background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.2)', color: 'var(--gold)', padding: '3px 8px', cursor: 'pointer', borderRadius: '2px' }} 
                      title="Copy for NFC chip"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "flags" && (
            <div className={styles.flags}>
              {[
                { field: "active", label: "Active", desc: "Visible on the public site" },
                { field: "is_featured", label: "Featured", desc: "Highlighted in the bestiary" },
                { field: "in_launch_queue", label: "In Launch Queue", desc: "Part of the next drop" },
                { field: "is_cami_edition", label: "Cami Edition", desc: "Rainbow / Cami's Secret Garden exclusive" },
                { field: "is_revealed", label: "Revealed", desc: "Publicly revealed (uncheck for teaser mode)" },
              ].map(({ field, label, desc }) => (
                <label key={field} className={styles.flagRow}>
                  <input
                    type="checkbox"
                    className={styles.flagCheck}
                    checked={!!form[field]}
                    onChange={e => set(field, e.target.checked)}
                  />
                  <div>
                    <div className={styles.flagLabel}>{label}</div>
                    <div className={styles.flagDesc}>{desc}</div>
                  </div>
                </label>
              ))}
              <div style={{ marginTop: 16 }}>
                <label className="fl">Reveal Date</label>
                <input className="fi" type="datetime-local" value={form.reveal_date || ""} onChange={e => set("reveal_date", e.target.value)} style={{ maxWidth: 260 }} />
              </div>
            </div>
          )}

          <div className={styles.modalFooter}>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn gold" disabled={saving}>
              {saving ? "Saving…" : creature ? "Save Changes" : "Create Creature"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
