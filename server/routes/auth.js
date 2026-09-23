// routes/auth.js — admin login / logout / session check
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const rateLimitMap = new Map(); // simple in-memory brute-force throttle, per IP
const db = require("../db");
const { signToken, setAuthCookie, clearAuthCookie, requireAuth } = require("../middleware/auth");

function tooManyAttempts(ip) {
  const rec = rateLimitMap.get(ip);
  if (!rec) return false;
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  const recent = rec.filter((t) => t > fiveMinutesAgo);
  rateLimitMap.set(ip, recent);
  return recent.length >= 8;
}
function recordAttempt(ip) {
  const rec = rateLimitMap.get(ip) || [];
  rec.push(Date.now());
  rateLimitMap.set(ip, rec);
}

router.post("/login", (req, res) => {
  const ip = req.ip;
  if (tooManyAttempts(ip)) {
    return res.status(429).json({ error: "Too many attempts. Please wait a few minutes and try again." });
  }
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  const data = db.read();
  const admin = data.admins.find((a) => a.email.toLowerCase() === String(email).toLowerCase());
  if (!admin) {
    recordAttempt(ip);
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const ok = bcrypt.compareSync(password, admin.passwordHash);
  if (!ok) {
    recordAttempt(ip);
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const token = signToken(admin);
  setAuthCookie(res, token);
  res.json({ ok: true, email: admin.email });
});

router.post("/logout", (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ email: req.admin.email });
});

module.exports = router;
