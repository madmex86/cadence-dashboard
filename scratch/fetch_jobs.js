const url = "https://ufqiysdgmxrhonnfsgts.supabase.co/rest/v1/video_jobs?select=*&order=created_at.desc&limit=3";
const key = "sb_publishable_7mkBL1lsKUNJEmqSd2HT9Q_Z4xHoBec";

fetch(url, {
  headers: {
    "apikey": key,
    "Authorization": `Bearer ${key}`
  }
}).then(r => r.json()).then(data => {
  console.log(JSON.stringify(data, null, 2));
}).catch(console.error);
