"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import styles from "./admin.module.css";

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [deactivateConfirmId, setDeactivateConfirmId] = useState(null);
  const [authorized, setAuthorized] = useState(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      // Check if user is owner or admin in profiles table
      const isOwner = user.email === 'stevenportugal86@gmail.com';
      let role = 'user';
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        if (profile && profile.role) {
          role = profile.role;
        }
      } catch (err) {
        console.error("Error loading user profile on Admin page:", err);
      }

      if (!isOwner && role !== 'admin') {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      setAuthorized(true);

      const { data } = await supabase.from("profiles").select("id, email, role, full_name, last_seen, deactivated").order("email");
      setUsers(data || []);
      setLoading(false);
    }
    load();
  }, []);

  async function updateRole(id, role) {
    setSaving(id);
    const supabase = createClient();
    await supabase.from("profiles").update({ role }).eq("id", id);
    setUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u));
    setSaving(null);
  }

  async function toggleDeactivate(id, deactivated) {
    setSaving(id);
    const supabase = createClient();
    await supabase.from("profiles").update({ deactivated: !deactivated }).eq("id", id);
    setUsers(prev => prev.map(u => u.id === id ? { ...u, deactivated: !deactivated } : u));
    setSaving(null);
    setDeactivateConfirmId(null);
  }

  async function sendInvite(e) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteMsg(null);
    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invite failed");
      setInviteMsg({ ok: true, text: data.existing ? `${inviteEmail} already exists — role updated.` : `Invite sent to ${inviteEmail}.` });
      setInviteEmail("");
      setInviteRole("user");
      // Refresh list
      const supabase = createClient();
      const { data: updated } = await supabase.from("profiles").select("id, email, role, full_name, last_seen, deactivated").order("email");
      setUsers(updated || []);
    } catch (err) {
      setInviteMsg({ ok: false, text: err.message });
    }
    setInviting(false);
  }

  async function updateFullName(id, fullName) {
    setSaving(id);
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", id);
    if (error) {
      alert("Failed to update display name: " + error.message);
    } else {
      setUsers(prev => prev.map(u => u.id === id ? { ...u, full_name: fullName } : u));
    }
    setSaving(null);
  }

  if (loading) {
    return <div className="empty-state">Loading users…</div>;
  }

  if (authorized === false) {
    return (
      <div className={styles.restrictedContainer}>
        <div className={styles.restrictedCard}>
          <div className={styles.lockIcon}>🔐</div>
          <h1 className={styles.restrictedTitle}>Sanctuary Restrained</h1>
          <p className={styles.restrictedMessage}>
            This registry is reserved exclusively for keepers of the crown. If you believe this restriction is in error, please coordinate with Steven.
          </p>
          <p className={styles.restrictedSub}>
            “And so another creature found its way into the world, carrying her name a little further.”
          </p>
          <button className={styles.restrictedBtn} onClick={() => router.push("/")}>
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="sec-hdr">
        <h1 className={styles.title}>Admin Settings</h1>
      </div>

      <div className="sec-hdr" style={{ marginTop: 8 }}>
        <span className="sec-title">Invite Team Member</span>
      </div>

      <form onSubmit={sendInvite} style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--dim)" }}>Email</label>
          <input
            type="email"
            className="fi"
            placeholder="teammate@email.com"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            style={{ minWidth: 240 }}
            required
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--dim)" }}>Role</label>
          <select className="fi" value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{ minWidth: 140 }}>
            <option value="user">User</option>
            <option value="fulfillment">Fulfillment</option>
            <option value="finance">Finance</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button type="submit" className="btn" disabled={inviting} style={{ alignSelf: "flex-end" }}>
          {inviting ? "Sending…" : "Send Invite"}
        </button>
        {inviteMsg && (
          <span style={{ alignSelf: "flex-end", fontSize: 12, fontFamily: "sans-serif", color: inviteMsg.ok ? "var(--gold)" : "#e87070" }}>
            {inviteMsg.text}
          </span>
        )}
      </form>

      <div className="sec-hdr" style={{ marginTop: 8 }}>
        <span className="sec-title">Team Access & Roles</span>
      </div>

      {users.length === 0 ? (
        <div className="empty-state">No profiles found — roles are set via user_metadata in Supabase Auth</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Display Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Last Active</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const lastSeenLabel = u.last_seen
                  ? new Date(u.last_seen).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
                  : "Never";
                return (
                  <tr key={u.id} style={{ opacity: u.deactivated ? 0.6 : 1 }}>
                    <td>
                      <input
                        type="text"
                        className={styles.nameInput}
                        defaultValue={u.full_name || ""}
                        placeholder="Enter name..."
                        onBlur={e => {
                          const val = e.target.value.trim();
                          if (val !== (u.full_name || "")) {
                            updateFullName(u.id, val);
                          }
                        }}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            e.target.blur();
                          }
                        }}
                        disabled={saving === u.id}
                      />
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <select
                        className="fi"
                        style={{ maxWidth: 140, padding: "4px 8px" }}
                        value={u.role || "user"}
                        onChange={e => updateRole(u.id, e.target.value)}
                        disabled={saving === u.id}
                      >
                        <option value="user">User</option>
                        <option value="fulfillment">Fulfillment</option>
                        <option value="finance">Finance</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td style={{ fontSize: "12px", fontFamily: "sans-serif", color: "var(--dim)" }}>{lastSeenLabel}</td>
                    <td>
                      <span className={`badge ${u.deactivated ? "badge-red" : "badge-green"}`}>
                        {u.deactivated ? "Deactivated" : "Active"}
                      </span>
                    </td>
                    <td>
                      {deactivateConfirmId === u.id ? (
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="btn sm" onClick={() => setDeactivateConfirmId(null)}>Cancel</button>
                          <button className="btn sm" style={{ color: "#e87070", borderColor: "rgba(232,112,112,0.3)" }} onClick={() => toggleDeactivate(u.id, u.deactivated)}>Confirm</button>
                        </div>
                      ) : (
                        <button
                          className="btn sm"
                          style={{
                            borderColor: u.deactivated ? "var(--gold-border)" : "rgba(232,112,112,0.3)",
                            color: u.deactivated ? "var(--gold)" : "#e87070",
                            background: "none"
                          }}
                          onClick={() => setDeactivateConfirmId(u.id)}
                          disabled={saving === u.id}
                        >
                          {u.deactivated ? "Activate" : "Deactivate"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 32 }}>
        <div className="sec-hdr"><span className="sec-title">Role Permissions</span></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
          {[
            { role: "admin", access: "All pages, all actions" },
            { role: "finance", access: "P&L, Analytics, Sales — no Queue/Fulfillment" },
            { role: "fulfillment", access: "Queue, Fulfillment — no P&L or Finance" },
            { role: "user", access: "Dashboard Hub, Creatures (read-only)" },
          ].map(r => (
            <div key={r.role} style={{ display: "flex", gap: 16, padding: "10px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--gold-border)", borderRadius: 4 }}>
              <span className="badge badge-gold" style={{ minWidth: 90, textAlign: "center" }}>{r.role}</span>
              <span style={{ fontSize: 13, color: "var(--cream-dim)", fontFamily: "sans-serif" }}>{r.access}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
