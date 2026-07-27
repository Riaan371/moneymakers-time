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
- Starts automatically on login (no staff member has to remember to launch it).

## Getting the installer (recommended: CI build, no local setup)

Every push that touches `desktop-agent/` builds a fresh installer on GitHub's
servers — nothing needs installing on your own machine for this.

1. Go to the repo's **Actions** tab → **Build Desktop Agent** → the latest
   green run.
2. Scroll to **Artifacts** → download **`moneymakers-tracker-staff-rollout`**.
3. Unzip it. Inside: the installer `.exe` (and `.msi`) plus
   `install-on-staff-pc.bat`.
4. Copy that whole unzipped folder to a USB stick or shared drive, take it to
   any staff PC, double-click `install-on-staff-pc.bat`. It installs silently
   and starts the tracker (approve the "Allow this app to make changes?"
   Windows prompt if it appears — normal for any installer).
5. First launch shows a small sign-in window — staff enter their own Money
   Makers Time email/password. After that it's silent in the tray.

## Building locally instead (optional)

Only worth doing if you want faster iteration while making changes. Needs:

1. **Rust**: https://rustup.rs
2. **Tauri CLI**: `cargo install tauri-cli --version "^2.0"`
3. **Windows C++ Build Tools** (Tauri prerequisite) — see
   https://v2.tauri.app/start/prerequisites/. Note: if this machine has
   Windows 11 **Smart App Control** enabled, it will block cargo's build
   scripts from running (a "one-way" security setting — Microsoft only lets
   you turn it back on via a full OS reinstall). If you hit
   `os error 4551` during any cargo build, that's it — the CI path above
   sidesteps this entirely, which is why it's the default recommendation.

Then, from inside `desktop-agent/`:

```
cargo tauri icon icons/source-icon.png   # once, or after swapping the logo
cargo tauri build
```

Output lands in `desktop-agent/target/release/bundle/nsis/` (and `msi/`).

## Updating the app later

Change the code under `desktop-agent/src/`, commit, push to `main`. CI builds
a new installer automatically — grab it from Actions the same way as above
and roll it out again. (Existing installs aren't auto-updated; re-running the
installer replaces the old version.)
