const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = envFile.split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key && val) acc[key.trim()] = val.trim();
  return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function testSignup() {
  const email = `test_user_${Date.now()}@cadencecreatures.com`;
  const password = "Password123!";
  console.log(`Signing up ${email}...`);
  const res = await supabase.auth.signUp({ email, password });
  console.log("Signup response:", JSON.stringify(res, null, 2));
}

testSignup();
