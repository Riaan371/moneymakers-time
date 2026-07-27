use serde::{Deserialize, Serialize};

// Same values as the web app's .env — the publishable key is safe to embed
// in a compiled client, same as it's safe to ship in the web app's JS bundle.
const SUPABASE_URL: &str = "https://bivwxtbmuakwpzisyusf.supabase.co";
const SUPABASE_ANON_KEY: &str = "sb_publishable_eVoL5fGLoNGUIyRTn3D1rQ_CeGbbgLz";

const KEYRING_SERVICE: &str = "moneymakers-tracker";
const KEYRING_USER: &str = "refresh_token";

#[derive(Deserialize)]
struct AuthResponse {
    access_token: String,
    refresh_token: String,
}

#[derive(Serialize)]
pub struct CapturedSegmentPayload {
    pub window_title: String,
    pub app_name: Option<String>,
    pub started_at: String,
    pub ended_at: String,
}

pub struct Session {
    access_token: String,
    refresh_token: String,
    client: reqwest::Client,
}

impl Session {
    pub async fn sign_in(email: &str, password: &str) -> Result<Self, String> {
        let client = reqwest::Client::new();
        let resp = client
            .post(format!("{SUPABASE_URL}/auth/v1/token?grant_type=password"))
            .header("apikey", SUPABASE_ANON_KEY)
            .json(&serde_json::json!({ "email": email, "password": password }))
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !resp.status().is_success() {
            return Err("Invalid email or password.".to_string());
        }
        let auth: AuthResponse = resp.json().await.map_err(|e| e.to_string())?;
        store_refresh_token(&auth.refresh_token)?;
        Ok(Session {
            access_token: auth.access_token,
            refresh_token: auth.refresh_token,
            client,
        })
    }

    /// Try to resume a session from a previously stored refresh token.
    pub async fn from_stored() -> Option<Self> {
        let refresh_token = load_refresh_token()?;
        let client = reqwest::Client::new();
        let resp = client
            .post(format!("{SUPABASE_URL}/auth/v1/token?grant_type=refresh_token"))
            .header("apikey", SUPABASE_ANON_KEY)
            .json(&serde_json::json!({ "refresh_token": refresh_token }))
            .send()
            .await
            .ok()?;
        if !resp.status().is_success() {
            return None;
        }
        let auth: AuthResponse = resp.json().await.ok()?;
        let _ = store_refresh_token(&auth.refresh_token);
        Some(Session {
            access_token: auth.access_token,
            refresh_token: auth.refresh_token,
            client,
        })
    }

    /// Access tokens are short-lived (~1hr) - call before each sync so the
    /// long-running tray process never has to be restarted to keep working.
    pub async fn refresh(&mut self) -> Result<(), String> {
        let resp = self
            .client
            .post(format!("{SUPABASE_URL}/auth/v1/token?grant_type=refresh_token"))
            .header("apikey", SUPABASE_ANON_KEY)
            .json(&serde_json::json!({ "refresh_token": self.refresh_token }))
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if !resp.status().is_success() {
            return Err("Session expired - please sign in again.".to_string());
        }
        let auth: AuthResponse = resp.json().await.map_err(|e| e.to_string())?;
        self.access_token = auth.access_token;
        self.refresh_token = auth.refresh_token.clone();
        store_refresh_token(&auth.refresh_token)?;
        Ok(())
    }

    /// Insert captured segments. RLS on captured_segments requires the row's
    /// user_id to match the signed-in user, which the DB fills in via
    /// `default auth.uid()` - we don't send user_id ourselves.
    pub async fn push_segments(&self, segments: &[CapturedSegmentPayload]) -> Result<(), String> {
        if segments.is_empty() {
            return Ok(());
        }
        let resp = self
            .client
            .post(format!("{SUPABASE_URL}/rest/v1/captured_segments"))
            .header("apikey", SUPABASE_ANON_KEY)
            .header("Authorization", format!("Bearer {}", self.access_token))
            .header("Content-Type", "application/json")
            .header("Prefer", "return=minimal")
            .json(segments)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("Sync failed: {body}"));
        }
        Ok(())
    }
}

fn store_refresh_token(token: &str) -> Result<(), String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)
        .and_then(|e| e.set_password(token))
        .map_err(|e| e.to_string())
}

fn load_refresh_token() -> Option<String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)
        .ok()?
        .get_password()
        .ok()
}
