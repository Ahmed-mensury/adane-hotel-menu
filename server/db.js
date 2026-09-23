// db.js
// Tiny file-based JSON database. Good fit for a single-location restaurant
// menu (a few hundred items, occasional writes from the admin panel).
// Everything is stored in server/data/db.json and read/written atomically.
const fs = require("fs");
const path = require("path");

const DB_FILE = path.join(__dirname, "data", "db.json");
const SEED_MENU_FILE = path.join(__dirname, "data", "menu_seed.json");

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

function ensureDb() {
  if (!fs.existsSync(DB_FILE)) {
    const data = defaultData();
    if (fs.existsSync(SEED_MENU_FILE)) {
      const seedItems = JSON.parse(fs.readFileSync(SEED_MENU_FILE, "utf-8"));
      data.items = seedItems;
      data.categories = [...new Set(seedItems.map((i) => i.category))].map(
        (name, idx) => ({ id: idx + 1, name, order: idx })
      );
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  }
}

function read() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
}

function write(data) {
  // Write to a temp file then rename, so a crash mid-write can't corrupt db.json
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

module.exports = { read, write, ensureDb, DB_FILE };
