"use client";

import { useState, useEffect } from "react";
import { createClient } from "../../../lib/supabase/client";
import styles from "./customers.module.css";

// Formatter for Initials Avatar
function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [tab, setTab] = useState("directory");
  const [allSubmissions, setAllSubmissions] = useState([]);
  const [expandedMsg, setExpandedMsg] = useState(null);

  // Statistics
  const [stats, setStats] = useState({
    totalAudience: 0,
    waitlistCount: 0,
    payingCount: 0,
    newThisMonth: 0,
  });

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      // Query orders, subscribers, and contact submissions concurrently
      const [ordersRes, subsRes, contactsRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id, buyer_name, buyer_email, items, total_amount, status, order_date, created_at, etsy_order_id")
          .order("created_at", { ascending: false }),
        supabase
          .from("subscribers")
          .select("id, email, first_name, last_name, source, subscribed, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("contact_submissions")
          .select("id, name, email, topic, message, order_number, is_read, created_at")
          .order("created_at", { ascending: false })
      ]);

      const orders = ordersRes.data || [];
      const subscribers = subsRes.data || [];
      const submissions = contactsRes.data || [];

      // Unified directory map
      const map = {};

      // 1. Process landing-page and launch subscribers
      for (const s of subscribers) {
        const email = (s.email || "").trim().toLowerCase();
        const fullName = `${s.first_name || ""} ${s.last_name || ""}`.trim() || "Mystery Creature";
        
        if (email) {
          map[email] = {
            email,
            name: fullName,
            source: s.source || "landing_page",
            created_at: s.created_at,
            orders: [],
            messages: [],
            total: 0,
            is_subscriber: true,
            subscribed: s.subscribed !== false,
            is_buyer: false,
            id: `sub_${s.id}`
          };
        } else {
          const fallbackKey = `sub_anon_${s.id}`;
          map[fallbackKey] = {
            email: "",
            name: fullName || "Anonymous Subscriber",
            source: s.source || "landing_page",
            created_at: s.created_at,
            orders: [],
            messages: [],
            total: 0,
            is_subscriber: true,
            subscribed: s.subscribed !== false,
            is_buyer: false,
            id: fallbackKey
          };
        }
      }

      function findContactByName(searchName) {
        if (!searchName || searchName === "Mystery Buyer" || searchName === "Mystery Creature" || searchName === "Mystery Inquirer") return null;
        const lowerName = searchName.toLowerCase();
        for (const key in map) {
          if (map[key].name && map[key].name.toLowerCase() === lowerName) {
            return map[key];
          }
        }
        return null;
      }

      // 2. Process Etsy and direct orders (merging duplicates by email or name)
      for (const o of orders) {
        const email = (o.buyer_email || "").trim().toLowerCase();
        const name = (o.buyer_name || "").trim() || "Mystery Buyer";
        const spent = parseFloat(o.total_amount) || 0;

        let contact = null;
        if (email && map[email]) {
          contact = map[email];
        } else {
          contact = findContactByName(name);
        }

        if (contact) {
          // Contact exists! Merge.
          contact.is_buyer = true;
          
          // Use the order name if the subscriber name was generic/empty
          if (!contact.name || contact.name === "Mystery Creature" || contact.name === "Mystery Buyer") {
            contact.name = name;
          }
          
          // If we found them by name but they lacked an email, save it
          if (!contact.email && email) {
            contact.email = email;
          }
          
          contact.orders.push(o);
          contact.total += spent;
          
          // Set created_at to the earliest known touchpoint
          if (o.created_at && o.created_at < contact.created_at) {
            contact.created_at = o.created_at;
          }
        } else if (email) {
          // New contact from orders
          map[email] = {
            email,
            name,
            source: "Etsy Store",
            created_at: o.created_at || o.order_date,
            orders: [o],
            messages: [],
            total: spent,
            is_subscriber: false,
            subscribed: null,
            is_buyer: true,
            id: `ord_email_${o.id}`
          };
        } else {
          // Order with no email - group by name or unique ID
          const key = name ? `ord_name_${name}` : `ord_id_${o.id}`;
          if (map[key]) {
            map[key].orders.push(o);
            map[key].total += spent;
          } else {
            map[key] = {
              email: "",
              name: name || "Mystery Buyer",
              source: "Direct Sale",
              created_at: o.created_at || o.order_date,
              orders: [o],
              messages: [],
              total: spent,
              is_subscriber: false,
              subscribed: null,
              is_buyer: true,
              id: key
            };
          }
        }
      }

      // 3. Process direct contact inquiries (merging duplicates by email or name)
      for (const m of submissions) {
        const email = (m.email || "").trim().toLowerCase();
        const name = (m.name || "").trim() || "Mystery Inquirer";

        let contact = null;
        if (email && map[email]) {
          contact = map[email];
        } else {
          contact = findContactByName(name);
        }

        if (contact) {
          if (!contact.name || contact.name === "Mystery Creature" || contact.name === "Mystery Buyer" || contact.name === "Mystery Inquirer") {
            contact.name = name;
          }
          if (!contact.email && email) {
            contact.email = email;
          }
          contact.messages.push(m);
          if (m.created_at && (!contact.created_at || m.created_at < contact.created_at)) {
            contact.created_at = m.created_at;
          }
        } else if (email) {
          map[email] = {
            email,
            name,
            source: "Workshop Inquiry",
            created_at: m.created_at,
            orders: [],
            messages: [m],
            total: 0,
            is_subscriber: false,
            subscribed: null,
            is_buyer: false,
            id: `msg_email_${m.id}`
          };
        } else {
          const key = name ? `msg_name_${name}` : `msg_id_${m.id}`;
          if (map[key]) {
            map[key].messages.push(m);
          } else {
            map[key] = {
              email: "",
              name: name || "Mystery Inquirer",
              source: "Workshop Inquiry",
              created_at: m.created_at,
              orders: [],
              messages: [m],
              total: 0,
              is_subscriber: false,
              subscribed: null,
              is_buyer: false,
              id: key
            };
          }
        }
      }

      const mergedList = Object.values(map).sort((a, b) => {
        // Sort paying customers first, then by total spent, then by date
        if (b.total !== a.total) return b.total - a.total;
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      });

      // Find the first 5 buyers by their earliest order date
      const allBuyers = mergedList.filter(c => c.is_buyer).sort((a, b) => {
         const minA = Math.min(...a.orders.map(o => new Date(o.created_at || o.order_date).getTime()));
         const minB = Math.min(...b.orders.map(o => new Date(o.created_at || o.order_date).getTime()));
         return minA - minB;
      });
      const first5Ids = new Set(allBuyers.slice(0, 5).map(c => c.id));

      const categorizedList = mergedList.map(c => {
         const isFirst5 = first5Ids.has(c.id);
         const isVIP = c.total >= 100 || c.orders.length >= 3;
         const isRepeat = c.orders.length === 2 && !isVIP;
         return { ...c, isFirst5, isVIP, isRepeat };
      });

      // Calculate statistics
      const totalAudience = categorizedList.length;
      // Active Waitlist includes landing_page and bestiary_notify, but only if they are active (subscribed !== false)
      const waitlistCount = subscribers.filter(s => 
        (s.source === "landing_page" || s.source === "bestiary_notify") && s.subscribed !== false
      ).length;
      const payingCount = mergedList.filter(c => c.is_buyer).length;
      
      const now = new Date();
      const newThisMonth = mergedList.filter(c => {
        if (!c.created_at) return false;
        const d = new Date(c.created_at);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length;

      setStats({
        totalAudience,
        waitlistCount,
        payingCount,
        newThisMonth
      });

      setAllSubmissions(submissions);
      setCustomers(categorizedList);
      setLoading(false);
    }
    load();
  }, []);

  async function markRead(id) {
    const supabase = createClient();
    await supabase.from("contact_submissions").update({ is_read: true }).eq("id", id);
    setAllSubmissions(prev => prev.map(m => m.id === id ? { ...m, is_read: true } : m));
  }

  // Filter list by search term
  const visible = customers.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    
    const matchesName = c.name?.toLowerCase().includes(q);
    const matchesEmail = c.email?.toLowerCase().includes(q);
    const matchesSource = c.source?.toLowerCase().includes(q);
    
    // Check if the query matches items inside their orders
    const matchesItems = c.orders?.some(o => {
      if (Array.isArray(o.items)) {
        return o.items.some(item => String(item).toLowerCase().includes(q));
      }
      return String(o.items || "").toLowerCase().includes(q);
    });

    // Check if the query matches topic or message inside workshop submissions
    const matchesMessages = c.messages?.some(m => 
      m.topic?.toLowerCase().includes(q) || m.message?.toLowerCase().includes(q)
    );

    return matchesName || matchesEmail || matchesSource || matchesItems || matchesMessages;
  });

  const unreadCount = allSubmissions.filter(m => !m.is_read).length;

  return (
    <div>
      <div className="sec-hdr">
        <div>
          <h1 className={styles.title}>Audience &amp; Customers</h1>
          <div style={{ fontSize: "13px", color: "var(--cream-dim)", marginTop: "4px" }}>
            Unified directory of landing page subscribers, active waitlists, and Etsy buyers.
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        <button className={`btn sm${tab === "directory" ? " gold" : ""}`} onClick={() => setTab("directory")}>Directory</button>
        <button className={`btn sm${tab === "messages" ? " gold" : ""}`} onClick={() => setTab("messages")}>
          Inbox{unreadCount > 0 ? ` · ${unreadCount} unread` : ""}
        </button>
      </div>

      {tab === "messages" ? (
        <div>
          {allSubmissions.length === 0 ? (
            <div className="empty-state">No messages yet</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {allSubmissions.map(m => {
                const isOpen = expandedMsg === m.id;
                const msgDate = m.created_at
                  ? new Date(m.created_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
                  : "—";
                return (
                  <div key={m.id} style={{ background: m.is_read ? "rgba(255,255,255,0.02)" : "rgba(91,191,212,0.06)", border: `1px solid ${m.is_read ? "var(--gold-border)" : "rgba(91,191,212,0.25)"}`, borderRadius: 6, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer" }} onClick={() => setExpandedMsg(isOpen ? null : m.id)}>
                      {!m.is_read && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#5BBFD4", flexShrink: 0 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: "var(--cream)", fontFamily: "sans-serif" }}>
                          {m.name || "Anonymous"}{m.email && <span style={{ color: "var(--dim)", fontSize: 11, marginLeft: 6 }}>{m.email}</span>}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--gold)", marginTop: 2 }}>{m.topic || "Inquiry"}</div>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--dim)", flexShrink: 0, marginRight: 6 }}>{msgDate}</div>
                      <span style={{ color: "var(--dim)", fontSize: 12 }}>{isOpen ? "▲" : "▾"}</span>
                    </div>
                    {isOpen && (
                      <div style={{ padding: "0 16px 16px", borderTop: "1px solid var(--gold-border)" }}>
                        <div style={{ fontSize: 13, color: "var(--cream-dim)", lineHeight: 1.6, marginTop: 12, marginBottom: 12 }}>{m.message}</div>
                        {m.order_number && <div style={{ fontSize: 11, color: "var(--dim)", marginBottom: 10 }}>Reference Order: #{m.order_number}</div>}
                        <div style={{ display: "flex", gap: 8 }}>
                          {!m.is_read && <button className="btn sm" onClick={() => markRead(m.id)}>Mark Read</button>}
                          {m.email && <a className="btn sm" href={`mailto:${m.email}`}>Reply ↗</a>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>

      {/* Stats KPI Strip */}
      <div className={styles.statsStrip}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Audience</div>
          <div className={styles.statValue}>{loading ? "—" : stats.totalAudience}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>New This Month</div>
          <div className={styles.statValue}>{loading ? "—" : stats.newThisMonth}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Active Waitlist</div>
          <div className={styles.statValue}>{loading ? "—" : stats.waitlistCount}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Paying Customers</div>
          <div className={styles.statValue}>{loading ? "—" : stats.payingCount}</div>
        </div>
      </div>

      {/* Search Input */}
      <div style={{ marginBottom: 20 }}>
        <input
          className="fi"
          style={{ maxWidth: 400 }}
          placeholder="Search by name, email, source, or creature bought…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="empty-state">Loading audience directory…</div>
      ) : visible.length === 0 ? (
        <div className="empty-state">No contacts found</div>
      ) : (
        <div className={styles.list}>
          {visible.map((c, i) => {
            const initials = getInitials(c.name);
            const dateLabel = c.created_at
              ? new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : "—";

            return (
              <div key={c.id || i} className={styles.card}>
                <div className={styles.header} onClick={() => setExpanded(expanded === i ? null : i)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0, flex: 1 }}>
                    <div className={styles.avatar}>{initials}</div>
                    <div className={styles.info} style={{ minWidth: 0 }}>
                      <span className={styles.name}>{c.name || "Mystery Creature"}</span>
                      {c.email && <span className={styles.email}>{c.email}</span>}
                      
                      {/* Dynamic Badging System */}
                      <div className={styles.tags}>
                        {c.isVIP && <span className={`${styles.badge} ${styles.badgeGold}`}>VIP 👑</span>}
                        {c.isFirst5 && <span className={`${styles.badge} ${styles.badgeTeal}`}>First 5 🌟</span>}
                        {c.isRepeat && <span className={`${styles.badge} ${styles.badgePurple}`}>Repeat Buyer</span>}
                        
                        {c.is_subscriber && (
                          c.subscribed === false ? (
                            <span className={`${styles.badge} ${styles.badgeRed}`}>
                              Opted Out
                            </span>
                          ) : (
                            <span className={`${styles.badge} ${styles.badgeTeal}`}>
                              Waitlist / Subscriber
                            </span>
                          )
                        )}
                        {!c.isFirst5 && !c.isRepeat && !c.isVIP && c.is_buyer ? (
                          <span className={`${styles.badge} ${styles.badgeGold}`}>
                            Etsy Buyer
                          </span>
                        ) : null}
                        {!c.is_buyer ? (
                          <span className={`${styles.badge} ${styles.badgeFaint}`}>
                            Non-Buyer
                          </span>
                        ) : null}
                        {c.source && c.source !== "landing_page" && c.source !== "bestiary_notify" && c.source !== "Etsy Store" && (
                          <span className={`${styles.badge} ${styles.badgePurple}`}>
                            {c.source}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={styles.stats}>
                    <span className={styles.orderCount}>
                      {c.orders.length} order{c.orders.length !== 1 ? "s" : ""}
                    </span>
                    <span className={styles.spent}>
                      ${c.total.toFixed(2)}
                    </span>
                    <span className={styles.chevron}>{expanded === i ? "▲" : "▾"}</span>
                  </div>
                </div>

                {/* Expanded Details Section */}
                {expanded === i && (
                  <div className={styles.detailsSection}>
                    <div style={{ fontSize: "11px", color: "var(--dim)", display: "flex", justifyContent: "space-between", paddingBottom: "4px" }}>
                      <span>First Touchpoint: {dateLabel}</span>
                      <span>Initial Channel: {c.source === "landing_page" ? "Waitlist Signup" : c.source === "bestiary_notify" ? "Bestiary Launch Alert" : c.source}</span>
                    </div>

                    {c.orders.length === 0 && c.messages.length === 0 ? (
                      <div className={styles.subSection} style={{ padding: "16px", color: "var(--dim)", fontSize: "12px", fontStyle: "italic", textAlign: "center" }}>
                        No orders placed or messages sent yet. (Waitlist Subscriber)
                      </div>
                    ) : (
                      <>
                        {/* Etsy Orders Sub-Section */}
                        {c.orders.length > 0 && (
                          <div className={styles.subSection}>
                            <div className={styles.subSectionTitle}>Etsy Orders ({c.orders.length})</div>
                            {c.orders.map(o => (
                              <div key={o.id} className={styles.orderRow}>
                                <span className={styles.orderId}>#{o.etsy_order_id || o.id?.slice(0, 8)}</span>
                                <span className={styles.orderItems} title={Array.isArray(o.items) ? o.items.join(", ") : (o.items || "")}>
                                  {Array.isArray(o.items) ? o.items.join(", ") : (o.items || "—")}
                                </span>
                                <span className={`badge ${o.status === "shipped" || o.status === "complete" ? "badge-green" : "badge-gold"}`}>
                                  {o.status}
                                </span>
                                <span className={styles.orderAmt}>
                                  {o.total_amount ? `$${parseFloat(o.total_amount).toFixed(2)}` : "—"}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Workshop Messages Sub-Section */}
                        {c.messages.length > 0 && (
                          <div className={styles.subSection}>
                            <div className={styles.subSectionTitle}>Workshop Messages ({c.messages.length})</div>
                            {c.messages.map(m => {
                              const msgDate = m.created_at
                                ? new Date(m.created_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
                                : "—";
                              return (
                                <div key={m.id} className={styles.messageRow}>
                                  <div className={styles.messageHeader}>
                                    <span className={styles.messageTopic}>{m.topic || "Inquiry"}</span>
                                    <span className={styles.messageDate}>{msgDate}</span>
                                  </div>
                                  <div className={styles.messageBody}>{m.message}</div>
                                  {m.order_number && (
                                    <div className={styles.messageOrder}>
                                      Reference Order: #{m.order_number}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
        </>
      )}
    </div>
  );
}
