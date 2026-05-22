const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = envFile.split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key && val) acc[key.trim()] = val.trim();
  return acc;
}, {});

// We will use service role to create a temporary test user first
const supabaseAdmin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function testRLS() {
  const testEmail = `tester_${Date.now()}@cadencecreatures.com`;
  const testPassword = "superSecurePassword123!";

  console.log(`Creating a temporary user: ${testEmail}...`);
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true
  });

  if (authError) {
    console.error("User creation failed:", authError);
    return;
  }

  const user = authData.user;
  console.log(`Created user with ID: ${user.id}`);

  // Initialize a client as the authenticated test user
  const supabaseUser = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  
  console.log("Signing in as the test user...");
  const { data: sessionData, error: signInError } = await supabaseUser.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });

  if (signInError) {
    console.error("Sign in failed:", signInError);
    // Cleanup user
    await supabaseAdmin.auth.admin.deleteUser(user.id);
    return;
  }

  console.log("Sign in successful!");
  
  // Try to read printers table
  console.log("Reading printers table...");
  const { data: printers, error: selectError } = await supabaseUser.from('printers').select('*');
  if (selectError) {
    console.error("SELECT error:", selectError);
  } else {
    console.log("SELECT success! Printers found:", printers);
  }

  // Try to update the first printer
  if (printers && printers.length > 0) {
    const printer = printers[0];
    console.log(`Trying to update printer '${printer.name}'...`);
    const { data: updated, error: updateError } = await supabaseUser
      .from('printers')
      .update({ name: printer.name + " (Auth Test)" })
      .eq('id', printer.id)
      .select();
    
    if (updateError) {
      console.error("UPDATE error:", updateError);
    } else {
      console.log("UPDATE success!", updated);
      
      // Revert change using admin client
      await supabaseAdmin.from('printers').update({ name: printer.name }).eq('id', printer.id);
      console.log("Reverted updated printer name.");
    }
  } else {
    console.log("No printers found in DB to test update on.");
  }

  // Cleanup
  console.log("Cleaning up test user...");
  await supabaseAdmin.auth.admin.deleteUser(user.id);
  console.log("Done.");
}

testRLS();
