// db.js
// Persistent storage backed by Supabase: one Postgres table ("app_state")
// holds the whole app's data as a single JSON document, and Supabase
// Storage holds uploaded photos. Using one JSON document keeps read()/write()
// shaped exactly like the old local-file version, so the rest of the app
// (routes/*.js) barely had to change — they just now `await` these calls.
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const SEED_MENU_FILE = path.join(__dirname, "data", "menu_seed.json");
const ROW_ID = 1;
const BUCKET = "menu-photos";

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error(
    "\nMissing SUPABASE_URL or SUPABASE_SERVICE_KEY in your .env file.\n" +
      "See the README's 'Set up Supabase' section for how to get these.\n"
  );
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

function defaultData() {
  return {
    admins: [],
    items: [],
    categories: [],
    settings: {
      hotelName: "Adane International Hotel",
      tagline: "A Premium Digital Dining Experience",
      vatNote: "All prices are inclusive of 15% VAT and 10% Service Charge",
      phone: "",
      address: "",
      currency: "ETB"
    }
  };
}

// Creates the one app_state row, seeded with the original menu, if it
// doesn't exist yet. Safe to call every time the server starts.
async function ensureDb() {
  const { data: row, error } = await supabase
    .from("app_state")
    .select("data")
    .eq("id", ROW_ID)
    .maybeSingle();
  if (error) throw new Error(`Supabase read failed: ${error.message}`);
  if (row) return; // already set up

  const data = defaultData();
  if (fs.existsSync(SEED_MENU_FILE)) {
    const seedItems = JSON.parse(fs.readFileSync(SEED_MENU_FILE, "utf-8"));
    data.items = seedItems;
    data.categories = [...new Set(seedItems.map((i) => i.category))].map((name, idx) => ({
      id: idx + 1,
      name,
      order: idx
    }));
  }
  const { error: insertErr } = await supabase.from("app_state").insert({ id: ROW_ID, data });
  if (insertErr) throw new Error(`Supabase setup failed: ${insertErr.message}`);
}

async function read() {
  const { data: row, error } = await supabase
    .from("app_state")
    .select("data")
    .eq("id", ROW_ID)
    .single();
  if (error) throw new Error(`Supabase read failed: ${error.message}`);
  return row.data;
}

async function write(data) {
  const { error } = await supabase
    .from("app_state")
    .update({ data, updated_at: new Date().toISOString() })
    .eq("id", ROW_ID);
  if (error) throw new Error(`Supabase write failed: ${error.message}`);
  return data;
}

// Uploads an already-processed image buffer to Supabase Storage and
// returns its public URL. This is what makes photos survive restarts,
// redeploys, and idle spin-downs — they're no longer on local disk at all.
async function uploadPhoto(buffer, filename, contentType) {
  const { error } = await supabase.storage.from(BUCKET).upload(filename, buffer, {
    contentType,
    upsert: false
  });
  if (error) throw new Error(`Supabase Storage upload failed: ${error.message}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

module.exports = { read, write, ensureDb, uploadPhoto };
