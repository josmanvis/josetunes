// Prevents additional console window on Windows in release, DO NOT REMOVE!!
// #![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod bpm;
mod commands; // Add this line to include the commands module // Add this line to include the bpm module

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::download_audio,
            commands::fetch_artwork_html,
            // bpm::get_bpm // Add this line to include the get_bpm command
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
