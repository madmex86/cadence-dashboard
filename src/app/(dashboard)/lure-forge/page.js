"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "../../../lib/supabase/client";
import styles from "./lure.module.css";

export default function LureForgePage() {
  const [creatures, setCreatures] = useState([]);
  const [selectedCreatureId, setSelectedCreatureId] = useState("");
  
  // Seed inputs
  const [seedName, setSeedName] = useState("");
  const [seedSpecies, setSeedSpecies] = useState("");
  const [seedLocation, setSeedLocation] = useState("");
  const [seedColors, setSeedColors] = useState("");
  const [seedSensory, setSeedSensory] = useState("");
  const [seedEncounter, setSeedEncounter] = useState("");
  const [seedNotes, setSeedNotes] = useState("");

  // Output fields
  const [outLocation, setOutLocation] = useState("");
  const [outDate, setOutDate] = useState("");
  const [outP1, setOutP1] = useState("");
  const [outP2, setOutP2] = useState("");
  const [outP3, setOutP3] = useState("");
  const [outObs, setOutObs] = useState("");

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [aiStatus, setAiStatus] = useState("");
  const [aiStatusType, setAiStatusType] = useState(""); // "", "ok", "err"
  
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [saveStatusType, setSaveStatusType] = useState("");
  
  const isOutputBlank = !outLocation && !outP1 && !outObs;

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("creatures")
      .select("id, name, species, lore_location, lore_entry_date, lore_story, lore_observations")
      .order("name");
    setCreatures(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleCreaturePick(id) {
    setSelectedCreatureId(id);
    if (!id) {
      setSeedName("");
      setSeedSpecies("");
      clearOutput();
      return;
    }

    const c = creatures.find(x => x.id === id);
    if (!c) return;

    setSeedSpecies(c.species || "");
    
    if (c.lore_location || (c.lore_story && c.lore_story.length > 0)) {
      setOutLocation(c.lore_location || "");
      setOutDate(c.lore_entry_date || "");
      const story = Array.isArray(c.lore_story) ? c.lore_story : [];
      setOutP1(story[0] || "");
      setOutP2(story[1] || "");
      setOutP3(story[2] || "");
      const obs = Array.isArray(c.lore_observations) ? c.lore_observations : [];
      setOutObs(obs.join("\n"));
    } else {
      clearOutput();
    }
  }

  function clearOutput() {
    setOutLocation("");
    setOutDate("");
    setOutP1("");
    setOutP2("");
    setOutP3("");
    setOutObs("");
    setSaveStatus("");
  }

  function slugify(name) {
    return (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  function buildPrompt() {
    const name = selectedCreatureId
      ? (creatures.find(c => c.id === selectedCreatureId)?.name || '')
      : seedName.trim();
    
    if (!name) return null;

    return `You are a ghost-writer for Cadence — a young, wonder-filled child explorer who discovers magical creatures in the wild and writes about them in her personal field journal. You must perfectly channel her voice.

CADENCE'S VOICE RULES:
- First-person field journal ("I found it on a warm flat rock…", "When I crouched down…")
- Tone: adventurous, full of childhood wonder, deeply curious, tender, imaginative
- Sensory-first: describe how creatures feel, sound, smell, move — through a child's eyes
- Treat every creature as real and wild, discovered in nature — never a product or toy
- Do not mention 3D printing, manufacturing, or crafting of any kind
- Write naturally, not formally — her sentences can be short and punchy or long and flowing
- Em-dashes (—) are her signature punctuation

CREATURE SEED:
- Name: ${name}
${seedSpecies ? `- Species: ${seedSpecies}` : '- Species: (you choose something whimsical and fitting)'}
${seedLocation ? `- Discovery location: ${seedLocation}` : '- Discovery location: (you hallucinate somewhere magical and specific)'}
${seedColors ? `- Appearance/colors: ${seedColors}` : ''}
${seedSensory ? `- Sensory details: ${seedSensory}` : '- Sensory details: (hallucinate based on the name and species)'}
${seedEncounter ? `- Key encounter: ${seedEncounter}` : '- Key encounter: (hallucinate a magical, tender moment of connection)'}
${seedNotes ? `- Additional notes: ${seedNotes}` : ''}

Any detail left blank must be hallucinated to fit perfectly with the details that were provided.

OUTPUT FORMAT — respond with ONLY valid JSON, no markdown fences, no explanation:
{
  "lore_location": "short poetic location name, like 'Sun Rock, Visalia, CA' or 'The Hollow at Millcreek'",
  "lore_entry_date": "seasonal poetic date, like 'Late Summer, 2025' or 'Early Spring, 2026'",
  "lore_story": [
    "Paragraph 1: the discovery moment — 100 to 140 words, written as Cadence",
    "Paragraph 2: the interaction or encounter — 100 to 140 words, written as Cadence",
    "Paragraph 3: the farewell, reflection, or why it chose its new person — 60 to 90 words, written as Cadence"
  ],
  "lore_observations": [
    "short factual-sounding but whimsical observation — one sentence",
    "another observation",
    "another observation",
    "another observation"
  ]
}`;
  }

  async function runAiFill() {
    const prompt = buildPrompt();
    if (!prompt) {
      alert("Enter a creature name first.");
      return;
    }

    setGenerating(true);
    setAiStatus("Channeling Cadence…");
    setAiStatusType("");

    try {
      const res = await fetch('/api/lure-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.status);

      const raw = data.content?.[0]?.text || '';
      let lore;
      try {
        lore = JSON.parse(raw);
      } catch {
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('Could not parse AI response as JSON');
        lore = JSON.parse(match[0]);
      }

      setOutLocation(lore.lore_location || "");
      setOutDate(lore.lore_entry_date || "");
      const story = Array.isArray(lore.lore_story) ? lore.lore_story : [];
      setOutP1(story[0] || "");
      setOutP2(story[1] || "");
      setOutP3(story[2] || "");
      const obs = Array.isArray(lore.lore_observations) ? lore.lore_observations : [];
      setOutObs(obs.join("\n"));

      setAiStatus("✓ Lore generated");
      setAiStatusType("ok");
    } catch (err) {
      console.error(err);
      setAiStatus("✗ " + err.message);
      setAiStatusType("err");
    } finally {
      setGenerating(false);
    }
  }

  function getOutputLore() {
    const obs = outObs.split('\n').map(s => s.trim()).filter(Boolean);
    const story = [outP1.trim(), outP2.trim(), outP3.trim()].filter(Boolean);
    return {
      lore_location: outLocation.trim(),
      lore_entry_date: outDate.trim(),
      lore_story: story,
      lore_observations: obs,
    };
  }

  async function saveLore() {
    if (!selectedCreatureId) {
      alert("Pick an existing creature to save — new creatures must be created in the inventory first.");
      return;
    }

    setSaving(true);
    setSaveStatus("Saving…");
    setSaveStatusType("");

    const lore = getOutputLore();
    const supabase = createClient();

    const { error } = await supabase.from('creatures').update({
      lore_location: lore.lore_location || null,
      lore_entry_date: lore.lore_entry_date || null,
      lore_story: lore.lore_story.length ? lore.lore_story : null,
      lore_observations: lore.lore_observations.length ? lore.lore_observations : null,
    }).eq('id', selectedCreatureId);

    setSaving(false);

    if (error) {
      setSaveStatus("✗ " + error.message);
      setSaveStatusType("err");
    } else {
      setSaveStatus("✓ Saved to Supabase");
      setSaveStatusType("ok");
      
      // Update local cache
      setCreatures(prev => prev.map(c => 
        c.id === selectedCreatureId 
          ? { ...c, ...lore }
          : c
      ));
    }
  }

  function copyJson() {
    const lore = getOutputLore();
    navigator.clipboard.writeText(JSON.stringify(lore, null, 2))
      .then(() => alert("JSON copied to clipboard!"))
      .catch(() => alert("Failed to copy."));
  }

  if (loading) return <div className="empty-state">Loading forge…</div>;

  return (
    <div>
      <div className="sec-hdr">
        <h1 className={styles.title}>Lure Forge</h1>
      </div>
      <div className={styles.subtitle}>
        Feed it a skeleton — AI writes in Cadence's voice. Every blank becomes part of the story.
      </div>

      <div className={styles.forgeWrap}>
        {/* LEFT: Seed Panel */}
        <div className={styles.forgePanel}>
          <div className={styles.forgePanelTitle}><span>✦</span> Creature Seed</div>

          <div className={styles.field}>
            <label>Creature <em>— pick existing or type a new name</em></label>
            <select value={selectedCreatureId} onChange={e => handleCreaturePick(e.target.value)}>
              <option value="">— New creature —</option>
              {creatures.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.lore_story?.length ? " ✓" : ""}
                </option>
              ))}
            </select>
          </div>

          {!selectedCreatureId && (
            <div className={styles.field}>
              <label>Creature Name</label>
              <input value={seedName} onChange={e => setSeedName(e.target.value)} placeholder="e.g. Ember" />
              {seedName && (
                <div className={styles.slugPreview}>slug: <span>{slugify(seedName)}</span></div>
              )}
            </div>
          )}

          <div className={styles.field}>
            <label>Species <em>— optional</em></label>
            <input value={seedSpecies} onChange={e => setSeedSpecies(e.target.value)} placeholder="e.g. Forest Tortoise" />
          </div>

          <div className={styles.field}>
            <label>Location Hint <em>— leave blank to hallucinate</em></label>
            <input value={seedLocation} onChange={e => setSeedLocation(e.target.value)} placeholder="e.g. near the creek at dusk" />
          </div>

          <div className={styles.field}>
            <label>Appearance / Colors <em>— optional</em></label>
            <input value={seedColors} onChange={e => setSeedColors(e.target.value)} placeholder="e.g. mossy green, amber eyes, rough shell" />
          </div>

          <div className={styles.field}>
            <label>Sensory Details <em>— leave blank to hallucinate</em></label>
            <textarea rows="3" value={seedSensory} onChange={e => setSeedSensory(e.target.value)} placeholder="e.g. cold to the touch, left shiny tracks, sounded like ice cracking when it moved" />
          </div>

          <div className={styles.field}>
            <label>Key Encounter <em>— what happened? leave blank to hallucinate</em></label>
            <textarea rows="3" value={seedEncounter} onChange={e => setSeedEncounter(e.target.value)} placeholder="e.g. it climbed into my hand and wouldn't let go for an hour" />
          </div>

          <div className={styles.field}>
            <label>Extra Notes <em>— anything else</em></label>
            <textarea rows="2" value={seedNotes} onChange={e => setSeedNotes(e.target.value)} placeholder="tone hints, details to include, things to avoid…" />
          </div>
        </div>

        {/* RIGHT: Output Panel */}
        <div className={styles.outputSection}>
          <div className={`${styles.outputOverlay} ${!isOutputBlank ? styles.hidden : ""}`}>
            Generate to fill ↓
          </div>
          
          <div className={styles.forgePanel}>
            <div className={styles.forgePanelTitle}>Field Notes / <span>Lore Page</span></div>

            <div className={styles.forgeWrap} style={{ gap: "14px", marginBottom: "14px" }}>
              <div className={styles.field} style={{ marginBottom: 0 }}>
                <label>Discovery Location</label>
                <input value={outLocation} onChange={e => setOutLocation(e.target.value)} placeholder="Sun Rock, Visalia, CA" />
              </div>
              <div className={styles.field} style={{ marginBottom: 0 }}>
                <label>Entry Date</label>
                <input value={outDate} onChange={e => setOutDate(e.target.value)} placeholder="Early Spring, 2026" />
              </div>
            </div>

            <div className={styles.field}>
              <label>Story — Paragraph 1</label>
              <textarea rows="5" value={outP1} onChange={e => setOutP1(e.target.value)} placeholder="The discovery moment…" />
            </div>

            <div className={styles.field}>
              <label>Paragraph 2</label>
              <textarea rows="5" value={outP2} onChange={e => setOutP2(e.target.value)} placeholder="The encounter…" />
            </div>

            <div className={styles.field}>
              <label>Paragraph 3</label>
              <textarea rows="4" value={outP3} onChange={e => setOutP3(e.target.value)} placeholder="The farewell / why it chose its new owner…" />
            </div>

            <div className={styles.field}>
              <label>Field Observations <em>— one per line</em></label>
              <div className={styles.obsHint}>Each line becomes a bullet on the creature's page.</div>
              <textarea rows="6" value={outObs} onChange={e => setOutObs(e.target.value)} placeholder="thrives in warm spots of afternoon light&#10;will sit perfectly still for hours — it's watching, not sleeping&#10;the pattern on its back is different depending on how you hold it" />
            </div>

            <div className={styles.saveRow}>
              <button 
                className="btn sm" 
                onClick={saveLore} 
                disabled={isOutputBlank || saving}
              >
                Save to Supabase
              </button>
              <button 
                className="btn sm" 
                onClick={copyJson} 
                style={{ background: "none", borderColor: "var(--border)", color: "var(--cream-faint)" }}
              >
                Copy JSON
              </button>
              <span className={`${styles.saveStatus} ${saveStatusType ? styles[saveStatusType] : ""}`}>
                {saveStatus}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.generateRow}>
        <div className={styles.hint}>Fill in what you know — leave the rest blank and the AI will hallucinate the rest in Cadence's voice.</div>
        <div className={`${styles.spinner} ${generating ? styles.on : ""}`}></div>
        <div className={`${styles.aiStatus} ${aiStatusType ? styles[aiStatusType] : ""}`}>{aiStatus}</div>
        <button className={styles.btnGen} onClick={runAiFill} disabled={generating}>
          ✦ Generate Lore
        </button>
      </div>
    </div>
  );
}
