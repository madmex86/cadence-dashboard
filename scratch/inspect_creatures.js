const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Manually parse .env.local
const envPath = path.join(__dirname, "../.env.local");
let supabaseUrl = "";
let supabaseKey = "";

if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  lines.forEach(line => {
    const match = line.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      
      if (key === "NEXT_PUBLIC_SUPABASE_URL") supabaseUrl = value;
      if (key === "SUPABASE_SERVICE_ROLE_KEY" || key === "NEXT_PUBLIC_SUPABASE_ANON_KEY") {
        if (!supabaseKey || key === "SUPABASE_SERVICE_ROLE_KEY") {
          supabaseKey = value;
        }
      }
    }
  });
}

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local or environment.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const { data, error } = await supabase
    .from("creatures")
    .select("name, print_recipe")
    .eq("active", true);

  if (error) {
    console.error("Error fetching creatures:", error);
    return;
  }

  console.log("Found active creatures:", data.length);
  data.forEach(c => {
    console.log(`\n================= ${c.name} =================`);
    console.log("Raw print_recipe Type:", typeof c.print_recipe);
    console.log("Raw Value:", c.print_recipe);
    try {
      let parsed = c.print_recipe;
      if (typeof parsed === "string") {
        parsed = JSON.parse(parsed);
        if (typeof parsed === "string") {
          parsed = JSON.parse(parsed);
        }
      }
      console.log("Parsed Structure:", JSON.stringify(parsed, null, 2));
    } catch (err) {
      console.error("Failed to parse print_recipe:", err.message);
    }
  });
}

inspect();
