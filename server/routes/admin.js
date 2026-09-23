// routes/admin.js — everything here requires a valid admin session (see server.js)
const express = require("express");
const router = express.Router();
const multer = require("multer");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const db = require("../db");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB max upload
  fileFilter: (req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
    cb(ok ? null : new Error("Only JPG, PNG or WEBP images are allowed"), ok);
  }
});

// ---------- Dashboard summary ----------
router.get("/summary", (req, res) => {
  const data = db.read();
  res.json({
    totalItems: data.items.length,
    availableItems: data.items.filter((i) => i.available).length,
    hiddenItems: data.items.filter((i) => !i.available).length,
    totalCategories: data.categories.length,
    admin: req.admin.email
  });
});

// ---------- Categories ----------
router.get("/categories", (req, res) => {
  res.json(db.read().categories.sort((a, b) => a.order - b.order));
});

router.post("/categories", (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "Category name is required" });
  const data = db.read();
  if (data.categories.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())) {
    return res.status(400).json({ error: "That category already exists" });
  }
  const cat = { id: Date.now(), name: name.trim(), order: data.categories.length };
  data.categories.push(cat);
  db.write(data);
  res.json(cat);
});

router.put("/categories/:id", (req, res) => {
  const data = db.read();
  const cat = data.categories.find((c) => c.id === Number(req.params.id));
  if (!cat) return res.status(404).json({ error: "Category not found" });
  const oldName = cat.name;
  if (req.body.name) cat.name = req.body.name.trim();
  if (typeof req.body.order === "number") cat.order = req.body.order;
  // keep items pointing at the renamed category
  if (req.body.name && req.body.name.trim() !== oldName) {
    data.items.forEach((i) => {
      if (i.category === oldName) i.category = cat.name;
    });
  }
  db.write(data);
  res.json(cat);
});

router.delete("/categories/:id", (req, res) => {
  const data = db.read();
  const cat = data.categories.find((c) => c.id === Number(req.params.id));
  if (!cat) return res.status(404).json({ error: "Category not found" });
  const inUse = data.items.some((i) => i.category === cat.name);
  if (inUse) {
    return res.status(400).json({ error: "Move or delete the items in this category first" });
  }
  data.categories = data.categories.filter((c) => c.id !== cat.id);
  db.write(data);
  res.json({ ok: true });
});

// ---------- Menu items ----------
router.get("/items", (req, res) => {
  res.json(db.read().items.sort((a, b) => a.id - b.id));
});

router.post("/items", (req, res) => {
  const { name, category, price, description, image, available } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "Item name is required" });
  if (!category) return res.status(400).json({ error: "Category is required" });
  const priceNum = Number(price);
  if (!Number.isFinite(priceNum) || priceNum < 0) {
    return res.status(400).json({ error: "Price must be a valid positive number" });
  }
  const data = db.read();
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
  db.write(data);
  res.json(item);
});

router.put("/items/:id", (req, res) => {
  const data = db.read();
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
  db.write(data);
  res.json(item);
});

router.delete("/items/:id", (req, res) => {
  const data = db.read();
  const before = data.items.length;
  data.items = data.items.filter((i) => i.id !== Number(req.params.id));
  if (data.items.length === before) return res.status(404).json({ error: "Item not found" });
  db.write(data);
  res.json({ ok: true });
});

// ---------- Image upload ----------
// Resizes/optimizes on the server so the public menu always loads fast
// images, regardless of what the manager uploads from their phone.
router.post("/upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image file received" });
    const filename = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}.webp`;
    const outPath = path.join(UPLOAD_DIR, filename);
    await sharp(req.file.buffer)
      .resize(900, 700, { fit: "cover" })
      .webp({ quality: 78 })
      .toFile(outPath);
    res.json({ url: `/uploads/${filename}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Image processing failed. Try a different image." });
  }
});

// ---------- Settings ----------
router.get("/settings", (req, res) => res.json(db.read().settings));

router.put("/settings", (req, res) => {
  const data = db.read();
  data.settings = { ...data.settings, ...req.body };
  db.write(data);
  res.json(data.settings);
});

module.exports = router;
