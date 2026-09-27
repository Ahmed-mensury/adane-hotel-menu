// routes/admin.js — everything here requires a valid admin session (see server.js)
const express = require("express");
const router = express.Router();
const multer = require("multer");
const sharp = require("sharp");
const crypto = require("crypto");
const db = require("../db");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB max upload
  fileFilter: (req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
    cb(ok ? null : new Error("Only JPG, PNG or WEBP images are allowed"), ok);
  }
});

// ---------- Dashboard summary ----------
router.get("/summary", async (req, res) => {
  try {
    const data = await db.read();
    res.json({
      totalItems: data.items.length,
      availableItems: data.items.filter((i) => i.available).length,
      hiddenItems: data.items.filter((i) => !i.available).length,
      totalCategories: data.categories.length,
      admin: req.admin.email
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load the dashboard summary." });
  }
});

// ---------- Categories ----------
router.get("/categories", async (req, res) => {
  try {
    const data = await db.read();
    res.json(data.categories.sort((a, b) => a.order - b.order));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load categories." });
  }
});

router.post("/categories", async (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "Category name is required" });
  try {
    const data = await db.read();
    if (data.categories.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())) {
      return res.status(400).json({ error: "That category already exists" });
    }
    const cat = { id: Date.now(), name: name.trim(), order: data.categories.length };
    data.categories.push(cat);
    await db.write(data);
    res.json(cat);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not save the category." });
  }
});

router.put("/categories/:id", async (req, res) => {
  try {
    const data = await db.read();
    const cat = data.categories.find((c) => c.id === Number(req.params.id));
    if (!cat) return res.status(404).json({ error: "Category not found" });
    const oldName = cat.name;
    if (req.body.name) cat.name = req.body.name.trim();
    if (typeof req.body.order === "number") cat.order = req.body.order;
    if (req.body.name && req.body.name.trim() !== oldName) {
      data.items.forEach((i) => {
        if (i.category === oldName) i.category = cat.name;
      });
    }
    await db.write(data);
    res.json(cat);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update the category." });
  }
});

router.delete("/categories/:id", async (req, res) => {
  try {
    const data = await db.read();
    const cat = data.categories.find((c) => c.id === Number(req.params.id));
    if (!cat) return res.status(404).json({ error: "Category not found" });
    const inUse = data.items.some((i) => i.category === cat.name);
    if (inUse) {
      return res.status(400).json({ error: "Move or delete the items in this category first" });
    }
    data.categories = data.categories.filter((c) => c.id !== cat.id);
    await db.write(data);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete the category." });
  }
});

// ---------- Menu items ----------
router.get("/items", async (req, res) => {
  try {
    const data = await db.read();
    res.json(data.items.sort((a, b) => a.id - b.id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load menu items." });
  }
});

router.post("/items", async (req, res) => {
  const { name, category, price, description, image, available } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "Item name is required" });
  if (!category) return res.status(400).json({ error: "Category is required" });
  const priceNum = Number(price);
  if (!Number.isFinite(priceNum) || priceNum < 0) {
    return res.status(400).json({ error: "Price must be a valid positive number" });
  }
  try {
    const data = await db.read();
    const item = {
      id: Date.now(),
      name: name.trim(),
      category,
      price: priceNum,
      description: (description || "").trim(),
      image: image || "",
      available: available !== false,
      popular: !!req.body.popular
    };
    data.items.push(item);
    await db.write(data);
    res.json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not save the new item." });
  }
});

router.put("/items/:id", async (req, res) => {
  try {
    const data = await db.read();
    const item = data.items.find((i) => i.id === Number(req.params.id));
    if (!item) return res.status(404).json({ error: "Item not found" });
    const { name, category, price, description, image, available, popular } = req.body || {};
    if (name !== undefined) item.name = name.trim();
    if (category !== undefined) item.category = category;
    if (price !== undefined) {
      const priceNum = Number(price);
      if (!Number.isFinite(priceNum) || priceNum < 0) {
        return res.status(400).json({ error: "Price must be a valid positive number" });
      }
      item.price = priceNum;
    }
    if (description !== undefined) item.description = description.trim();
    if (image !== undefined) item.image = image;
    if (available !== undefined) item.available = !!available;
    if (popular !== undefined) item.popular = !!popular;
    await db.write(data);
    res.json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update the item." });
  }
});

router.delete("/items/:id", async (req, res) => {
  try {
    const data = await db.read();
    const before = data.items.length;
    data.items = data.items.filter((i) => i.id !== Number(req.params.id));
    if (data.items.length === before) return res.status(404).json({ error: "Item not found" });
    await db.write(data);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete the item." });
  }
});

// ---------- Image upload ----------
// Resizes/optimizes the photo, then uploads it to Supabase Storage (not
// local disk), so it survives restarts, redeploys, and idle spin-downs.
router.post("/upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image file received" });
    const optimized = await sharp(req.file.buffer).resize(900, 700, { fit: "cover" }).webp({ quality: 78 }).toBuffer();
    const filename = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}.webp`;
    const url = await db.uploadPhoto(optimized, filename, "image/webp");
    res.json({ url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Image upload failed. Try a different image." });
  }
});

// ---------- Bulk image upload ----------
// Lets a manager upload many photos at once. Each file is matched to a menu
// item by its filename (e.g. "Beef Burger.jpg" matches the item "Beef Burger").
// Unmatched files are reported back so nothing silently fails.
function normalizeForMatch(s) {
  return s
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "") // strip extension
    .replace(/[_-]+/g, " ")
    .replace(/[^\p{L}\p{N} ]+/gu, "") // strip punctuation, keep letters/numbers/spaces (unicode-aware)
    .replace(/\s+/g, " ")
    .trim();
}

router.post("/bulk-upload", upload.array("images", 60), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No image files received" });
  }
  try {
    const data = await db.read();
    const matched = [];
    const unmatched = [];

    const byName = new Map();
    data.items.forEach((it) => byName.set(normalizeForMatch(it.name), it));

    for (const file of req.files) {
      const key = normalizeForMatch(file.originalname);
      let item = byName.get(key);

      if (!item) {
        item = data.items.find((it) => {
          const n = normalizeForMatch(it.name);
          return n.includes(key) || key.includes(n);
        });
      }

      if (!item) {
        unmatched.push(file.originalname);
        continue;
      }

      try {
        const optimized = await sharp(file.buffer).resize(900, 700, { fit: "cover" }).webp({ quality: 78 }).toBuffer();
        const filename = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}.webp`;
        item.image = await db.uploadPhoto(optimized, filename, "image/webp");
        matched.push({ filename: file.originalname, itemId: item.id, itemName: item.name });
      } catch (err) {
        console.error(err);
        unmatched.push(file.originalname);
      }
    }

    await db.write(data);
    res.json({ matched, unmatched });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Bulk upload failed. Please try again." });
  }
});

// ---------- Settings ----------
router.get("/settings", async (req, res) => {
  try {
    const data = await db.read();
    res.json(data.settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load settings." });
  }
});

router.put("/settings", async (req, res) => {
  try {
    const data = await db.read();
    data.settings = { ...data.settings, ...req.body };
    await db.write(data);
    res.json(data.settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not save settings." });
  }
});

module.exports = router;
