// Prevents an extra console window from popping up on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod sync;
mod tracker;

use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};
use tauri_plugin_autostart::MacosLauncher;

const POLL_INTERVAL_SECS: u64 = 5;
const IDLE_THRESHOLD_SECS: u32 = 240; // 4 minutes away -> stop counting
const MIN_SEGMENT_SECS: i64 = 30; // ignore window-switch blips shorter than this
const FLUSH_INTERVAL_SECS: u64 = 120; // how often captured segments sync up

struct CurrentSegment {
    title: String,
    app_name: Option<String>,
    started_at: chrono::DateTime<chrono::Utc>,
}

type SharedSession = Mutex<Option<sync::Session>>;

#[tauri::command]
async fn sign_in(app: tauri::AppHandle, email: String, password: String) -> Result<(), String> {
    let session = sync::Session::sign_in(&email, &password).await?;
    *app.state::<SharedSession>().lock().unwrap() = Some(session);
    if let Some(win) = app.get_webview_window("login") {
        let _ = win.hide();
    }
    spawn_tracking_loop(app);
    Ok(())
}

fn spawn_tracking_loop(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut current: Option<CurrentSegment> = None;
        let mut pending: Vec<sync::CapturedSegmentPayload> = Vec::new();
        let mut last_flush = Instant::now();

        loop {
            tokio::time::sleep(Duration::from_secs(POLL_INTERVAL_SECS)).await;

            let idle = tracker::idle_seconds();
            // If the user's away, treat it as "nothing in the foreground" so
            // the open segment gets closed off instead of running forever.
            let fg = if idle < IDLE_THRESHOLD_SECS {
                tracker::get_foreground_info()
            } else {
                None
            };

            let changed = match (&current, &fg) {
                (Some(c), Some(f)) => c.title != f.title,
                (None, None) => false,
                _ => true,
            };

            if changed {
                if let Some(c) = current.take() {
                    let ended_at = chrono::Utc::now();
                    let duration = ended_at.signed_duration_since(c.started_at).num_seconds();
                    if duration >= MIN_SEGMENT_SECS {
                        pending.push(sync::CapturedSegmentPayload {
                            window_title: c.title,
                            app_name: c.app_name,
                            started_at: c.started_at.to_rfc3339(),
                            ended_at: ended_at.to_rfc3339(),
                        });
                    }
                }
                current = fg.map(|f| CurrentSegment {
                    title: f.title,
                    app_name: f.app_name,
                    started_at: chrono::Utc::now(),
                });
            }

            if last_flush.elapsed().as_secs() >= FLUSH_INTERVAL_SECS && !pending.is_empty() {
                let state = app.state::<SharedSession>();
                let mut guard = state.lock().unwrap();
                if let Some(session) = guard.as_mut() {
                    if session.refresh().await.is_ok() && session.push_segments(&pending).await.is_ok() {
                        pending.clear();
                    }
                    // on failure we just retry next flush - segments stay queued in memory
                }
                last_flush = Instant::now();
            }
        }
    });
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(Mutex::new(None::<sync::Session>))
        .invoke_handler(tauri::generate_handler![sign_in])
        .setup(|app| {
            use tauri_plugin_autostart::ManagerExt;
            // Runs once per install; harmless (and cheap) to call again on every launch.
            let _ = app.autolaunch().enable();

            let handle = app.handle().clone();

            let show_i = MenuItem::with_id(
                app,
                "show_login",
                "Sign in / switch account",
                true,
                None::<&str>,
            )?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let mut tray_builder = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("MoneyMakers Tracker")
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "show_login" => {
                        if let Some(win) = app.get_webview_window("login") {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                });
            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }
            tray_builder.build(app)?;

            // Try to resume a previous session silently; otherwise show the login window.
            let handle2 = handle.clone();
            tauri::async_runtime::spawn(async move {
                if let Some(session) = sync::Session::from_stored().await {
                    *handle2.state::<SharedSession>().lock().unwrap() = Some(session);
                    spawn_tracking_loop(handle2.clone());
                } else if let Some(win) = handle2.get_webview_window("login") {
                    let _ = win.show();
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running the MoneyMakers Tracker");
}
