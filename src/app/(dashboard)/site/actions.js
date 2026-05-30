"use server";
import { createClient } from "@/lib/supabase/server";

export async function saveNotifSettings({ show, text_long, text_short, cta_label, cta_url }) {
  const supabase = await createClient();
  const { error } = await supabase.from("site_settings").update({
    notif_visible: show,
    notif_text: text_long,
    notif_short: text_short,
    notif_cta_label: cta_label,
    notif_cta_url: cta_url,
  }).eq("id", 1);
  if (error) throw new Error(error.message);
}

export async function insertFaq(faq) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("faqs").insert(faq).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateFaq(id, faq) {
  const supabase = await createClient();
  const { error } = await supabase.from("faqs").update(faq).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteFaqById(id) {
  const supabase = await createClient();
  const { error } = await supabase.from("faqs").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function swapFaqOrder(idA, orderA, idB, orderB) {
  const supabase = await createClient();
  const [r1, r2] = await Promise.all([
    supabase.from("faqs").update({ sort_order: orderB }).eq("id", idA),
    supabase.from("faqs").update({ sort_order: orderA }).eq("id", idB),
  ]);
  if (r1.error) throw new Error(r1.error.message);
  if (r2.error) throw new Error(r2.error.message);
}
