// routes/menu.js — public, read-only endpoints. No auth required.
const express = require("express");
const router = express.Router();
const db = require("../db");

// GET /api/menu — full public menu (only available items) + categories + settings
router.get("/menu", (req, res) => {
  const data = db.read();
  const items = data.items
    .filter((i) => i.available)
    .sort((a, b) => a.id - b.id);
  const categories = [...data.categories].sort((a, b) => a.order - b.order);
  res.set("Cache-Control", "public, max-age=30"); // short cache; admin edits show up quickly
  res.json({ items, categories, settings: data.settings });
});

module.exports = router;
