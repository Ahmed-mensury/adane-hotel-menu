// middleware/auth.js
const jwt = require("jsonwebtoken");

const COOKIE_NAME = "adane_admin_token";

function signToken(admin) {
  return jwt.sign(
    { id: admin.id, email: admin.email },
    process.env.JWT_SECRET,
    { expiresIn: "12h" }
  );
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true, // JS on the page can never read this cookie
    secure: process.env.NODE_ENV === "production", // HTTPS-only in production
    sameSite: "lax",
    maxAge: 12 * 60 * 60 * 1000 // 12 hours
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

// Protects API routes: blocks the request entirely if not authenticated.
function requireAuth(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: "Session expired, please log in again" });
  }
}

module.exports = { signToken, setAuthCookie, clearAuthCookie, requireAuth, COOKIE_NAME };
