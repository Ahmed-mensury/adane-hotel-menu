require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const path = require("path");
const fs = require("fs");

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

// Auto-create the first admin account on startup if one doesn't exist yet.
// This means the app works fully on hosts (like Render's free tier) that
// don't offer shell/SSH access to run `npm run seed` manually. It only ever
// creates an account when none exists yet — it never overwrites a login you
// already created or changed.
function ensureAdminAccount() {
  const bcrypt = require("bcryptjs");
  const data = db.read();
  if (data.admins.length > 0) return; // an admin already exists, do nothing

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn(
      "\nNo admin account exists yet, and ADMIN_EMAIL/ADMIN_PASSWORD are not " +
        "set, so one could not be created automatically. Set both in your " +
        "environment variables and restart the service.\n"
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
  db.write(data);
  console.log(`\nCreated admin account automatically: ${email}\n`);
}
ensureAdminAccount();

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
