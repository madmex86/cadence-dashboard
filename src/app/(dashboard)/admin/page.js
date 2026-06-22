"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import styles from "./admin.module.css";
import { BUILTIN_ROLES, ALL_PAGES, TOTAL_PAGES } from "./roleConfig";
import EditUserModal from "./EditUserModal";

const BLANK_ROLE = { id: null, name: "", description: "", allowed_paths: [] };

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers]   = useState([]);
  const [roles, setRoles]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(null);

  // user-table state
  const [saving, setSaving] = useState(null);
  const [deactivateConfirmId, setDeactivateConfirmId] = useState(null);

  // invite state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole,  setInviteRole]  = useState("user");
  const [inviting,    setInviting]    = useState(false);
  const [inviteMsg,   setInviteMsg]   = useState(null);

  // user edit modal state
  const [editingUser, setEditingUser] = useState(null); // null | user object

  // role-builder state
  const [editingRole, setEditingRole] = useState(null); // null | BLANK_ROLE shape
  const [savingRole,  setSavingRole]  = useState(false);
  const [deleteRoleConfirmId, setDeleteRoleConfirmId] = useState(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAuthorized(false); setLoading(false); return; }

      const isOwner = user.email === "stevenportugal86@gmail.com";
      let role = "user";
      try {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
        if (profile?.role) role = profile.role;
      } catch (err) { console.error("Admin page profile load:", err); }

      if (!isOwner && role !== "admin") { setAuthorized(false); setLoading(false); return; }
      setAuthorized(true);

      const [usersRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("id, email, role, full_name, last_seen, deactivated, custom_paths").order("email"),
        supabase.from("roles").select("*").order("name"),
      ]);
      setUsers(usersRes.data || []);
      setRoles(rolesRes.data || []);
      setLoading(false);
    }
    load();
  }, []);

  async function refreshRoles() {
    const supabase = createClient();
    const { data } = await supabase.from("roles").select("*").order("name");
    setRoles(data || []);
  }

  /* ── User management ─────────────────────────────────── */

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

  async function updateFullName(id, fullName) {
    setSaving(id);
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", id);
    if (error) alert("Failed to update name: " + error.message);
    else setUsers(prev => prev.map(u => u.id === id ? { ...u, full_name: fullName } : u));
    setSaving(null);
  }

  /* ── Invite ──────────────────────────────────────────── */

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
      const supabase = createClient();
      const { data: updated } = await supabase.from("profiles").select("id, email, role, full_name, last_seen, deactivated, custom_paths").order("email");
      setUsers(updated || []);
    } catch (err) {
      setInviteMsg({ ok: false, text: err.message });
    }
    setInviting(false);
  }

  /* ── Role builder ────────────────────────────────────── */

  function togglePath(path) {
    setEditingRole(prev => {
      const has = prev.allowed_paths.includes(path);
      return {
        ...prev,
        allowed_paths: has ? prev.allowed_paths.filter(p => p !== path) : [...prev.allowed_paths, path],
      };
    });
  }

  function toggleGroup(group) {
    const paths = group.pages.map(p => p.path);
    const allChecked = paths.every(p => editingRole.allowed_paths.includes(p));
    setEditingRole(prev => ({
      ...prev,
      allowed_paths: allChecked
        ? prev.allowed_paths.filter(p => !paths.includes(p))
        : [...new Set([...prev.allowed_paths, ...paths])],
    }));
  }

  async function saveRole(e) {
    e.preventDefault();
    const name = editingRole.name.trim().toLowerCase().replace(/\s+/g, "-");
    if (!name) return;
    if (BUILTIN_ROLES.includes(name)) { alert("That name is reserved for a built-in role."); return; }
    setSavingRole(true);
    const supabase = createClient();
    const payload = { name, description: editingRole.description.trim() || null, allowed_paths: editingRole.allowed_paths };
    const { error } = editingRole.id
      ? await supabase.from("roles").update(payload).eq("id", editingRole.id)
      : await supabase.from("roles").insert(payload);
    if (error) { alert("Save failed: " + error.message); }
    else { setEditingRole(null); await refreshRoles(); }
    setSavingRole(false);
  }

  async function deleteRole(id) {
    const supabase = createClient();
    await supabase.from("roles").delete().eq("id", id);
    setDeleteRoleConfirmId(null);
    await refreshRoles();
    // Re-fetch users in case any still carry the deleted role name
    const { data } = await supabase.from("profiles").select("id, email, role, full_name, last_seen, deactivated, custom_paths").order("email");
    setUsers(data || []);
  }

  /* ── Render ──────────────────────────────────────────── */

  if (loading) return <div className="empty-state">Loading…</div>;

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
            "And so another creature found its way into the world, carrying her name a little further."
          </p>
          <button className={styles.restrictedBtn} onClick={() => router.push("/")}>Return to Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="sec-hdr">
        <h1 className={styles.title}>Admin Settings</h1>
      </div>

      {/* ── Invite ─────────────────────────────────────── */}
      <div className="sec-hdr" style={{ marginTop: 8 }}>
        <span className="sec-title">Invite Team Member</span>
      </div>

      <form onSubmit={sendInvite} style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 28 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label className="fl">Email</label>
          <input type="email" className="fi" placeholder="teammate@email.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} style={{ minWidth: 240 }} required />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label className="fl">Role</label>
          <select className="fi" value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{ minWidth: 160 }}>
            <optgroup label="Built-in">
              <option value="user">User</option>
              <option value="fulfillment">Fulfillment</option>
              <option value="finance">Finance</option>
              <option value="admin">Admin</option>
            </optgroup>
            {roles.length > 0 && (
              <optgroup label="Custom">
                {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
              </optgroup>
            )}
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

      {/* ── User table ─────────────────────────────────── */}
      <div className="sec-hdr" style={{ marginTop: 8 }}>
        <span className="sec-title">Team Access & Roles</span>
      </div>

      {users.length === 0 ? (
        <div className="empty-state">No profiles found</div>
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
                const isCustomRole = !BUILTIN_ROLES.includes(u.role);
                const hasCustomPaths = Array.isArray(u.custom_paths);
                return (
                  <tr key={u.id} style={{ opacity: u.deactivated ? 0.6 : 1 }}>
                    <td>
                      <input
                        type="text"
                        className={styles.nameInput}
                        defaultValue={u.full_name || ""}
                        placeholder="Enter name…"
                        onBlur={e => { const val = e.target.value.trim(); if (val !== (u.full_name || "")) updateFullName(u.id, val); }}
                        onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }}
                        disabled={saving === u.id}
                      />
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <select
                        className="fi"
                        style={{ maxWidth: 170, padding: "4px 8px" }}
                        value={u.role || "user"}
                        onChange={e => updateRole(u.id, e.target.value)}
                        disabled={saving === u.id}
                      >
                        <optgroup label="Built-in">
                          <option value="user">User</option>
                          <option value="fulfillment">Fulfillment</option>
                          <option value="finance">Finance</option>
                          <option value="admin">Admin</option>
                        </optgroup>
                        {roles.length > 0 && (
                          <optgroup label="Custom">
                            {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                          </optgroup>
                        )}
                      </select>
                      {isCustomRole && (
                        <div style={{ fontSize: 10, color: "var(--teal)", fontFamily: "sans-serif", marginTop: 3, letterSpacing: "0.06em" }}>
                          custom role
                        </div>
                      )}
                      {hasCustomPaths && (
                        <div style={{ fontSize: 10, color: "var(--gold)", fontFamily: "sans-serif", marginTop: 3, letterSpacing: "0.06em" }}>
                          custom access
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: 12, fontFamily: "sans-serif", color: "var(--dim)" }}>{lastSeenLabel}</td>
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
                        <div style={{ display: "flex", gap: 5 }}>
                          <button
                            className="btn sm"
                            onClick={() => { setEditingUser(u); setDeactivateConfirmId(null); }}
                            disabled={saving === u.id}
                          >
                            Edit
                          </button>
                          <button
                            className="btn sm"
                            style={{ borderColor: u.deactivated ? "var(--gold-border)" : "rgba(232,112,112,0.3)", color: u.deactivated ? "var(--gold)" : "#e87070", background: "none" }}
                            onClick={() => setDeactivateConfirmId(u.id)}
                            disabled={saving === u.id}
                          >
                            {u.deactivated ? "Activate" : "Deactivate"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Custom Role Builder ─────────────────────────── */}
      <div className="sec-hdr" style={{ marginTop: 40 }}>
        <span className="sec-title">Custom Roles</span>
        {!editingRole && (
          <button className="btn sm" onClick={() => { setEditingRole({ ...BLANK_ROLE }); setDeleteRoleConfirmId(null); }}>
            + New Role
          </button>
        )}
      </div>

      {/* Create / edit form */}
      {editingRole && (
        <form onSubmit={saveRole} style={{ marginBottom: 28, padding: "20px 20px 18px", border: "1px solid var(--gold-border)", background: "rgba(201,168,76,0.025)" }}>
          <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 160px", display: "flex", flexDirection: "column", gap: 4 }}>
              <label className="fl">Role Name</label>
              <input
                className="fi"
                value={editingRole.name}
                onChange={e => setEditingRole(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. content-editor"
                required
              />
              {editingRole.name.trim() && (
                <span style={{ fontSize: 10, color: "var(--dim)", fontFamily: "sans-serif" }}>
                  stored as: {editingRole.name.trim().toLowerCase().replace(/\s+/g, "-")}
                </span>
              )}
            </div>
            <div style={{ flex: "2 1 260px", display: "flex", flexDirection: "column", gap: 4 }}>
              <label className="fl">Description (optional)</label>
              <input
                className="fi"
                value={editingRole.description}
                onChange={e => setEditingRole(prev => ({ ...prev, description: e.target.value }))}
                placeholder="What this role is for"
              />
            </div>
          </div>

          <label className="fl" style={{ marginBottom: 14 }}>
            Page Access — {editingRole.allowed_paths.length} / {TOTAL_PAGES} selected
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(188px, 1fr))", gap: "18px 28px", marginBottom: 20 }}>
            {ALL_PAGES.map(group => {
              const paths = group.pages.map(p => p.path);
              const allChecked = paths.every(p => editingRole.allowed_paths.includes(p));
              const someChecked = !allChecked && paths.some(p => editingRole.allowed_paths.includes(p));
              return (
                <div key={group.group}>
                  <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", marginBottom: 8 }}>
                    <input
                      type="checkbox"
                      checked={allChecked}
                      ref={el => { if (el) el.indeterminate = someChecked; }}
                      onChange={() => toggleGroup(group)}
                      style={{ accentColor: "var(--gold)", width: 13, height: 13 }}
                    />
                    <span style={{ fontSize: 8, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(201,168,76,0.55)", fontFamily: "sans-serif" }}>
                      {group.group}
                    </span>
                  </label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7, paddingLeft: 4 }}>
                    {group.pages.map(page => (
                      <label key={page.path} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, fontFamily: "sans-serif", color: "var(--cream-dim)" }}>
                        <input
                          type="checkbox"
                          checked={editingRole.allowed_paths.includes(page.path)}
                          onChange={() => togglePath(page.path)}
                          style={{ accentColor: "var(--gold)", width: 13, height: 13 }}
                        />
                        {page.label}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button type="submit" className="btn gold" disabled={savingRole}>
              {savingRole ? "Saving…" : editingRole.id ? "Update Role" : "Create Role"}
            </button>
            <button type="button" className="btn" onClick={() => setEditingRole(null)}>Cancel</button>
          </div>
        </form>
      )}

      {/* Custom roles list */}
      {roles.length === 0 ? (
        <div style={{ color: "var(--dim)", fontSize: 13, fontFamily: "sans-serif", padding: "12px 0 4px" }}>
          No custom roles yet. Use the builder above to define a precise permission set.
        </div>
      ) : (
        <div className="table-wrap" style={{ marginBottom: 32 }}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Pages</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map(r => (
                <tr key={r.id}>
                  <td><span className="badge badge-gold">{r.name}</span></td>
                  <td style={{ fontSize: 12, fontFamily: "sans-serif", color: "var(--dim)" }}>{r.description || "—"}</td>
                  <td style={{ fontSize: 12, fontFamily: "sans-serif" }}>
                    <span style={{ color: "var(--cream-dim)" }}>{r.allowed_paths.length} / {TOTAL_PAGES}</span>
                    {r.allowed_paths.length > 0 && (
                      <div style={{ fontSize: 10, color: "var(--dim)", marginTop: 3, lineHeight: 1.6 }}>
                        {r.allowed_paths.join("  ·  ")}
                      </div>
                    )}
                  </td>
                  <td>
                    {deleteRoleConfirmId === r.id ? (
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="btn sm" onClick={() => setDeleteRoleConfirmId(null)}>Cancel</button>
                        <button className="btn sm" style={{ color: "#e87070", borderColor: "rgba(232,112,112,0.3)" }} onClick={() => deleteRole(r.id)}>
                          Delete
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn sm" onClick={() => { setEditingRole({ id: r.id, name: r.name, description: r.description || "", allowed_paths: [...r.allowed_paths] }); setDeleteRoleConfirmId(null); }}>
                          Edit
                        </button>
                        <button className="btn sm" style={{ color: "#e87070", borderColor: "rgba(232,112,112,0.3)" }} onClick={() => setDeleteRoleConfirmId(r.id)}>
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Edit User Modal ────────────────────────────────── */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          roles={roles}
          onSave={updated => setUsers(prev => prev.map(u => u.id === updated.id ? updated : u))}
          onClose={() => setEditingUser(null)}
        />
      )}

      {/* ── Built-in role reference ─────────────────────── */}
      <div className="sec-hdr" style={{ marginTop: 8 }}>
        <span className="sec-title">Built-in Role Permissions</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
        {[
          { role: "admin",       access: "All pages, all actions" },
          { role: "finance",     access: "P&L, Analytics, Sales — no Queue / Fulfillment" },
          { role: "fulfillment", access: "Queue, Fulfillment — no P&L or Finance" },
          { role: "user",        access: "Dashboard Hub, Creatures (read-only)" },
        ].map(r => (
          <div key={r.role} style={{ display: "flex", gap: 16, padding: "10px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--gold-border)", borderRadius: 4 }}>
            <span className="badge badge-gold" style={{ minWidth: 90, textAlign: "center" }}>{r.role}</span>
            <span style={{ fontSize: 13, color: "var(--cream-dim)", fontFamily: "sans-serif" }}>{r.access}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
