"use client";
import { useState, useEffect } from "react";
import { createClient } from "../../../lib/supabase/client";
import styles from "./messages.module.css";

export default function MessagesPage() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("contact_submissions")
        .select("*")
        .order("created_at", { ascending: false });
      setMessages(data || []);
      setLoading(false);
    }
    load();
  }, []);

  async function markRead(id) {
    const supabase = createClient();
    await supabase.from("contact_submissions").update({ is_read: true }).eq("id", id);
    setMessages(prev => prev.map(m => m.id === id ? { ...m, is_read: true } : m));
  }

  const unread = messages.filter(m => !m.is_read).length;

  return (
    <div>
      <div className="sec-hdr" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 className={styles.title}>Workshop Messages</h1>
          <div style={{ fontSize: "13px", color: "var(--cream-dim)", marginTop: "4px" }}>
            Direct customer inquiries and contact submissions from the workshop contact form.
          </div>
        </div>
        {unread > 0 && <span className="badge badge-gold">{unread} unread</span>}
      </div>

      {loading ? (
        <div className="empty-state">Loading messages…</div>
      ) : messages.length === 0 ? (
        <div className="empty-state">No messages yet</div>
      ) : (
        <div className={styles.list}>
          {messages.map(m => {
            const dateLabel = m.created_at
              ? new Date(m.created_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
              : "—";

            return (
              <div key={m.id} className={`${styles.card} ${!m.is_read ? styles.unread : ""}`}
                onClick={() => { 
                  setExpanded(expanded === m.id ? null : m.id); 
                  if (!m.is_read) markRead(m.id); 
                }}>
                <div className={styles.header}>
                  <span className={styles.from}>{m.name || m.email || "Mystery Inquirer"}</span>
                  <span className={styles.time}>{dateLabel}</span>
                </div>
                <div className={styles.subject} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>{m.topic || "(no subject)"}</span>
                  {m.order_number && (
                    <span className="badge badge-gold" style={{ fontSize: "9px" }}>
                      Ref: #{m.order_number}
                    </span>
                  )}
                </div>
                {expanded === m.id && (
                  <div className={styles.body}>
                    <div style={{ paddingBottom: 10, marginBottom: 12, borderBottom: "1px solid rgba(201,168,76,0.08)", fontSize: "12px", color: "var(--dim)", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                      <span>Email: <a href={`mailto:${m.email}`} style={{ color: "var(--gold-light)" }}>{m.email}</a></span>
                      {m.order_number && <span>Order: #{m.order_number}</span>}
                    </div>
                    <div style={{ whiteSpace: "pre-wrap", fontFamily: "var(--font-lora), serif", fontSize: "13px", lineHeight: "1.6", color: "var(--cream-dim)" }}>
                      {m.message}
                    </div>
                    <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
                      <a href={`mailto:${m.email}?subject=Re: [Cadence Creatures] ${m.topic || "Workshop Inquiry"}`} className="btn sm gold" style={{ textDecoration: "none" }}>
                        Reply by Email
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
