use tauri::command;

#[command]
// Get the BPM of a local audio file
pub fn get_bpm(file_path: &str) -> String {
    // Load the audio file
    let _audio_file = std::fs::read(file_path).expect("Failed to read audio file");

    // Get the BPM of the audio file using

    return "BPM".to_string();
}
