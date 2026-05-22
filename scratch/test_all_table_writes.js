const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = envFile.split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key && val) acc[key.trim()] = val.trim();
  return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function testWrites() {
  console.log("=== DIAGNOSTIC WRITE PERMISSIONS SWEEP ===");

  const tests = [
    {
      name: "settings",
      op: () => supabase.from("settings").insert({ key: "diag_test", value: "test" }),
      cleanup: () => supabase.from("settings").delete().eq("key", "diag_test")
    },
    {
      name: "creatures",
      op: () => supabase.from("creatures").insert({ name: "Diag Dragon", slug: "diag-dragon", species: "Dragon", environment: "Fantasy", price_retail: 25, price_etsy: 30, log_number: 9999 }),
      cleanup: () => supabase.from("creatures").delete().eq("slug", "diag-dragon")
    },
    {
      name: "inventory",
      op: () => supabase.from("inventory").insert({ spool_name: "Diag Spool", brand: "Polymaker", hex_color: "#FFFFFF", color: "White", cost_per_spool: 25 }),
      cleanup: () => supabase.from("inventory").delete().eq("spool_name", "Diag Spool")
    },
    {
      name: "orders",
      op: () => supabase.from("orders").insert({ buyer_name: "Diag Buyer", buyer_email: "diag@test.com", items: ["Diag Item"], status: "queued", total_amount: 30 }),
      cleanup: () => supabase.from("orders").delete().eq("buyer_name", "Diag Buyer")
    },
    {
      name: "finance",
      op: () => supabase.from("finance").insert({ entry_type: "income", category: "Sale", amount: 30, entry_date: new Date().toISOString().split('T')[0], description: "Diag Finance" }),
      cleanup: () => supabase.from("finance").delete().eq("description", "Diag Finance")
    },
    {
      name: "printers",
      op: () => supabase.from("printers").insert({ name: "Diag Printer", status: "idle" }),
      cleanup: () => supabase.from("printers").delete().eq("name", "Diag Printer")
    },
    {
      name: "reviews",
      op: () => supabase.from("reviews").insert({ author: "Diag Author", rating: 5, body: "Diag Review", is_verified: true, is_active: false }),
      cleanup: () => supabase.from("reviews").delete().eq("author", "Diag Author")
    },
    {
      name: "contact_submissions",
      op: () => supabase.from("contact_submissions").insert({ name: "Diag Submitter", email: "diag@test.com", topic: "Diag topic", message: "Diag message" }),
      cleanup: () => supabase.from("contact_submissions").delete().eq("name", "Diag Submitter")
    },
    {
      name: "subscribers",
      op: () => supabase.from("subscribers").insert({ email: "diag_sub@test.com", source: "landing_page", subscribed: true }),
      cleanup: () => supabase.from("subscribers").delete().eq("email", "diag_sub@test.com")
    },
    {
      name: "mileage",
      op: () => supabase.from("mileage").insert({ purpose: "Diag Mileage", miles: 10, date: new Date().toISOString().split('T')[0] }),
      cleanup: () => supabase.from("mileage").delete().eq("purpose", "Diag Mileage")
    },
    {
      name: "email_templates",
      op: () => supabase.from("email_templates").insert({ name: "Diag Template", subject: "Diag Subject", body: "Diag Body" }),
      cleanup: () => supabase.from("email_templates").delete().eq("name", "Diag Template")
    },
    {
      name: "profiles",
      op: () => supabase.from("profiles").insert({ id: "00000000-0000-0000-0000-000000000000", email: "diag_prof@test.com", role: "user", full_name: "Diag Profile" }),
      cleanup: () => supabase.from("profiles").delete().eq("email", "diag_prof@test.com")
    }
  ];

  for (const t of tests) {
    const { data, error } = await t.op();
    if (error) {
      console.log(`❌ Table '${t.name}': WRITE ERROR - ${error.message}`);
    } else {
      console.log(`✅ Table '${t.name}': WRITE OK`);
      // Run cleanup
      const { error: cleanErr } = await t.cleanup();
      if (cleanErr) {
        console.log(`   ⚠️ Cleanup error for '${t.name}': ${cleanErr.message}`);
      }
    }
  }
}

testWrites();
