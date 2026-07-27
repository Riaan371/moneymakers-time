# MoneyMakers Time — Setup Checklist

Time tracking + retainer reconciliation app for Pieter (Money Makers payroll/bookkeeping practice).
Stack: TanStack Start (React) on Cloudflare Workers + Supabase (Postgres + Auth).

Work through these steps in order. Everything here is one-time setup.

---

## 1. Create the Supabase project

1. Go to https://supabase.com/dashboard and sign in.
2. Click **New project**.
3. Name: `MoneyMakers Time`. Choose a strong database password (save it somewhere safe). Region: closest to South Africa (e.g. `eu-west-2 London`).
4. Wait for the project to finish provisioning (~2 minutes).

## 2. Run the database migration

1. In the Supabase dashboard, open **SQL Editor** (left sidebar).
2. Open the file `supabase/migrations/0001_init.sql` from this repo, copy ALL of it.
3. Paste into the SQL editor and click **Run**. It should say "Success. No rows returned".

This creates: clients, retainer terms, work categories (pre-seeded for a payroll practice), time entries, invoices, and the monthly reconciliation view.

## 3. Create the login user(s)

There is NO public signup — users are created by hand:

1. Supabase dashboard → **Authentication** → **Users** → **Add user** → **Create new user**.
2. Enter Pieter's email and a password. Tick **Auto Confirm User**.
3. Copy the new user's UUID from the list.
4. SQL Editor → run (replace the UUID and name):

```sql
insert into public.user_roles (user_id, role, display_name)
values ('PASTE-UUID-HERE', 'admin', 'Pieter');
```

Repeat for any staff members, using role `'staff'` instead of `'admin'`.
(Staff can track time; only admins manage clients, retainers, rates and invoices.)

## 4. Wire up the local environment

1. Supabase dashboard → **Project Settings** → **API Keys**.
2. Copy the **URL** and the **publishable** key (starts with `sb_publishable_...`).
3. In this repo, copy `.env.example` to `.env` and fill in:

```
VITE_SUPABASE_URL=https://YOUR-REF.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

4. Test locally: `npm install` then `npm run dev` → http://localhost:3000 — log in with the user from step 3.

## 5. GitHub repo

1. Create a new **private** repo on GitHub (e.g. `moneymakers-time`).
2. Push this folder to it (`main` branch).
3. Repo → **Settings** → **Secrets and variables** → **Actions** → add these repository secrets:
   - `VITE_SUPABASE_URL` — same value as .env
   - `VITE_SUPABASE_ANON_KEY` — same value as .env
   - `CLOUDFLARE_API_TOKEN` — see step 6
   - `CLOUDFLARE_ACCOUNT_ID` — see step 6

## 6. Cloudflare

1. https://dash.cloudflare.com → copy your **Account ID** (right side of the overview page) → that's `CLOUDFLARE_ACCOUNT_ID`.
2. **My Profile** → **API Tokens** → **Create Token** → template **Edit Cloudflare Workers** → create, copy → that's `CLOUDFLARE_API_TOKEN`.
3. Push to `main` — GitHub Actions builds and deploys the worker `moneymakers-time` automatically.
4. (Optional) Add a custom domain to the worker in the Cloudflare dashboard once Pieter picks one.

## 7. First data entry (in the app, as admin)

1. **Clients** page → add each of Pieter's clients. For each one set:
   - Billing type: **retainer** or **hourly**
   - Hourly rate (used to value time; falls back to the practice default in Settings)
2. For retainer clients → add the **retainer terms**: monthly fee + included hours (if the agreement specifies them).
3. **Settings** → set the practice default hourly rate.

From then on it's just: start the timer, pick client + category (Payroll processing / Xero / Documents / …), stop, done. The dashboard shows, per client per month, hours tracked vs retainer fee vs what was invoiced.

## 8. Run migration 0002 (automatic tracking)

Same as step 2 — paste `supabase/migrations/0002_auto_tracking.sql` into the SQL Editor and run it. Adds the tables the desktop agent and the **Review** screen use: `tracking_rules` (window-title → client/category mapping) and `captured_segments` (raw activity awaiting approval).

## 9. Desktop agent (automatic time capture)

Optional, built but not yet compiled — see [`desktop-agent/README.md`](./desktop-agent/README.md) for the full setup (installing Rust/Tauri, building, first run). Short version: it's a tray app that watches the foreground window title (e.g. picks up a client's Xero org name or a payroll filename automatically) and syncs candidate time segments to the **Review** screen — nothing gets billed until approved there.

---

## Phase 2 (not set up yet — planned)

- **Xero sync**: pull actual invoices per client automatically instead of logging them by hand, and push draft invoices for hourly clients from tracked time. Needs a Xero developer app (OAuth2) connected to Pieter's Xero org.
- **Microsoft 365**: pull recently-worked documents via Microsoft Graph to prompt "you worked on Payroll_ClientX.xlsx for a while — log it?".
