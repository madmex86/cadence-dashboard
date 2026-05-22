const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = envFile.split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key && val) acc[key.trim()] = val.trim();
  return acc;
}, {});

async function runTests() {
  console.log("=== DB Printers CRUD Diagnostic ===");
  
  const anonClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const serviceClient = env.SUPABASE_SERVICE_ROLE_KEY ? createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY) : null;
  
  if (serviceClient) {
    console.log("1. Fetching printers with Service Client...");
    const { data: svcData, error: svcErr } = await serviceClient.from("printers").select("*");
    if (svcErr) console.error("   ❌ Service select error:", svcErr.message);
    else console.log("   ✅ Service select OK. Found rows:", svcData.length);
    
    console.log("2. Inserting a test printer with Service Client...");
    const { data: newPrinter, error: insErr } = await serviceClient.from("printers").insert({
      name: "Diag Test Printer",
      type: "Bambu Lab P1S",
      status: "idle",
      ip_address: "192.168.1.100"
    }).select().single();
    
    if (insErr) {
      console.error("   ❌ Service insert error:", insErr.message);
      return;
    }
    console.log("   ✅ Service insert OK. New printer ID:", newPrinter.id);
    
    console.log("3. Updating the test printer with Service Client...");
    const { data: updatedPrinter, error: updErr } = await serviceClient.from("printers").update({
      name: "Diag Test Printer Edited",
      ip_address: "192.168.1.101"
    }).eq("id", newPrinter.id).select().single();
    
    if (updErr) {
      console.error("   ❌ Service update error:", updErr.message);
    } else {
      console.log("   ✅ Service update OK. Updated printer name:", updatedPrinter.name);
    }
    
    console.log("4. Cleaning up test printer...");
    const { error: delErr } = await serviceClient.from("printers").delete().eq("id", newPrinter.id);
    if (delErr) console.error("   ❌ Service delete error:", delErr.message);
    else console.log("   ✅ Service delete OK");
  } else {
    console.log("No Service Key found in .env.local!");
  }
}

runTests();
