// vflics Studio desktop shell
//
// Wraps the existing Next.js dev server (or built static export) in a native
// window. The web app itself is unchanged — Tauri just renders it via WKWebView
// on macOS instead of Safari/Chrome.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod oauth;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            oauth::start_oauth,
            oauth::signed_in_email,
            oauth::sign_out,
            oauth::upload_to_drive,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
