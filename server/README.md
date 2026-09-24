# Adane International Hotel — Digital Menu

A premium digital menu website for Adane International Hotel, with a private
admin dashboard so the restaurant can update prices, photos, descriptions and
items themselves — no developer needed after handover.

Written in plain Node.js/Express + vanilla HTML/CSS/JS. No frameworks, no
build step, nothing to compile.

---

## What's inside

```
server/
  server.js            ← the whole app (starts here)
  db.js                ← tiny JSON-file database (data/db.json)
  seed.js              ← creates the first admin login
  routes/
    menu.js            ← public read-only menu API
    auth.js            ← admin login / logout
    admin.js            admin menu-management API (protected)
  middleware/auth.js    admin session protection
  data/
    menu_seed.json      the 190 menu items from your original document
    db.json              the live database (created automatically)
  uploads/              uploaded menu photos land here
  public/                the customer-facing website  → served at  /
  admin/                 the admin dashboard            → served at  /admin
  .env.example           copy to .env and fill in
  package.json
```

**One source of truth.** The public site and the admin dashboard both read
and write the same `data/db.json` file through the same API. There are no
two copies of the menu that can get out of sync.

---

## 1. Run it locally

You need [Node.js](https://nodejs.org) 18 or newer installed.

```bash
cd server
npm install
cp .env.example .env
```

Open `.env` in a text editor and fill in three things:

- `JWT_SECRET` — a long random string (a command to generate one is in the
  file's comments)
- `ADMIN_EMAIL` — the email you'll use to log into the admin dashboard
- `ADMIN_PASSWORD` — the password for that account (8+ characters)

Then start the server:

```bash
npm start
```

The first time it starts, it automatically creates your admin account from
`ADMIN_EMAIL`/`ADMIN_PASSWORD` in `.env` — no separate seed step needed. (If
you're curious, `npm run seed` still exists too, and is handy if you ever
want to change the admin password later while the server keeps running.)

- Public menu: **http://localhost:3000**
- Admin dashboard: **http://localhost:3000/admin/login.html**

That's it — the 190 items from your menu document are already loaded.

---

## 2. How the restaurant edits the menu (day-to-day use)

1. Go to `/admin/login.html` and log in.
2. Click **Menu Management**.
3. Find the dish (use the search box or category filter), click **Edit**.
4. Change the price, description, category, or upload a new photo.
5. Click **Save Changes**.

The public menu shows the update within a few seconds — nobody needs to
touch code, redeploy, or contact the developer.

Other things the dashboard can do:
- **Bulk upload photos** — the button next to "Add new item" in Menu Management.
  Select multiple photo files at once; each one is matched to a menu item
  automatically by its filename (e.g. `Beef Burger.jpg` or `beef-burger.jpg`
  both match the item "Beef Burger"). A results list shows which photos
  matched and which didn't, so nothing silently fails. Great for working
  through a folder of sourced/photographed dishes in one go instead of
  uploading them one at a time.
- **Add new item** — the blue button at the top of Menu Management.
- **Hide an item temporarily** instead of deleting it — click **Hide** in the
  item's row. Hidden items stay in the system but disappear from the public
  menu until you click **Show** again.
- **Delete permanently** — open the item, click **Delete item** at the
  bottom of the edit form. This can't be undone, so hiding is usually safer.
- **Categories** tab — add, rename, or remove menu categories. You can't
  delete a category that still has items in it (move or delete those first).
- **Settings** tab — hotel name, tagline, the VAT/service-charge note shown
  in the footer, phone and address.

Uploaded photos are automatically resized and compressed on the server, so
the public menu stays fast even if a manager uploads a large photo straight
from their phone.

---

## 3. Editing the menu content directly (for you, the developer)

Everything a non-technical person needs is in the admin dashboard above.
For bulk changes, you as the developer can also edit
`server/data/db.json` directly while the server is stopped — it's a plain
JSON file with `items`, `categories`, `admins` and `settings`. The original
parsed menu (before any admin edits) is kept separately in
`server/data/menu_seed.json` for reference.

To re-brand or restyle:
- Colors and fonts: top of `public/css/style.css` (`:root` block) and
  `admin/css/admin.css`.
- Hotel name in the hero / page titles: `public/index.html`.
- Contact info and footer note: edit through **Settings** in the admin
  dashboard, or directly in `data/db.json` → `settings`.

---

## 4. Security — what's already handled

- Passwords are hashed with bcrypt; nothing is ever stored in plain text.
- Admin sessions use a signed, `httpOnly` cookie (JavaScript on the page can
  never read it), so it can't be stolen through the browser console.
- Every `/api/admin/*` route checks that cookie server-side before doing
  anything — there's no "fake" front-end-only login.
- Repeated wrong-password attempts are throttled (8 tries per 5 minutes per
  IP address).
- Image uploads are limited to JPG/PNG/WEBP, 8MB max, and are re-encoded by
  the server (not saved as-is), which also strips anything unsafe embedded
  in the file.
- `JWT_SECRET`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` live only in `.env`,
  which is excluded from version control by `.gitignore` and is never sent
  to the browser.

**Before you deploy for real:**
- Set `NODE_ENV=production` in your `.env` — this makes the login cookie
  HTTPS-only.
- Use a real, unique `JWT_SECRET` (don't reuse the example one).
- Change `ADMIN_PASSWORD` to something strong, and don't share the `.env`
  file over chat/email — copy it to the server directly.

---

## 5. Deploying it

This is a normal Node.js app, so it runs on any host that can run
`npm install && npm start` with a persistent disk — for example
**Render**, **Railway**, a small **VPS** (DigitalOcean/Hetzner), or your own
server. Free tiers on Render/Railway are enough for a restaurant menu site.

Steps are the same everywhere:
1. Push this project to a Git repository (GitHub, GitLab, etc.) — `.env` and
   `node_modules` are already excluded via `.gitignore`.
2. On the host, set the same environment variables from `.env` in its
   dashboard (`JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `NODE_ENV=production`).
3. Set the start command to `npm start` (Node will run `npm run seed`
   automatically the first time if you add it as a one-off/"release" command,
   or just run it once yourself via the host's shell/console).
4. Make sure the host gives you a **persistent disk/volume** mounted at the
   project folder — `data/db.json` and `uploads/` need to survive restarts
   and redeploys. (This matters most on "serverless" platforms like plain
   Vercel, which reset the filesystem on every request — those are not a
   good fit for this version of the project without switching to a real
   database. Render, Railway, Fly.io and a VPS all support persistent disks.)

If down the line you outgrow the simple JSON-file database — many
concurrent editors, need for backups/replication, etc. — the cleanest
upgrade path is swapping `db.js` for a real database (e.g. Supabase or
Postgres); every route already reads/writes through that one file, so the
rest of the app doesn't need to change.

---

## 6. A note on the auto-extracted menu data

The 190 items in `data/menu_seed.json` were parsed automatically from your
menu document, which used inconsistent spacing/formatting throughout (dots,
dashes, tabs as separators). The parsing was checked by hand against the
source and looks accurate, but because there was a lot of it, please do a
quick pass through **Menu Management** after your first login to confirm
every name, description and price is exactly right — anything off takes
seconds to fix there. The Amharic text in the Ethiopian Traditional sections
was preserved exactly as written in your document.

---

## 7. Troubleshooting

- **"Missing JWT_SECRET" on startup** — you haven't created `.env` yet, or
  left a field blank. Copy `.env.example` to `.env` and fill it in.
- **Can't log into the admin panel** — run `npm run seed` again after
  fixing `ADMIN_EMAIL`/`ADMIN_PASSWORD` in `.env`; it's safe to re-run, it
  just updates the password.
- **Uploaded photo doesn't show** — check the file is a JPG, PNG or WEBP
  under 8MB. Anything else is rejected with a clear error message in the
  dashboard.
- **Changes not appearing on the public menu** — the public menu caches
  responses for 30 seconds for speed; refresh after a moment.
