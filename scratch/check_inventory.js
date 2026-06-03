require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const { data: orders } = await supabase.from("orders").select("*");
  console.log("Orders:", JSON.stringify(orders, null, 2));

  const { data: creatures } = await supabase.from("creatures").select("id, name, qty_on_hand");
  console.log("Creatures:", JSON.stringify(creatures, null, 2));
}

check();
