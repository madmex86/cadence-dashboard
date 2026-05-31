"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const EMPTY = { creature_id: "", author: "", location: "", rating: 5, body: "", is_verified: false, is_active: true };

function StarPicker({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: n <= value ? "#E8D08A" : "rgba(201,168,76,0.2)", padding: 0, lineHeight: 1 }}
        >★</button>
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [creatures, setCreatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all");
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [rRes, cRes] = await Promise.all([
        supabase.from("reviews").select("*, creatures(name)").order("created_at", { ascending: false }),
        supabase.from("creatures").select("id, name").eq("active", true).order("log_number"),
      ]);
      setReviews(rRes.data || []);
      setCreatures(cRes.data || []);
      setLoading(false);
    }
    load();
  }, []);

  function openAdd() {
    setForm(EMPTY);
    setModal("add");
  }

  function openEdit(r) {
    setForm({
      creature_id: r.creature_id || "",
      author: r.author || "",
      location: r.location || "",
      rating: r.rating || 5,
      body: r.body || "",
      is_verified: r.is_verified || false,
      is_active: r.is_active !== false,
    });
    setModal(r.id);
  }

  async function save() {
    setSaving(true);
    const supabase = createClient();
    const payload = { ...form, rating: Number(form.rating) };
    if (modal === "add") {
      const { data } = await supabase.from("reviews").insert(payload).select("*, creatures(name)").single();
      if (data) setReviews(prev => [data, ...prev]);
    } else {
      await supabase.from("reviews").update(payload).eq("id", modal);
      setReviews(prev => prev.map(r => r.id === modal ? { ...r, ...payload } : r));
    }
    setSaving(false);
    setModal(null);
  }

  async function deleteReview(id) {
    const supabase = createClient();
    await supabase.from("reviews").delete().eq("id", id);
    setReviews(prev => prev.filter(r => r.id !== id));
    setDeleteConfirmId(null);
  }

  async function togglePublished(r) {
    const supabase = createClient();
    const newVal = !r.is_active;
    await supabase.from("reviews").update({ is_active: newVal }).eq("id", r.id);
    setReviews(prev => prev.map(x => x.id === r.id ? { ...x, is_active: newVal } : x));
  }

  const total = reviews.length;
  const published = reviews.filter(r => r.is_active).length;
  const verified = reviews.filter(r => r.is_verified).length;
  const avgRating = total ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / total).toFixed(1) : "—";

  const filtered = reviews.filter(r => {
    if (filter === "published") return r.is_active;
    if (filter === "pending") return !r.is_active;
    if (filter === "verified") return r.is_verified;
    return true;
  });

  return (
    <div>
      <div className="sec-hdr">
        <h1 style={{ fontFamily: "var(--font-caveat), cursive", fontSize: "2rem", color: "var(--gold)", margin: 0 }}>Review Forge</h1>
        <button className="btn gold" onClick={openAdd}>+ Add Review</button>
      </div>

      <div className="kpi-grid">
        <div className="kpi"><div className="kpi-label">Total</div><div className="kpi-val">{total}</div></div>
        <div className="kpi"><div className="kpi-label">Published</div><div className="kpi-val">{published}</div></div>
        <div className="kpi"><div className="kpi-label">Pending</div><div className="kpi-val">{total - published}</div></div>
        <div className="kpi"><div className="kpi-label">Avg Rating</div><div className="kpi-val">{avgRating} ★</div></div>
        <div className="kpi"><div className="kpi-label">Verified</div><div className="kpi-val">{verified}</div></div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["all", "published", "pending", "verified"].map(f => (
          <button key={f} className={`btn sm${filter === f ? " gold" : ""}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">No reviews found</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rating</th>
                <th>Creature</th>
                <th>Author</th>
                <th>Review</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td style={{ color: "#E8D08A", fontFamily: "sans-serif" }}>
                    {"★".repeat(r.rating || 0)}{"☆".repeat(5 - (r.rating || 0))}
                  </td>
                  <td style={{ color: "var(--goldl)" }}>{r.creatures?.name || "—"}</td>
                  <td>
                    <div>{r.author || "—"}</div>
                    {r.location && <div style={{ fontSize: 11, color: "var(--dim)", fontFamily: "sans-serif" }}>{r.location}</div>}
                  </td>
                  <td style={{ maxWidth: 280 }}>
                    <div style={{ fontSize: 12, lineHeight: 1.4, color: "var(--cream-dim)", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {r.body || "—"}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <span className={`badge ${r.is_active ? "badge-green" : "badge-dim"}`}>
                        {r.is_active ? "Published" : "Pending"}
                      </span>
                      {r.is_verified && <span className="badge badge-gold">Verified</span>}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn sm" onClick={() => togglePublished(r)}>
                        {r.is_active ? "Unpublish" : "Publish"}
                      </button>
                      <button className="btn sm" onClick={() => openEdit(r)}>Edit</button>
                      {deleteConfirmId === r.id ? (
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="btn sm" onClick={() => setDeleteConfirmId(null)}>Cancel</button>
                          <button className="btn sm" style={{ color: "#e87070", borderColor: "rgba(232,112,112,0.3)" }} onClick={() => deleteReview(r.id)}>Confirm</button>
                        </div>
                      ) : (
                        <button className="btn sm" style={{ color: "#e87070", borderColor: "rgba(232,112,112,0.3)" }} onClick={() => setDeleteConfirmId(r.id)}>Del</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="modal-bg open" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal-box">
            <button className="modal-close" onClick={() => setModal(null)}>×</button>
            <h2 className="modal-title">{modal === "add" ? "Add Review" : "Edit Review"}</h2>
            <div className="form-grid">
              <div>
                <label className="fl">Creature</label>
                <select className="fi" value={form.creature_id} onChange={e => setForm(f => ({ ...f, creature_id: e.target.value }))}>
                  <option value="">— select —</option>
                  {creatures.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="fl">Rating</label>
                <StarPicker value={form.rating} onChange={v => setForm(f => ({ ...f, rating: v }))} />
              </div>
              <div>
                <label className="fl">Author</label>
                <input className="fi" value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} />
              </div>
              <div>
                <label className="fl">Location</label>
                <input className="fi" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
              </div>
              <div className="form-full">
                <label className="fl">Review Body</label>
                <textarea className="fi" rows={4} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} />
              </div>
              <div style={{ display: "flex", gap: 20 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12 }}>
                  <input type="checkbox" checked={form.is_verified} onChange={e => setForm(f => ({ ...f, is_verified: e.target.checked }))} />
                  <span style={{ color: "var(--cream-dim)" }}>Verified purchase</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12 }}>
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                  <span style={{ color: "var(--cream-dim)" }}>Published</span>
                </label>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button className="btn gold" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Review"}</button>
              <button className="btn" onClick={() => setModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
