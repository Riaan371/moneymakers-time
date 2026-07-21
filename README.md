# Money Makers Time

Time tracking + retainer reconciliation app for Pieter's payroll/bookkeeping practice (Money Makers).

**The problem it solves:** the practice bills some clients hourly and some on monthly retainers, and needs to know (a) how much time payroll processing, Xero work, and document work actually takes per client, and (b) whether each retainer still covers the time being spent — i.e. is every client being invoiced correctly.

## Screens

- **Dashboard** — per client per month: billable hours, value at the client's hourly rate, retainer fee, the *effective hourly rate* the retainer works out to, what was invoiced, and the variance. Under-recovering clients are flagged.
- **Track** — start/stop timer (client + category: Payroll processing, Xero, Documents, …) plus manual entries.
- **Clients** — clients with billing type, hourly rate, and effective-dated retainer terms (fee history is kept when a retainer changes).
- **Invoices** — log what was actually invoiced in Xero per client per month (manual for now; Xero API sync is the planned phase 2).
- **Settings** — practice default hourly rate, category list.

## Stack

TanStack Start (React 19 SSR) + Vite, Cloudflare Workers (worker `moneymakers-time`), Supabase (Postgres + Auth, RLS). Deploys via GitHub Actions on push to `main`.

## Setup

See [SETUP.md](./SETUP.md) for the full checklist (Supabase project, migration, users, GitHub secrets, Cloudflare token).

Local dev: copy `.env.example` to `.env`, fill in the Supabase URL + publishable key, then:

```
npm install
npm run dev
```

No public signup — users are created in the Supabase dashboard and granted a role in `user_roles` (`admin` manages clients/retainers/invoices; `staff` tracks time).
