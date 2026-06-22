"use client";

import { useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import { ALL_PAGES, BUILTIN_DEFAULTS, TOTAL_PAGES } from "./roleConfig";

export default function EditUserModal({ user, roles, onSave, onClose }) {
  const [name,        setName]        = useState(user.full_name || "");
  const [role,        setRole]        = useState(user.role || "user");
  const [useCustom,   setUseCustom]   = useState(Array.isArray(user.custom_paths));
  const [customPaths, setCustomPaths] = useState(Array.isArray(user.custom_paths) ? user.custom_paths : []);
  const [saving,      setSaving]      = useState(false);

  function getPathsForRole(r) {
    const customRole = roles.find(cr => cr.name === r);
    if (customRole) return customRole.allowed_paths || [];
    return BUILTIN_DEFAULTS[r] || [];
  }

  function handleEnableCustom(enable) {
    setUseCustom(enable);
    if (enable && !Array.isArray(user.custom_paths)) {
      setCustomPaths(getPathsForRole(role));
    }
  }

  function togglePath(path) {
    setCustomPaths(prev =>
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    );
  }

  function toggleGroup(group) {
    const paths = group.pages.map(p => p.path);
    const allOn = paths.every(p => customPaths.includes(p));
    setCustomPaths(prev =>
      allOn ? prev.filter(p => !paths.includes(p)) : [...new Set([...prev, ...paths])]
    );
  }

  async function save() {
    setSaving(true);
    const supabase = createClient();
    const payload = {
      full_name:    name.trim() || null,
      role,
      custom_paths: useCustom ? customPaths : null,
    };
    const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
    if (error) {
      alert("Save failed: " + error.message);
      setSaving(false);
      return;
    }
    onSave({ ...user, ...payload });
    onClose();
  }

  return (
    <div
      className="modal-bg open"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-box" style={{ maxWidth: 760 }}>
        <button className="modal-close" onClick={onClose} type="button">×</button>
        <h2 className="modal-title">Edit User</h2>
        <p style={{ fontSize: 12, fontFamily: "sans-serif", color: "var(--dim)", marginTop: -6, marginBottom: 20 }}>
          {user.email}
        </p>

        {/* Name + Role */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 200px", display: "flex", flexDirection: "column", gap: 4 }}>
            <label className="fl">Display Name</label>
            <input
              className="fi"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter name…"
            />
          </div>
          <div style={{ flex: "0 1 180px", display: "flex", flexDirection: "column", gap: 4 }}>
            <label className="fl">Role</label>
            <select className="fi" value={role} onChange={e => setRole(e.target.value)}>
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
        </div>

        {/* Page access */}
        <div style={{ border: "1px solid var(--gold-border)", padding: "16px 18px", background: "rgba(201,168,76,0.02)", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: useCustom ? 16 : 0, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(201,168,76,0.55)", fontFamily: "sans-serif" }}>
              Page Access
            </span>
            <div style={{ display: "flex", border: "1px solid var(--gold-border)", borderRadius: 3, overflow: "hidden" }}>
              {[{ label: "Role Defaults", val: false }, { label: "Custom", val: true }].map(opt => (
                <button
                  key={String(opt.val)}
                  type="button"
                  onClick={() => handleEnableCustom(opt.val)}
                  style={{
                    padding: "5px 13px",
                    fontSize: 10,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    fontFamily: "sans-serif",
                    border: "none",
                    cursor: "pointer",
                    background: useCustom === opt.val ? "var(--gold)" : "transparent",
                    color:      useCustom === opt.val ? "var(--ink)" : "var(--dim)",
                    transition: "background 0.15s, color 0.15s",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {useCustom && (
              <>
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => setCustomPaths(getPathsForRole(role))}
                  style={{ fontSize: 10 }}
                >
                  Load role defaults
                </button>
                <span style={{ fontSize: 11, fontFamily: "sans-serif", color: "var(--dim)", marginLeft: "auto" }}>
                  {customPaths.length} / {TOTAL_PAGES}
                </span>
              </>
            )}
          </div>

          {!useCustom && (
            <p style={{ fontSize: 12, fontFamily: "sans-serif", color: "var(--dim)", margin: 0 }}>
              Access is determined by the <strong style={{ color: "var(--goldl)" }}>{role}</strong> role.
            </p>
          )}

          {useCustom && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(176px, 1fr))", gap: "16px 24px" }}>
              {ALL_PAGES.map(group => {
                const paths  = group.pages.map(p => p.path);
                const allOn  = paths.every(p => customPaths.includes(p));
                const someOn = !allOn && paths.some(p => customPaths.includes(p));
                return (
                  <div key={group.group}>
                    <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", marginBottom: 8 }}>
                      <input
                        type="checkbox"
                        checked={allOn}
                        ref={el => { if (el) el.indeterminate = someOn; }}
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
                            checked={customPaths.includes(page.path)}
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
          )}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn gold" onClick={save} disabled={saving} type="button">
            {saving ? "Saving…" : "Save Changes"}
          </button>
          <button className="btn" onClick={onClose} type="button">Cancel</button>
        </div>
      </div>
    </div>
  );
}
