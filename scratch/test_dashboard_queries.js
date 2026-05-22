const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = envFile.split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key && val) acc[key.trim()] = val.trim();
  return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function testQueries() {
  console.log("=== DIAGNOSTIC QUERY SWEEP ===");

  // 1. Test customers page queries
  console.log("\n--- Testing customers/page.js Queries ---");
  
  const { error: errOrders } = await supabase
    .from("orders")
    .select("id, buyer_name, buyer_email, items, total_amount, status, order_date, created_at, etsy_order_id")
    .limit(1);
  if (errOrders) console.log("❌ orders query error:", errOrders.message);
  else console.log("✅ orders query: OK");

  const { error: errSubs } = await supabase
    .from("subscribers")
    .select("id, email, first_name, last_name, source, subscribed, created_at")
    .limit(1);
  if (errSubs) console.log("❌ subscribers query error:", errSubs.message);
  else console.log("✅ subscribers query: OK");

  const { error: errContacts } = await supabase
    .from("contact_submissions")
    .select("id, name, email, topic, message, order_number, is_read, created_at")
    .limit(1);
  if (errContacts) console.log("❌ contact_submissions query error:", errContacts.message);
  else console.log("✅ contact_submissions query: OK");

  // 2. Test reviews page queries
  console.log("\n--- Testing reviews/page.js Queries ---");
  const { error: errReviews } = await supabase
    .from("reviews")
    .select("id, creature_id, author, location, rating, body, is_verified, is_active, created_at, creatures(name)")
    .limit(1);
  if (errReviews) console.log("❌ reviews query error:", errReviews.message);
  else console.log("✅ reviews query: OK");

  // 3. Test site_settings queries
  console.log("\n--- Testing site/page.js Queries ---");
  const { error: errSite } = await supabase
    .from("site_settings")
    .select("id, notif_text, notif_short, notif_cta_label, notif_cta_url, notif_visible, updated_at, links_config, cami_portal_enabled")
    .limit(1);
  if (errSite) console.log("❌ site_settings query error:", errSite.message);
  else console.log("✅ site_settings query: OK");

  // 4. Test mileage queries
  console.log("\n--- Testing mileage/page.js Queries ---");
  const { error: errMileage } = await supabase
    .from("mileage")
    .select("id, created_at")
    .limit(1);
  if (errMileage) console.log("❌ mileage query error:", errMileage.message);
  else console.log("✅ mileage query: OK");

  // 5. Test printers queries
  console.log("\n--- Testing printers/page.js Queries ---");
  const { error: errPrinters } = await supabase
    .from("printers")
    .select("id, created_at, name, status")
    .limit(1);
  if (errPrinters) console.log("❌ printers query error:", errPrinters.message);
  else console.log("✅ printers query: OK");
}

testQueries();
