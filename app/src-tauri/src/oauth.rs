// OAuth + Drive upload helpers for the Tauri desktop app.
//
// Auth flow (loopback PKCE-less for installed-app client IDs):
//   1. Generate a random state, build the Google auth URL
//   2. Open the URL in the user's default browser
//   3. Spawn a tiny HTTP server on 127.0.0.1:8765 to capture the redirect
//   4. Receive ?code=... query param, validate state, exchange for tokens
//   5. Persist refresh_token to disk under the app's config dir
//
// All commands are async + return Result<T, String> for easy JS invoke.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const CLIENT_ID: &str =
    "545350887333-cicbneumq1aud1qej9la8c465nmi16oj.apps.googleusercontent.com";
// Desktop OAuth client secret. Per Google's docs, this secret CANNOT be kept
// secret in a desktop binary — anyone with the .app can extract it via
// `strings`. It's effectively a second identifier alongside the client ID.
//
// We read it from the OAUTH_CLIENT_SECRET env var at COMPILE TIME (not
// runtime — Tauri binaries can't read user env), so it stays out of git.
// To build: `OAUTH_CLIENT_SECRET=GOCSPX-... npm run tauri:build`.
//
// When unset (e.g. CI builds for testing), it falls back to an empty string
// and the token-exchange request will fail with a clear error.
const CLIENT_SECRET: &str = match option_env!("OAUTH_CLIENT_SECRET") {
    Some(s) => s,
    None => "",
};
const REDIRECT_URI: &str = "http://127.0.0.1:8765/callback";
const SCOPE: &str = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email";

// ─────────────────────────────────────────────────────────────────────────────
// Persistence
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct StoredTokens {
    pub access_token: String,
    pub refresh_token: String,
    /// Unix seconds when access_token expires.
    pub expires_at: u64,
    /// Email of the signed-in user. Cached for UI display.
    pub email: String,
}

fn tokens_path() -> std::path::PathBuf {
    let mut p = dirs::config_dir().expect("config dir unavailable");
    p.push("vflics-studio");
    let _ = std::fs::create_dir_all(&p);
    p.push("tokens.json");
    p
}

fn load_tokens() -> Option<StoredTokens> {
    let raw = std::fs::read_to_string(tokens_path()).ok()?;
    serde_json::from_str(&raw).ok()
}

fn save_tokens(t: &StoredTokens) -> anyhow::Result<()> {
    let raw = serde_json::to_string_pretty(t)?;
    std::fs::write(tokens_path(), raw)?;
    Ok(())
}

fn delete_tokens() {
    let _ = std::fs::remove_file(tokens_path());
}

fn now_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

// ─────────────────────────────────────────────────────────────────────────────
// OAuth flow
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: u64,
}

#[derive(Deserialize)]
struct UserInfo {
    email: String,
}

#[tauri::command]
pub async fn start_oauth() -> Result<String, String> {
    // Generate state to validate the redirect.
    let state = generate_state();

    // Build the Google auth URL.
    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth?\
         response_type=code&\
         client_id={client_id}&\
         redirect_uri={redirect}&\
         scope={scope}&\
         state={state}&\
         access_type=offline&\
         prompt=consent",
        client_id = urlencoding::encode(CLIENT_ID),
        redirect = urlencoding::encode(REDIRECT_URI),
        scope = urlencoding::encode(SCOPE),
        state = state,
    );

    // Spawn the loopback listener in a blocking task so we can await it.
    let state_for_listener = state.clone();
    let listener_handle = tokio::task::spawn_blocking(move || -> Result<String, String> {
        let server = tiny_http::Server::http("127.0.0.1:8765")
            .map_err(|e| format!("failed to bind localhost listener: {e}"))?;

        // Block until we receive ONE request, extract code, send confirmation page.
        for request in server.incoming_requests() {
            let url = request.url().to_string();
            let parsed = url::Url::parse(&format!("http://127.0.0.1:8765{url}"))
                .map_err(|e| format!("redirect URL parse: {e}"))?;
            let mut code: Option<String> = None;
            let mut got_state: Option<String> = None;
            let mut error: Option<String> = None;
            for (k, v) in parsed.query_pairs() {
                match k.as_ref() {
                    "code" => code = Some(v.to_string()),
                    "state" => got_state = Some(v.to_string()),
                    "error" => error = Some(v.to_string()),
                    _ => {}
                }
            }

            // Reply to the browser with a confirmation page so the user knows
            // they can close the tab.
            let body = if let Some(e) = error.as_ref() {
                format!("<html><body><h2>Sign-in failed</h2><p>{}</p></body></html>", e)
            } else {
                "<html><body><h2>vflics Studio signed in</h2><p>You can close this tab.</p></body></html>".into()
            };
            let response = tiny_http::Response::from_string(body)
                .with_header(
                    tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"text/html; charset=utf-8"[..]).unwrap(),
                );
            let _ = request.respond(response);

            if let Some(e) = error {
                return Err(format!("Google returned error: {e}"));
            }
            let got_state = got_state.ok_or("missing state in redirect")?;
            if got_state != state_for_listener {
                return Err("state mismatch — possible CSRF".into());
            }
            return code.ok_or("no code in redirect".into());
        }
        Err("listener exited without receiving a request".into())
    });

    // Open the browser.
    if let Err(e) = open::that(&auth_url) {
        return Err(format!("failed to open browser: {e}"));
    }

    // Wait for the loopback listener.
    let code = listener_handle
        .await
        .map_err(|e| format!("listener panicked: {e}"))??;

    // Exchange the code for tokens.
    let client = reqwest::Client::new();
    let token_resp: TokenResponse = client
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("code", code.as_str()),
            ("client_id", CLIENT_ID),
            ("client_secret", CLIENT_SECRET),
            ("redirect_uri", REDIRECT_URI),
            ("grant_type", "authorization_code"),
        ])
        .send()
        .await
        .map_err(|e| format!("token exchange request failed: {e}"))?
        .error_for_status()
        .map_err(|e| format!("token exchange HTTP error: {e}"))?
        .json()
        .await
        .map_err(|e| format!("token exchange JSON parse: {e}"))?;

    // Fetch user email for UI display.
    let user_info: UserInfo = client
        .get("https://www.googleapis.com/oauth2/v3/userinfo")
        .bearer_auth(&token_resp.access_token)
        .send()
        .await
        .map_err(|e| format!("userinfo failed: {e}"))?
        .error_for_status()
        .map_err(|e| format!("userinfo HTTP error: {e}"))?
        .json()
        .await
        .map_err(|e| format!("userinfo parse: {e}"))?;

    let stored = StoredTokens {
        access_token: token_resp.access_token,
        refresh_token: token_resp.refresh_token.unwrap_or_default(),
        expires_at: now_seconds() + token_resp.expires_in - 60, // 60s safety margin
        email: user_info.email.clone(),
    };
    save_tokens(&stored).map_err(|e| format!("token save: {e}"))?;
    Ok(user_info.email)
}

#[tauri::command]
pub async fn signed_in_email() -> Result<Option<String>, String> {
    Ok(load_tokens().map(|t| t.email))
}

#[tauri::command]
pub async fn sign_out() -> Result<(), String> {
    delete_tokens();
    Ok(())
}

async fn refresh_token(refresh: &str) -> Result<TokenResponse, String> {
    let client = reqwest::Client::new();
    client
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("client_id", CLIENT_ID),
            ("client_secret", CLIENT_SECRET),
            ("refresh_token", refresh),
            ("grant_type", "refresh_token"),
        ])
        .send()
        .await
        .map_err(|e| format!("refresh request: {e}"))?
        .error_for_status()
        .map_err(|e| format!("refresh HTTP error: {e}"))?
        .json()
        .await
        .map_err(|e| format!("refresh parse: {e}"))
}

async fn get_valid_access_token() -> Result<String, String> {
    let mut tokens = load_tokens().ok_or("not signed in")?;
    if now_seconds() < tokens.expires_at {
        return Ok(tokens.access_token);
    }
    // Expired — refresh.
    if tokens.refresh_token.is_empty() {
        return Err("no refresh token; please sign in again".into());
    }
    let refreshed = refresh_token(&tokens.refresh_token).await?;
    tokens.access_token = refreshed.access_token;
    tokens.expires_at = now_seconds() + refreshed.expires_in - 60;
    save_tokens(&tokens).map_err(|e| format!("save refreshed: {e}"))?;
    Ok(tokens.access_token)
}

// ─────────────────────────────────────────────────────────────────────────────
// Drive upload
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct DriveUploadResponse {
    id: String,
    name: String,
}

#[derive(Serialize)]
pub struct UploadResult {
    pub id: String,
    pub name: String,
}

/// Upload a single file (bytes) to a Drive folder.
#[tauri::command]
pub async fn upload_to_drive(
    folder_id: String,
    filename: String,
    bytes: Vec<u8>,
    mime_type: Option<String>,
) -> Result<UploadResult, String> {
    let token = get_valid_access_token().await?;
    let mime = mime_type.unwrap_or_else(|| "image/jpeg".into());

    // Multipart upload: metadata part + media part.
    let metadata = serde_json::json!({
        "name": filename,
        "parents": [folder_id],
    });

    let client = reqwest::Client::new();
    let form = reqwest::multipart::Form::new()
        .part(
            "metadata",
            reqwest::multipart::Part::text(metadata.to_string())
                .mime_str("application/json; charset=UTF-8")
                .map_err(|e| format!("metadata mime: {e}"))?,
        )
        .part(
            "media",
            reqwest::multipart::Part::bytes(bytes)
                .file_name(filename.clone())
                .mime_str(&mime)
                .map_err(|e| format!("media mime: {e}"))?,
        );

    let resp = client
        .post("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart")
        .bearer_auth(&token)
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("upload request: {e}"))?;

    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("upload HTTP {}: {}", status.as_u16(), body));
    }
    let parsed: DriveUploadResponse = resp
        .json()
        .await
        .map_err(|e| format!("upload response parse: {e}"))?;
    Ok(UploadResult {
        id: parsed.id,
        name: parsed.name,
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

fn generate_state() -> String {
    // 32 hex chars from a few random sources mixed; not cryptographically strong
    // but sufficient for CSRF protection on a single-machine app.
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let mut hex = String::with_capacity(32);
    let mut x = nanos;
    for _ in 0..32 {
        let nibble = (x & 0xf) as u8;
        hex.push(if nibble < 10 {
            (b'0' + nibble) as char
        } else {
            (b'a' + nibble - 10) as char
        });
        // Mix the bits a bit.
        x = x.wrapping_mul(2862933555777941757).wrapping_add(3037000493);
    }
    hex
}

// Re-export urlencoding crate's encode for the URL builder above.
mod urlencoding {
    pub fn encode(s: &str) -> String {
        let mut out = String::with_capacity(s.len());
        for b in s.bytes() {
            match b {
                b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => out.push(b as char),
                _ => out.push_str(&format!("%{:02X}", b)),
            }
        }
        out
    }
}

// Tiny `open` shim so we don't need a separate crate.
mod open {
    pub fn that(url: &str) -> std::io::Result<()> {
        #[cfg(target_os = "macos")]
        {
            std::process::Command::new("open").arg(url).spawn()?.wait()?;
            return Ok(());
        }
        #[cfg(target_os = "linux")]
        {
            std::process::Command::new("xdg-open").arg(url).spawn()?.wait()?;
            return Ok(());
        }
        #[cfg(target_os = "windows")]
        {
            std::process::Command::new("cmd").args(["/c", "start", url]).spawn()?.wait()?;
            return Ok(());
        }
        #[allow(unreachable_code)]
        Err(std::io::Error::new(std::io::ErrorKind::Other, "unsupported OS"))
    }
}

// Suppress dead-code warning on the Mutex import; reserved for future use.
#[allow(dead_code)]
fn _suppress_warning() {
    let _: Mutex<()> = Mutex::new(());
    let _: Duration = Duration::from_secs(0);
}
