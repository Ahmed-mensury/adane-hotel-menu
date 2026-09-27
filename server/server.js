require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const path = require("path");

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

// Auto-create the first admin account if one doesn't exist yet, using
// ADMIN_EMAIL/ADMIN_PASSWORD from the environment. Only ever creates an
// account when none exists — never overwrites a login you already changed.
async function ensureAdminAccount() {
  const bcrypt = require("bcryptjs");
  const data = await db.read();
  if (data.admins.length > 0) return;

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn(
      "\nNo admin account exists yet, and ADMIN_EMAIL/ADMIN_PASSWORD are not " +
        "set, so one could not be created automatically.\n"
    );
    return;
  }
  if (password.length < 8) {
    console.warn("\nADMIN_PASSWORD should be at least 8 characters. Admin account was not created.\n");
    return;
  }
  data.admins.push({
    id: Date.now(),
    email,
    passwordHash: bcrypt.hashSync(password, 12),
    createdAt: new Date().toISOString()
  });
  await db.write(data);
  console.log(`\nCreated admin account automatically: ${email}\n`);
}

const app = express();
const PORT = process.env.PORT || 3000;

app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// ---------- One-time setup, run lazily on first request ----------
// Works identically whether the app is a traditional always-on server
// (Render, a VPS, etc. — setup runs once at startup) or a serverless
// function that spins up fresh per request (Vercel — setup runs once per
// cold start, memoized so it's not repeated on every request in the same
// warm instance).
let readyPromise = null;
function ensureReady() {
  if (!readyPromise) {
    readyPromise = (async () => {
      await db.ensureDb();
      await ensureAdminAccount();
    })();
  }
  return readyPromise;
}
app.use((req, res, next) => {
  ensureReady()
    .then(() => next())
    .catch((err) => {
      console.error("Startup check failed:", err.message);
      res.status(500).send("The server is temporarily unavailable. Please try again shortly.");
    });
});

// ---------- Public API ----------
app.use("/api", menuRoutes);
app.use("/api/auth", authRoutes);

// ---------- Protected admin API ----------
app.use("/api/admin", requireAuth, adminRoutes);

// ---------- Static sites ----------
// Public customer-facing menu. (Uploaded photos are not served from here —
// they live on Supabase Storage and are linked to directly.)
app.use(express.static(path.join(__dirname, "public")));
// Admin dashboard (the pages themselves are static; every API call they make
// is protected separately by requireAuth above)
app.use("/admin", express.static(path.join(__dirname, "admin")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use((req, res) => {
  res.status(404).send("Not found");
});

// Only start a traditional listening server when this file is run directly
// (e.g. `npm start` on Render, a VPS, or your own machine). On Vercel, this
// file is instead `require`d by api/index.js, which just needs the `app`
// object below — Vercel handles starting/stopping instances itself.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\nAdane International Hotel menu running at http://localhost:${PORT}`);
    console.log(`Admin dashboard at        http://localhost:${PORT}/admin/login.html\n`);
  });
}

module.exports = app;
