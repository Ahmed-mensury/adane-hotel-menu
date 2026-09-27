# Adane International Hotel — Digital Menu

A premium digital menu website for Adane International Hotel, with a private
admin dashboard so the restaurant can update prices, photos, descriptions and
items themselves — no developer needed after handover.

Written in plain Node.js/Express + vanilla HTML/CSS/JS. Data and photos are
stored on **Supabase** (a free hosted Postgres database + file storage), so
everything the restaurant changes through the dashboard is permanent —
uploads survive restarts, redeploys, and idle periods on free hosting.

---

## What's inside

```
server/
  server.js            ← the whole app (starts here)
  db.js                ← talks to Supabase (database + photo storage)
  seed.js              ← optional: create/reset the admin password manually
  routes/
    menu.js            ← public read-only menu API
    auth.js            ← admin login / logout
    admin.js            admin menu-management API (protected)
  middleware/auth.js    admin session protection
  data/
    menu_seed.json      the 190 menu items from your original document,
                         used once to seed Supabase the very first time
  public/                the customer-facing website  → served at  /
  admin/                 the admin dashboard            → served at  /admin
  .env.example            copy to .env and fill in
  package.json
```

**One source of truth.** The public site and the admin dashboard both read
and write the same Supabase project, so there are no two copies of the menu
that can get out of sync — and nothing lives only on the server's disk.

---

## 1. Set up Supabase (free, ~5 minutes, one time)

1. Go to [supabase.com](https://supabase.com), sign up free, and create a
   new project (pick any name/region/password — you won't need that
   database password directly).
2. Once the project is ready, open the **SQL Editor** (left sidebar) and run
   this to create the one table the app needs:
   ```sql
   create table app_state (
     id int primary key,
     data jsonb not null,
     updated_at timestamptz not null default now()
   );
   ```
3. Open **Storage** (left sidebar), click **New bucket**, name it exactly
   `menu-photos`, and toggle it **Public**. This is where uploaded food
   photos are stored.
4. Open **Project Settings → API**. You'll need two values from this page
   in step 2 below:
   - **Project URL** → this is your `SUPABASE_URL`
   - **service_role key** (under "Project API keys" — not the "anon" key)
     → this is your `SUPABASE_SERVICE_KEY`. Keep this secret; it has full
     access to your project and must never appear in frontend code.

---

## 2. Run it locally

You need [Node.js](https://nodejs.org) 18 or newer installed.

```bash
cd server
npm install
cp .env.example .env
```

Open `.env` and fill in:
- `JWT_SECRET` — a long random string (a command to generate one is in the
  file's comments)
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — the login you'll use for the admin
  dashboard
- `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` — from step 4 above

Then start the server:

```bash
npm start
```

The first time it starts, it connects to Supabase, loads your 190 menu
items in if they're not there yet, and creates your admin account
automatically — no separate seed step needed.

- Public menu: **http://localhost:3000**
- Admin dashboard: **http://localhost:3000/admin/login.html**

---

## 3. How the restaurant edits the menu (day-to-day use)

1. Go to `/admin/login.html` and log in.
2. Click **Menu Management**.
3. Find the dish (use the search box or category filter), click **Edit**.
4. Change the price, description, category, or upload a new photo.
5. Click **Save Changes**.

The public menu shows the update within seconds. Photos and edits are saved
to Supabase, not the server's local disk, so they're permanent — logging in
again next week, next month, or after a redeploy, everything is exactly as
it was left.

Other things the dashboard can do:
- **Bulk upload photos** — the button next to "Add new item" in Menu
  Management. Select multiple photo files at once; each one is matched to a
  menu item automatically by its filename (e.g. `Beef Burger.jpg` matches
  the item "Beef Burger"). A results list shows which matched and which
  didn't.
- **Add new item** — the blue button at the top of Menu Management.
- **Hide an item temporarily** instead of deleting it — click **Hide** in
  the item's row.
- **Delete permanently** — open the item, click **Delete item**. This can't
  be undone, so hiding is usually safer.
- **Categories** tab — add, rename, or remove menu categories.
- **Settings** tab — hotel name, tagline, the VAT/service-charge note, phone
  and address.

Uploaded photos are automatically resized and compressed before being
stored, so the public menu stays fast.

---

## 4. Security — what's already handled

- Passwords are hashed with bcrypt; nothing is ever stored in plain text.
- Admin sessions use a signed, `httpOnly` cookie (JavaScript on the page can
  never read it).
- Every `/api/admin/*` route checks that cookie server-side before doing
  anything.
- Repeated wrong-password attempts are throttled (8 tries per 5 minutes per
  IP address).
- Image uploads are limited to JPG/PNG/WEBP, 8MB max, and are re-encoded by
  the server before being stored.
- `JWT_SECRET`, `SUPABASE_SERVICE_KEY`, `ADMIN_EMAIL` and `ADMIN_PASSWORD`
  live only in `.env`, which is excluded from version control and never
  sent to the browser.

**Before you deploy for real:**
- Set `NODE_ENV=production` in your `.env` — this makes the login cookie
  HTTPS-only.
- Use a real, unique `JWT_SECRET`.
- Change `ADMIN_PASSWORD` to something strong.
- Never commit `.env` or paste your `SUPABASE_SERVICE_KEY` anywhere public.

---

## 5. Deploying it

Because data and photos now live on Supabase instead of local disk, this
app works on **any** Node host — traditional (Render, a VPS) or fully
serverless (Vercel). Nothing about the code needs to change if you switch
hosts later; only where you set the environment variables changes.

### Deploying to Vercel

1. Push this project to a Git repository (GitHub, GitLab, etc.).
2. Go to [vercel.com](https://vercel.com), sign up free, click **Add New →
   Project**, and import that repository.
3. If your repo has this `server` folder nested inside it (rather than at
   the repo root), set **Root Directory** to `server` in the import screen.
4. Under **Environment Variables**, add: `JWT_SECRET`, `ADMIN_EMAIL`,
   `ADMIN_PASSWORD`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and
   `NODE_ENV` set to `production`.
5. Click **Deploy**. Vercel automatically detects `api/[...path].js` as a
   serverless function (handling everything under `/api/*`) and serves the
   `public/` and `admin/` folders directly — the included `vercel.json`
   handles the couple of path rewrites needed for the homepage and its
   CSS/JS. No build command or extra configuration needed.
6. Once deployed, visit your `*.vercel.app` URL — the first request creates
   your admin account automatically, exactly like on any other host.

Any future push to your repo's main branch redeploys automatically.

### Deploying to Render (or a VPS)

1. Push this project to a Git repository.
2. Create a Web Service, point it at this repo with **Root Directory** set
   to `server`.
3. Build command: `npm install`. Start command: `npm start`.
4. Set the same environment variables as above.
5. Deploy. The first startup connects to Supabase, seeds the menu if empty,
   and creates your admin login automatically.

Either way: no disk to attach, no Shell step required, and uploads made
through the admin dashboard will still be there next time you visit, no
matter how the hosting platform restarts or redeploys the app.

---

## 6. A note on the auto-extracted menu data

The 190 items in `data/menu_seed.json` were parsed automatically from the
original menu document, which used inconsistent spacing/formatting
throughout. The parsing was checked by hand and looks accurate, but please
do a quick pass through **Menu Management** after your first login to
confirm every name, description and price is exactly right. The Amharic
text in the Ethiopian Traditional sections was preserved exactly as written
in the original document.

---

## 7. Troubleshooting

- **"Missing SUPABASE_URL or SUPABASE_SERVICE_KEY" on startup** — `.env`
  isn't filled in, or those values weren't set in your host's environment
  variables.
- **"Missing JWT_SECRET" on startup** — same idea, check `.env`.
- **Can't log into the admin panel** — double-check `ADMIN_EMAIL` /
  `ADMIN_PASSWORD` in your environment variables match exactly what you're
  typing. You can also run `npm run seed` (locally, with `.env` filled in)
  to create/reset that account manually.
- **Uploaded photo doesn't show** — check the file is a JPG, PNG or WEBP
  under 8MB, and that your Supabase Storage bucket is named exactly
  `menu-photos` and set to Public.
- **Changes not appearing on the public menu** — the public menu caches
  responses for 30 seconds for speed; refresh after a moment.
