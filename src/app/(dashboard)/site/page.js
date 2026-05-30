"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveNotifSettings, insertFaq, updateFaq, deleteFaqById, swapFaqOrder } from "./actions";

const EMPTY_FAQ = { question: "", answer: "", sort_order: 0, active: true };

export default function SitePage() {
  const [notif, setNotif] = useState({ show: false, text_long: "", text_short: "", cta_label: "", cta_url: "" });
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingNotif, setSavingNotif] = useState(false);
  const [faqModal, setFaqModal] = useState(null);
  const [faqForm, setFaqForm] = useState(EMPTY_FAQ);
  const [savingFaq, setSavingFaq] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [settingsRes, faqsRes] = await Promise.all([
        supabase.from("site_settings").select("*").eq("id", 1).single(),
        supabase.from("faqs").select("*").order("sort_order"),
      ]);
      if (settingsRes.data) {
        const s = settingsRes.data;
        setNotif({
          show: s.notif_visible ?? false,
          text_long: s.notif_text || "",
          text_short: s.notif_short || "",
          cta_label: s.notif_cta_label || "",
          cta_url: s.notif_cta_url || "",
        });
      }
      setFaqs(faqsRes.data || []);
      setLoading(false);
    }
    load();
  }, []);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  async function saveNotif() {
    setSavingNotif(true);
    try {
      await saveNotifSettings(notif);
      showToast("Notification bar saved");
    } catch (e) {
      showToast("Save failed: " + e.message);
    } finally {
      setSavingNotif(false);
    }
  }

  function openAddFaq() {
    setFaqForm({ ...EMPTY_FAQ, sort_order: faqs.length + 1 });
    setFaqModal("add");
  }

  function openEditFaq(faq) {
    setFaqForm({ question: faq.question, answer: faq.answer, sort_order: faq.sort_order, active: faq.active });
    setFaqModal(faq.id);
  }

  async function saveFaq() {
    setSavingFaq(true);
    try {
      if (faqModal === "add") {
        const data = await insertFaq(faqForm);
        if (data) setFaqs(prev => [...prev, data].sort((a, b) => a.sort_order - b.sort_order));
      } else {
        await updateFaq(faqModal, faqForm);
        setFaqs(prev => prev.map(f => f.id === faqModal ? { ...f, ...faqForm } : f));
      }
      setFaqModal(null);
      showToast("FAQ saved");
    } catch (e) {
      showToast("Save failed: " + e.message);
    } finally {
      setSavingFaq(false);
    }
  }

  async function deleteFaq(id) {
    if (!confirm("Delete this FAQ?")) return;
    try {
      await deleteFaqById(id);
      setFaqs(prev => prev.filter(f => f.id !== id));
    } catch (e) {
      showToast("Delete failed: " + e.message);
    }
  }

  async function toggleFaqActive(faq) {
    try {
      await updateFaq(faq.id, { active: !faq.active });
      setFaqs(prev => prev.map(f => f.id === faq.id ? { ...f, active: !faq.active } : f));
    } catch (e) {
      showToast("Update failed: " + e.message);
    }
  }

  async function moveFaq(id, dir) {
    const idx = faqs.findIndex(f => f.id === id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= faqs.length) return;
    const a = faqs[idx];
    const b = faqs[swapIdx];
    try {
      await swapFaqOrder(a.id, a.sort_order, b.id, b.sort_order);
      const newFaqs = [...faqs];
      newFaqs[idx] = { ...a, sort_order: b.sort_order };
      newFaqs[swapIdx] = { ...b, sort_order: a.sort_order };
      setFaqs(newFaqs.sort((x, y) => x.sort_order - y.sort_order));
    } catch (e) {
      showToast("Reorder failed: " + e.message);
    }
  }

  return (
    <div>
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "var(--ink)", border: "1px solid var(--gold)", color: "var(--goldl)", fontSize: 12, letterSpacing: "0.1em", padding: "10px 20px", zIndex: 2000, whiteSpace: "nowrap", borderRadius: 3 }}>
          {toast}
        </div>
      )}

      <div className="sec-hdr">
        <h1 style={{ fontFamily: "var(--font-caveat), cursive", fontSize: "2rem", color: "var(--gold)", margin: 0 }}>Site Content</h1>
      </div>

      {/* Notification Bar */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--gold-border)", borderRadius: 8, padding: "20px 24px", marginBottom: 24 }}>
        <div className="sec-hdr" style={{ marginBottom: 16 }}>
          <span className="sec-title">Notification Bar</span>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12 }}>
            <input type="checkbox" checked={notif.show} onChange={e => setNotif(n => ({ ...n, show: e.target.checked }))} />
            <span style={{ color: "var(--cream-dim)" }}>Show on site</span>
          </label>
        </div>
        <div className="form-grid">
          <div className="form-full">
            <label className="fl">Long Text (desktop)</label>
            <input className="fi" value={notif.text_long} onChange={e => setNotif(n => ({ ...n, text_long: e.target.value }))} placeholder="New drop available — first 5 creatures are here!" />
          </div>
          <div className="form-full">
            <label className="fl">Short Text (mobile)</label>
            <input className="fi" value={notif.text_short} onChange={e => setNotif(n => ({ ...n, text_short: e.target.value }))} placeholder="New drop!" />
          </div>
          <div>
            <label className="fl">CTA Label</label>
            <input className="fi" value={notif.cta_label} onChange={e => setNotif(n => ({ ...n, cta_label: e.target.value }))} placeholder="Shop Now" />
          </div>
          <div>
            <label className="fl">CTA URL</label>
            <input className="fi" value={notif.cta_url} onChange={e => setNotif(n => ({ ...n, cta_url: e.target.value }))} placeholder="https://etsy.com/shop/CadenceCreatures" />
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <button className="btn gold" onClick={saveNotif} disabled={loading || savingNotif}>
            {savingNotif ? "Saving…" : "Save Notification Bar"}
          </button>
        </div>
      </div>

      {/* FAQs */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--gold-border)", borderRadius: 8, padding: "20px 24px" }}>
        <div className="sec-hdr" style={{ marginBottom: 16 }}>
          <span className="sec-title">FAQ Manager</span>
          <button className="btn gold" onClick={openAddFaq}>+ Add FAQ</button>
        </div>

        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : faqs.length === 0 ? (
          <div className="empty-state">No FAQs yet</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {faqs.map((faq, i) => (
              <div key={faq.id} style={{ background: "rgba(0,0,0,0.15)", border: "1px solid var(--gold-border)", borderRadius: 4, padding: "12px 14px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <button className="btn sm" style={{ padding: "2px 6px", fontSize: 10 }} onClick={() => moveFaq(faq.id, -1)} disabled={i === 0}>▲</button>
                  <button className="btn sm" style={{ padding: "2px 6px", fontSize: 10 }} onClick={() => moveFaq(faq.id, 1)} disabled={i === faqs.length - 1}>▼</button>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "var(--cream)", marginBottom: 4 }}>{faq.question}</div>
                  <div style={{ fontSize: 12, color: "var(--dim)", lineHeight: 1.4 }}>{faq.answer}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <span className={`badge ${faq.active ? "badge-green" : "badge-dim"}`}>{faq.active ? "Active" : "Hidden"}</span>
                  <button className="btn sm" onClick={() => toggleFaqActive(faq)}>{faq.active ? "Hide" : "Show"}</button>
                  <button className="btn sm" onClick={() => openEditFaq(faq)}>Edit</button>
                  <button className="btn sm" style={{ color: "#e87070", borderColor: "rgba(232,112,112,0.3)" }} onClick={() => deleteFaq(faq.id)}>Del</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {faqModal && (
        <div className="modal-bg open" onClick={e => e.target === e.currentTarget && setFaqModal(null)}>
          <div className="modal-box">
            <button className="modal-close" onClick={() => setFaqModal(null)}>×</button>
            <h2 className="modal-title">{faqModal === "add" ? "Add FAQ" : "Edit FAQ"}</h2>
            <div className="form-grid">
              <div className="form-full">
                <label className="fl">Question</label>
                <input className="fi" value={faqForm.question} onChange={e => setFaqForm(f => ({ ...f, question: e.target.value }))} />
              </div>
              <div className="form-full">
                <label className="fl">Answer</label>
                <textarea className="fi" rows={4} value={faqForm.answer} onChange={e => setFaqForm(f => ({ ...f, answer: e.target.value }))} />
              </div>
              <div>
                <label className="fl">Sort Order</label>
                <input className="fi" type="number" value={faqForm.sort_order} onChange={e => setFaqForm(f => ({ ...f, sort_order: Number(e.target.value) }))} />
              </div>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12 }}>
                  <input type="checkbox" checked={faqForm.active} onChange={e => setFaqForm(f => ({ ...f, active: e.target.checked }))} />
                  <span style={{ color: "var(--cream-dim)" }}>Active / visible on site</span>
                </label>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button className="btn gold" onClick={saveFaq} disabled={savingFaq}>{savingFaq ? "Saving…" : "Save FAQ"}</button>
              <button className="btn" onClick={() => setFaqModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
