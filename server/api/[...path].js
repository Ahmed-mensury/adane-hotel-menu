// api/[...path].js
// Vercel turns this filename pattern into a catch-all function that
// receives every request under /api/* (e.g. /api/menu, /api/auth/login,
// /api/admin/items). It just hands the request straight to the same
// Express app used for local development and other hosts — nothing about
// the app's own routing had to change.
module.exports = require("../server.js");
