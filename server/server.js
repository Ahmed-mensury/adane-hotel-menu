require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");

const db = require("./db");
const { requireAuth } = require("./middleware/auth");
const menuRoutes = require("./routes/menu");
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");

if (!process.env.JWT_SECRET) {
  console.error(
    "\nMissing JWT_SECRET in your .env file. Copy .env.example to .env, " +
      "set JWT_SECRET to a long random string, then restart.\n"
  );
  process.exit(1);
}

db.ensureDb();

// ---------- Auto-seed the admin account on every startup ----------
// On a plan without a persistent disk, db.json is recreated empty on every
// restart/redeploy, which would otherwise wipe the admin login and require
// manually running "npm run seed" via a Shell (a paid-plan feature). This
// runs the same logic automatically, every time the server starts, using
// ADMIN_EMAIL / ADMIN_PASSWORD from the environment. It's safe to run
// repeatedly: it just makes sure that account exists with that password.
function autoSeedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn(
      "\nADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin auto-seed. " +
        "Set both in your environment variables to enable admin login.\n"
    );
    return;
  }
  if (password.length < 8) {
    console.warn("\nADMIN_PASSWORD should be at least 8 characters — skipping admin auto-seed.\n");
    return;
  }

  const data = db.read();
  const hash = bcrypt.hashSync(password, 12);
  const existing = data.admins.find((a) => a.email === email);

  if (existing) {
    existing.passwordHash = hash;
  } else {
    data.admins.push({
      id: Date.now(),
      email,
      passwordHash: hash,
      createdAt: new Date().toISOString()
    });
  }
  db.write(data);
  console.log(`Admin account ready: ${email}`);
}

autoSeedAdmin();

const app = express();
const PORT = process.env.PORT || 3000;

app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// ---------- Public API ----------
app.use("/api", menuRoutes);
app.use("/api/auth", authRoutes);

// ---------- Protected admin API ----------
app.use("/api/admin", requireAuth, adminRoutes);

// ---------- Uploaded images ----------
app.use("/uploads", express.static(path.join(__dirname, "uploads"), { maxAge: "30d" }));

// ---------- Static sites ----------
// Public customer-facing menu
app.use(express.static(path.join(__dirname, "public")));
// Admin dashboard (the pages themselves are static; every API call they make
// is protected separately by requireAuth above, so simply loading these HTML
// files does not expose any menu data)
app.use("/admin", express.static(path.join(__dirname, "admin")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use((req, res) => {
  res.status(404).send("Not found");
});

app.listen(PORT, () => {
  console.log(`\nAdane International Hotel menu running at http://localhost:${PORT}`);
  console.log(`Admin dashboard at        http://localhost:${PORT}/admin/login.html\n`);
});