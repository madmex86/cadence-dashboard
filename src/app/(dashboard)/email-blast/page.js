"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "../../../lib/supabase/client";
import styles from "./email.module.css";

export default function EmailBlastPage() {
  const [subCount, setSubCount] = useState(0);
  const [templates, setTemplates] = useState([]);
  const [history, setHistory] = useState([]);
  
  const [fromAddress, setFromAddress] = useState("noreply@cadencecreatures.com");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");
  const [isError, setIsError] = useState(false);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    
    // Load subscribers count
    const { count, error: subErr } = await supabase
      .from("subscribers")
      .select("*", { count: "exact", head: true })
      .eq("subscribed", true);
      
    if (!subErr) setSubCount(count || 0);

    // Load templates
    const { data: tpls, error: tplErr } = await supabase
      .from("email_templates")
      .select("*")
      .order("created_at", { ascending: false });
      
    if (!tplErr) setTemplates(tpls || []);

    // Load history from local storage for now (as in original)
    const raw = localStorage.getItem("cc_blast_history");
    if (raw) {
      setHistory(JSON.parse(raw));
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function escHtml(s) {
    if (!s) return "";
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  const previewBody = body
    ? escHtml(body).replace(/\{\{name\}\}/g, '<em>Sarah</em>')
    : '<span class="' + styles.previewPlaceholder + '">Your message will appear here…</span>';

  const lastBlastDate = history.length > 0 
    ? new Date(history[history.length - 1].timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : "—";

  async function sendBlast() {
    if (sending) return;
    if (!subject.trim()) {
      setStatus("Please enter a subject line.");
      setIsError(true);
      return;
    }
    if (!body.trim()) {
      setStatus("Please write a message body.");
      setIsError(true);
      return;
    }
    if (subCount === 0) {
      setStatus("No subscribers found — check Supabase.");
      setIsError(true);
      return;
    }

    if (!confirm(`Send from ${fromAddress} to ${subCount} subscriber${subCount !== 1 ? 's' : ''}?`)) return;

    setSending(true);
    setStatus("");
    setIsError(false);

    try {
      const supabase = createClient();
      const res = await supabase.functions.invoke('send-blast', {
        body: { subject: subject.trim(), message: body.trim(), from_address: fromAddress }
      });
      
      const { data, error: fnError } = res;

      if (fnError) throw fnError;

      const sent = data?.sent || 0;
      const failed = data?.failed || 0;
      
      let msg = `Sent ${sent} email${sent !== 1 ? 's' : ''}`;
      if (failed) msg += `, ${failed} failed`;
      
      setStatus(msg + ".");
      setIsError(sent === 0);

      if (sent > 0) {
        // Save history
        const newEntry = { subject: subject.trim(), sent, from: fromAddress, timestamp: new Date().toISOString() };
        const nextHistory = [...history, newEntry];
        setHistory(nextHistory);
        localStorage.setItem("cc_blast_history", JSON.stringify(nextHistory));
        
        // Reset compose
        setSubject("");
        setBody("");
      }
    } catch (err) {
      const em = err.message || String(err);
      setStatus("Error: " + em);
      setIsError(true);
    } finally {
      setSending(false);
    }
  }

  async function saveTemplate() {
    if (!subject.trim() && !body.trim()) {
      alert("Nothing to save — fill in subject or body first.");
      return;
    }
    const name = prompt("Template name:");
    if (!name || !name.trim()) return;

    const supabase = createClient();
    const { error } = await supabase.from("email_templates").insert({
      name: name.trim(),
      subject: subject.trim(),
      body: body.trim(),
      from_address: fromAddress
    });

    if (error) {
      alert("Save failed: " + error.message);
    } else {
      alert("Template saved.");
      loadData();
    }
  }

  function loadTemplate(t) {
    setFromAddress(t.from_address || "noreply@cadencecreatures.com");
    setSubject(t.subject || "");
    setBody(t.body || "");
  }

  async function deleteTemplate(id) {
    if (!confirm("Delete this template?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("email_templates").delete().eq("id", id);
    if (error) {
      alert("Delete failed: " + error.message);
    } else {
      loadData();
    }
  }

  return (
    <div>
      <div className="sec-hdr">
        <h1 className={styles.title}>Email Blast</h1>
      </div>
      <div className={styles.subtitle}>Compose and send newsletters to all subscribers.</div>

      <div className={styles.statBar}>
        <div className={styles.statBox}>
          <div className={styles.statVal}>{subCount}</div>
          <div className={styles.statLbl}>Subscribers</div>
        </div>
        <div className={styles.statBox}>
          <div className={styles.statVal}>{history.length}</div>
          <div className={styles.statLbl}>Blasts Sent</div>
        </div>
        <div className={styles.statBox}>
          <div className={styles.statVal}>{lastBlastDate}</div>
          <div className={styles.statLbl}>Last Blast</div>
        </div>
      </div>

      <div className={styles.blastLayout}>
        {/* LEFT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* COMPOSE */}
          <div className={styles.ep}>
            <div className={styles.epTitle}>Compose</div>

            <div style={{ marginBottom: "14px" }}>
              <label className={styles.fl}>From</label>
              <select className={styles.fi} value={fromAddress} onChange={e => setFromAddress(e.target.value)}>
                <option value="noreply@cadencecreatures.com">Newsletter — noreply@cadencecreatures.com</option>
                <option value="hello@cadencecreatures.com">General — hello@cadencecreatures.com</option>
              </select>
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label className={styles.fl}>Subject Line</label>
              <input 
                type="text" 
                className={styles.fi} 
                value={subject} 
                onChange={e => setSubject(e.target.value)} 
                placeholder="New Creatures Spotted!" 
              />
            </div>

            <div style={{ marginBottom: "4px" }}>
              <label className={styles.fl}>Message Body</label>
              <textarea 
                className={styles.fi} 
                value={body} 
                onChange={e => setBody(e.target.value)} 
                placeholder="Hi {{name}},&#10;&#10;Write your message here…" 
              />
            </div>
            <div className={styles.hint}>
              Use <code style={{ background: "rgba(201,168,76,.1)", padding: "1px 5px", borderRadius: "2px", fontSize: "11px" }}>{"{{name}}"}</code> to personalize with each subscriber's first name.
            </div>

            <div className={styles.sendRow}>
              <button className="btn pri" onClick={sendBlast} disabled={sending}>
                {sending ? "Sending…" : "Send to All Subscribers"}
              </button>
              <button className="btn" onClick={saveTemplate} disabled={sending} title="Save current compose as a reusable template">
                Save as Template
              </button>
              <div className={styles.sendStatus} style={{ color: isError ? "rgba(232,112,112,.9)" : "var(--dim)" }}>
                {status}
              </div>
            </div>
            
            {sending && (
              <div className={styles.sendingIndicator}>
                <div className={styles.spin}></div>
                <span>Sending to {subCount} subscriber{subCount !== 1 ? 's' : ''}…</span>
              </div>
            )}
          </div>

          {/* TEMPLATES */}
          <div className={styles.ep}>
            <div className={styles.epTitleRow}>
              <div className={styles.epTitle}>Templates</div>
            </div>
            <div>
              {templates.length === 0 ? (
                <div className={styles.tplEmpty}>No templates saved yet.</div>
              ) : (
                templates.map(t => (
                  <div key={t.id} className={styles.tplItem}>
                    <div className={styles.tplInfo}>
                      <div className={styles.tplName}>{t.name}</div>
                      <div className={styles.tplSubject}>{t.subject}</div>
                    </div>
                    <span className={styles.tplFromBadge}>
                      {t.from_address === 'hello@cadencecreatures.com' ? 'hello@' : 'noreply@'}
                    </span>
                    <div className={styles.tplActions}>
                      <button className="btn sm" onClick={() => loadTemplate(t)}>Load</button>
                      <button className="btn sm red" style={{ padding: "0 8px" }} onClick={() => deleteTemplate(t.id)}>✕</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* HISTORY */}
          <div className={styles.ep}>
            <div className={styles.epTitle}>Blast History</div>
            <div>
              {history.length === 0 ? (
                <div className={styles.historyEmpty}>No blasts sent yet.</div>
              ) : (
                [...history].reverse().map((b, i) => {
                  const d = new Date(b.timestamp);
                  const fmt = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                  const fromStr = b.from ? ' · ' + b.from.replace('@cadencecreatures.com','@…') : '';
                  return (
                    <div key={i} className={styles.historyItem}>
                      <div className={styles.hiSubject}>{b.subject}</div>
                      <div className={styles.hiMeta}>Sent to {b.sent} subscriber{b.sent !== 1 ? 's' : ''}{fromStr} &nbsp;·&nbsp; {fmt}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* PREVIEW */}
        <div className={styles.ep} style={{ position: "sticky", top: "80px" }}>
          <div className={styles.epTitle}>Preview</div>
          <div className={styles.previewEmail}>
            <div className={styles.previewFrom}>From: Cadence Creatures &lt;{fromAddress}&gt;</div>
            <div className={styles.previewSubject}>
              {subject ? subject : <span className={styles.previewPlaceholder}>Your subject line</span>}
            </div>
            <div className={styles.previewBody} dangerouslySetInnerHTML={{ __html: previewBody }}></div>
            <div className={styles.previewFooter}>
              Cadence Creatures · Visalia, CA<br/>
              <a href="#" style={{ color: "#aaa" }}>Unsubscribe</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
