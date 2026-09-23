// seed.js
// Run with: npm run seed
// Creates (or resets) the first administrator account using the
// ADMIN_EMAIL / ADMIN_PASSWORD values from your .env file.
require("dotenv").config();
const bcrypt = require("bcryptjs");
const db = require("./db");

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!email || !password) {
  console.error(
    "\nMissing ADMIN_EMAIL or ADMIN_PASSWORD in your .env file.\n" +
      "Copy .env.example to .env and fill those two values in first.\n"
  );
  process.exit(1);
}

if (password.length < 8) {
  console.error("\nADMIN_PASSWORD should be at least 8 characters.\n");
  process.exit(1);
}

const data = db.read();
const hash = bcrypt.hashSync(password, 12);
const existing = data.admins.find((a) => a.email === email);

if (existing) {
  existing.passwordHash = hash;
  console.log(`Updated password for existing admin: ${email}`);
} else {
  data.admins.push({
    id: Date.now(),
    email,
    passwordHash: hash,
    createdAt: new Date().toISOString()
  });
  console.log(`Created new admin account: ${email}`);
}

db.write(data);
console.log("Done. You can now log in at /admin/login.html\n");
