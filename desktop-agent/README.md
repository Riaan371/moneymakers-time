# MoneyMakers Tracker (desktop agent)

A tiny Windows tray app that watches the foreground window title and system
idle time, and syncs activity segments to the same Supabase project the web
app uses. Nothing is billed automatically — captured segments land in the
**Review** screen of the web app (`/review`) for approval first.

## How it decides what to log

- Every 5 seconds it checks which window is focused and reads its title
  (e.g. "ABC Trading (Pty) Ltd – Dashboard – Xero") and the process name
  (e.g. `chrome.exe`, `EXCEL.EXE`).
- If there's been no mouse/keyboard input for 4 minutes, it stops counting
  until you're back (won't log idle time as work).
- When the window changes, it closes off the previous segment (if it lasted
  at least 30 seconds — filters out quick alt-tabs) and queues it.
- Every 2 minutes it pushes queued segments to Supabase, where a database
  trigger tries to match them against admin-defined **tracking rules**
  (Review screen → Manage rules) to pre-fill a client/category.

## One-time setup on this machine (not done yet)

This machine doesn't have the Rust toolchain installed, which Tauri (the
framework this agent is built with) needs to compile. Run these yourself in
your own terminal — they need a GUI installer step Claude can't safely
automate:

1. **Install Rust**: https://rustup.rs → download `rustup-init.exe` → run it,
   accept the defaults.
2. **Install the Tauri CLI**:
   ```
   cargo install tauri-cli --version "^2.0"
   ```
3. **Install Windows build prerequisites** (needed to compile any Rust GUI
   app on Windows) — follow the "Windows" section here:
   https://v2.tauri.app/start/prerequisites/ — it walks you through the
   Microsoft C++ Build Tools installer (a few GB, one-time).

## Building

From inside this `desktop-agent` folder:

```
cd desktop-agent
cargo tauri icon icons/source-icon.png
cargo tauri build
```

The `icon` command only needs to run once — it generates the full icon set
Windows needs from the placeholder logo already in `icons/source-icon.png`
(swap that file for Money Makers' real logo first if you have one).

`cargo tauri build` produces an installer in
`desktop-agent/target/release/bundle/nsis/` (or `msi/`) that you run once on
the machine that'll track time. It installs to the tray and starts on login.

## First run

A small sign-in window appears — enter the same email/password used to log
into the web app. After that it runs silently in the tray; right-click the
icon for "Sign in / switch account" or "Quit".

## Note on this first version

This was written without a local Rust toolchain to compile against (none
was installed on the dev machine at the time), so treat the first
`cargo build` as a first pass — Tauri's exact API shifts slightly between
versions and something may need a small fix. Paste any compiler errors back
and they're usually quick to resolve.
