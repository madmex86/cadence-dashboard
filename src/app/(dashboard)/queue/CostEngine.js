"use client";

import { useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import styles from "./queue.module.css";

const DEFAULT = {
  creatureId: "",
  batch: 4,
  printHours: 8,
  printerKw: 0.4,
  recipe: [{ label: "Body", filId: "", model: 30, purged: 5, tower: 3 }],
  packaging: 0.75,
  kwhRate: 0.18,
  laborRate: 0,
  maintRate: 0.50,
  solarOn: false,
};

export default function CostEngine({ creatures, inventory = [], globalSettings = { kwh_rate: 0.18, labor_rate: 0, maintenance_fee: 0.50 }, onSaved }) {
  const [f, setF] = useState({
    ...DEFAULT,
    kwhRate: globalSettings.kwh_rate,
    laborRate: globalSettings.labor_rate,
    maintRate: globalSettings.maintenance_fee,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function set(field, value) {
    setF(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  function setRecipe(idx, field, value) {
    setF(prev => {
      const arr = [...prev.recipe];
      arr[idx] = { ...arr[idx], [field]: value };
      return { ...prev, recipe: arr };
    });
    setSaved(false);
  }
  
  function addRecipeRow() {
    setF(prev => ({ ...prev, recipe: [...prev.recipe, { label: "Part", filId: "", model: 0, purged: 0, tower: 0 }] }));
    setSaved(false);
  }
  
  function removeRecipeRow(idx) {
    setF(prev => ({ ...prev, recipe: prev.recipe.filter((_, i) => i !== idx) }));
    setSaved(false);
  }

  function handleSelectCreature(e) {
    const id = e.target.value;
    const c = creatures.find(x => x.id === id);
    if (c && c.print_recipe) {
      let r = c.print_recipe;
      if (typeof r === "string") {
         try { r = JSON.parse(r); } catch(err){}
         if (typeof r === "string") {
            try { r = JSON.parse(r); } catch(err){}
         }
      }
      
      // Migrate old format (modelGrams, purgeGrams) to new recipe array format
      let loadedRecipe = r.recipe;
      if (!loadedRecipe || !Array.isArray(loadedRecipe)) {
        loadedRecipe = [{
          label: "Body",
          filId: r.filId || "",
          model: r.modelGrams || 0,
          purged: r.purgeGrams || 0,
          tower: r.towerGrams || 0,
        }];
      } else {
        // Ensure legacy rows have filId
        loadedRecipe = loadedRecipe.map(row => ({
          label: row.label || "Part",
          filId: row.filId || "",
          model: row.model || 0,
          purged: row.purged || 0,
          tower: row.tower || 0,
        }));
      }

      setF({
        creatureId: id,
        batch: r.batch ?? DEFAULT.batch,
        printHours: r.printHours ?? DEFAULT.printHours,
        printerKw: r.printerKw ?? DEFAULT.printerKw,
        recipe: loadedRecipe,
        packaging: r.pkg ?? DEFAULT.packaging,
        kwhRate: r.kwhRate ?? globalSettings.kwh_rate,
        laborRate: r.laborRate ?? globalSettings.labor_rate,
        maintRate: r.maintRate ?? globalSettings.maintenance_fee,
        solarOn: r.solarOn ?? DEFAULT.solarOn,
      });
    } else {
      setF({ 
        ...DEFAULT, 
        creatureId: id,
        kwhRate: globalSettings.kwh_rate,
        laborRate: globalSettings.labor_rate,
        maintRate: globalSettings.maintenance_fee,
      });
    }
    setSaved(false);
  }

  const creature = creatures.find(c => c.id === f.creatureId);

  const totalGrams = f.recipe.reduce((acc, r) => acc + (parseFloat(r.model||0) + parseFloat(r.purged||0) + parseFloat(r.tower||0)), 0);

  // Calculate filament cost based on selected spools in the recipe
  const batchSize = Math.max(1, parseFloat(f.batch));
  
  let totalFilCostForPlate = 0;
  f.recipe.forEach(r => {
    const rowGrams = (parseFloat(r.model||0) + parseFloat(r.purged||0) + parseFloat(r.tower||0));
    const invSpool = inventory.find(i => i.id === r.filId);
    const spoolCost = invSpool ? parseFloat(invSpool.cost_per_spool || 25) : 25;
    const costPerGram = spoolCost / 1000;
    totalFilCostForPlate += (rowGrams * costPerGram);
  });
  
  // Apply a 5% buffer for failures to filament cost
  const filPerUnit = (totalFilCostForPlate * 1.05) / batchSize;

  const hours = parseFloat(f.printHours);
  const kwhRate = f.solarOn ? 0 : parseFloat(f.kwhRate);
  const powerPerUnit = (parseFloat(f.printerKw) * hours * kwhRate) / batchSize;
  const laborPerUnit = (hours * parseFloat(f.laborRate)) / batchSize;
  const maintPerUnit = (hours * parseFloat(f.maintRate)) / batchSize;

  const totalCogs = filPerUnit + parseFloat(f.packaging) + powerPerUnit + laborPerUnit + maintPerUnit;

  const etsyPrice = creature?.price_etsy || 0;
  const etsyFee = etsyPrice * 0.065;
  const netMargin = etsyPrice > 0
    ? ((etsyPrice - totalCogs - etsyFee) / etsyPrice * 100)
    : 0;

  const suggestedRetail = totalCogs * 3;
  const suggestedEtsy = suggestedRetail * 1.10;

  async function saveRecipe() {
    if (!f.creatureId) return;
    setSaving(true);
    const supabase = createClient();
    
    const recipeToSave = f.recipe.map(r => {
      const spool = inventory.find(i => i.id === r.filId);
      const name = spool ? `${spool.spool_name}${spool.color ? ` - ${spool.color}` : ''}` : "";
      return {
        label: r.label,
        filId: r.filId,
        filName: name,
        model: parseFloat(r.model) || 0,
        purged: parseFloat(r.purged) || 0,
        tower: parseFloat(r.tower) || 0,
      };
    });

    const recipe = {
      batch: parseInt(f.batch),
      pkg: parseFloat(f.packaging),
      printHours: parseFloat(f.printHours),
      printerKw: parseFloat(f.printerKw),
      solarOn: f.solarOn,
      recipe: recipeToSave,
      // Keep old fields for backward compatibility if needed by other components momentarily
      modelGrams: recipeToSave.reduce((acc, r) => acc + r.model, 0),
      purgeGrams: recipeToSave.reduce((acc, r) => acc + r.purged, 0),
      towerGrams: recipeToSave.reduce((acc, r) => acc + r.tower, 0),
      kwhRate: parseFloat(f.kwhRate),
      laborRate: parseFloat(f.laborRate),
      maintRate: parseFloat(f.maintRate),
    };
    
    await supabase.from("creatures").update({
      cost_to_print: parseFloat(totalCogs.toFixed(4)),
      print_recipe: recipe,
      price_retail: parseFloat(suggestedRetail.toFixed(2)),
      price_etsy: parseFloat(suggestedEtsy.toFixed(2)),
    }).eq("id", f.creatureId);

    // Save rates to settings table if user changed them and has permissions
    try {
      await supabase.from("settings").upsert([
        { key: "kwh_rate", value: String(f.kwhRate) },
        { key: "labor_rate", value: String(f.laborRate) },
        { key: "maintenance_fee", value: String(f.maintRate) }
      ], { onConflict: "key" });
    } catch(err) {
      console.warn("Failed to update global settings, may not be an admin", err);
    }

    setSaving(false);
    setSaved(true);
    onSaved?.();
  }

  return (
    <div className={styles.costEngine}>
      <div className={styles.ceGrid}>
        <div className={styles.ceInputs}>
          <div className={styles.ceSec}>Creature & Batch</div>

          <div className={styles.ceRow}>
            <label className="fl">Creature</label>
            <select className="fi" value={f.creatureId} onChange={handleSelectCreature}>
              <option value="">Select creature…</option>
              {creatures.map(c => (
                <option key={c.id} value={c.id}>
                  #{String(c.log_number || "—").padStart(3, "0")} {c.name} ({c.sku})
                </option>
              ))}
            </select>
          </div>

          <div className={styles.ceRow}>
            <label className="fl">Batch Size (per plate)</label>
            <input className="fi" type="number" min="1" value={f.batch} onChange={e => set("batch", e.target.value)} />
          </div>

          <div className={styles.ceSec}>Print Job</div>

          <div className={styles.ceRow}>
            <label className="fl">Print Time (hours)</label>
            <input className="fi" type="number" step="0.5" min="0" value={f.printHours} onChange={e => set("printHours", e.target.value)} />
          </div>
          <div className={styles.ceRow}>
            <label className="fl">Printer Power (kW)</label>
            <input className="fi" type="number" step="0.05" min="0" value={f.printerKw} onChange={e => set("printerKw", e.target.value)} />
          </div>

          <div className={styles.ceSec}>Filament (per plate)</div>

          {f.recipe.map((r, i) => {
            const selectedSpool = inventory.find(s => s.id === r.filId);
            const color = selectedSpool?.hex_color || selectedSpool?.color || "transparent";
            return (
              <div key={i} style={{ marginBottom: 16, padding: "12px", background: "rgba(0,0,0,0.1)", borderRadius: 4, border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: "10px" }}>
                  <input className="fi" style={{ width: 140 }} placeholder="Part label" value={r.label} onChange={e => setRecipe(i, "label", e.target.value)} />
                  
                  <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center" }}>
                    <div style={{
                      width: 14, height: 14, borderRadius: "50%",
                      backgroundColor: color,
                      border: "1px solid rgba(255,255,255,0.2)",
                      position: "absolute", left: 10,
                      zIndex: 1, pointerEvents: "none"
                    }} />
                    <select className="fi" style={{ width: "100%", paddingLeft: 32 }} value={r.filId} onChange={e => setRecipe(i, "filId", e.target.value)}>
                      <option value="">Select spool…</option>
                      {inventory.map(spool => (
                        <option key={spool.id} value={spool.id}>
                          {spool.spool_name}{spool.color ? ` - ${spool.color}` : ""} (${spool.cost_per_spool || 25})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {f.recipe.length > 1 && (
                    <button type="button" onClick={() => removeRecipeRow(i)} style={{ background: "transparent", border: "none", color: "var(--dim)", cursor: "pointer", fontSize: 16, flexShrink: 0 }}>×</button>
                  )}
                </div>
                <div className={styles.inlineRow}>
                  <div>
                    <label className="fl">Model (g)</label>
                    <input className="fi" type="number" step="0.1" min="0" value={r.model} onChange={e => setRecipe(i, "model", e.target.value)} />
                  </div>
                  <div>
                    <label className="fl">Purge (g)</label>
                    <input className="fi" type="number" step="0.1" min="0" value={r.purged} onChange={e => setRecipe(i, "purged", e.target.value)} />
                  </div>
                  <div>
                    <label className="fl">Tower (g)</label>
                    <input className="fi" type="number" step="0.1" min="0" value={r.tower} onChange={e => setRecipe(i, "tower", e.target.value)} />
                  </div>
                </div>
              </div>
            );
          })}
          
          <button type="button" onClick={addRecipeRow} className="btn sm" style={{ marginBottom: 20 }}>+ Add Filament</button>

          <div className={styles.ceSec}>Rates</div>

          <div className={styles.inlineRow}>
            <div>
              <label className="fl">$/kWh</label>
              <input className="fi" type="number" step="0.01" min="0" value={f.kwhRate} onChange={e => set("kwhRate", e.target.value)} />
            </div>
            <div>
              <label className="fl">Labor $/hr</label>
              <input className="fi" type="number" step="0.50" min="0" value={f.laborRate} onChange={e => set("laborRate", e.target.value)} />
            </div>
            <div>
              <label className="fl">Maint $/hr</label>
              <input className="fi" type="number" step="0.10" min="0" value={f.maintRate} onChange={e => set("maintRate", e.target.value)} />
            </div>
          </div>

          <div className={styles.ceRow}>
            <label className="fl">Packaging ($ per unit)</label>
            <input className="fi" type="number" step="0.05" min="0" value={f.packaging} onChange={e => set("packaging", e.target.value)} />
          </div>

          <label className={styles.solarRow}>
            <input type="checkbox" checked={f.solarOn} onChange={e => set("solarOn", e.target.checked)} />
            <span>Solar / Powerwall (zero power cost)</span>
          </label>
        </div>

        <div className={styles.ceResults}>
          <div className={styles.ceSec}>Cost Breakdown</div>
          <div className={styles.breakdown}>
            <BreakdownRow label="Filament / unit" value={filPerUnit} />
            <BreakdownRow label="Packaging" value={parseFloat(f.packaging)} />
            <BreakdownRow label="Power / unit" value={powerPerUnit} note={f.solarOn ? "solar" : ""} />
            <BreakdownRow label="Labor / unit" value={laborPerUnit} />
            <BreakdownRow label="Maintenance" value={maintPerUnit} />
            <div className={styles.breakdownTotal}>
              <span>Total COGS / unit</span>
              <span>${totalCogs.toFixed(3)}</span>
            </div>
          </div>

          <div className={styles.ceSec} style={{ marginTop: 20 }}>Suggested Pricing</div>
          <div className={styles.pricing}>
            <div className={styles.priceRow}>
              <span>Retail (3× COGS)</span>
              <span className={styles.priceVal}>${suggestedRetail.toFixed(2)}</span>
            </div>
            <div className={styles.priceRow}>
              <span>Etsy (retail ×1.10)</span>
              <span className={styles.priceVal}>${suggestedEtsy.toFixed(2)}</span>
            </div>
            {etsyPrice > 0 && (
              <div className={styles.priceRow}>
                <span>Current Etsy price</span>
                <span>${parseFloat(etsyPrice).toFixed(2)}</span>
              </div>
            )}
            {etsyPrice > 0 && (
              <div className={styles.priceRow}>
                <span>Net margin at current price</span>
                <span className={netMargin < 20 ? styles.marginLow : styles.marginOk}>
                  {netMargin.toFixed(1)}%
                </span>
              </div>
            )}
          </div>

          <button
            className={`btn gold ${styles.saveBtn}`}
            onClick={saveRecipe}
            disabled={!f.creatureId || saving}
          >
            {saving ? "Saving…" : saved ? "✓ Saved to Creature" : "Save Recipe & COGS"}
          </button>
          {!f.creatureId && (
            <p style={{ fontSize: 11, color: "var(--dim)", marginTop: 6, fontFamily: "sans-serif" }}>
              Select a creature above to save
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function BreakdownRow({ label, value, note }) {
  return (
    <div className={styles.breakdownRow}>
      <span>{label}{note ? <em style={{ marginLeft: 4, opacity: 0.5, fontSize: 10 }}>{note}</em> : null}</span>
      <span>${value.toFixed(3)}</span>
    </div>
  );
}
