const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = envFile.split('\n').reduce((acc, line) => {
  const [key, val] = line.split('=');
  if (key && val) acc[key.trim()] = val.trim();
  return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function testUpdate() {
  console.log("Updating printer type...");
  const { data, error } = await supabase
    .from('printers')
    .update({ type: 'Bambu Lab X1C' })
    .eq('id', 'a02d2814-2d78-48a5-ab8e-a0ec8a35df4d')
    .select();
  
  if (error) {
    console.error("Update type error:", error);
  } else {
    console.log("Update type success!", data);
  }

  console.log("Updating printer model...");
  const { data: data2, error: error2 } = await supabase
    .from('printers')
    .update({ model: 'Bambu Lab P1S' })
    .eq('id', 'a02d2814-2d78-48a5-ab8e-a0ec8a35df4d')
    .select();
  
  if (error2) {
    console.error("Update model error:", error2);
  } else {
    console.log("Update model success!", data2);
  }
}

testUpdate();
