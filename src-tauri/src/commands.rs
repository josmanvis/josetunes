// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::command;

use regex::Regex;
use reqwest::blocking::get;
use serde::Serialize;

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// Binding for yt-dlp, we only need audio in the highest quality
#[command]
pub fn download_audio(url: &str, format: &str) -> Result<String, String> {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    let output_template = format!("{}/Downloads/%(title)s.%(ext)s", home);

    let output = std::process::Command::new("yt-dlp")
        .args(&[
            "-f",
            "bestaudio",
            "--extract-audio",
            "--audio-format",
            format,
            url,
            "-o",
            &output_template,
        ])
        .output()
        .map_err(|e| format!("Failed to run yt-dlp: {}. Is yt-dlp installed and in your PATH?", e))?;

    if output.status.success() {
        Ok("Downloaded audio".to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("yt-dlp failed: {}", stderr))
    }
}

#[derive(Serialize)]
struct Urls {
    urls: Vec<String>,
}

#[command]
pub fn fetch_artwork_html(url: &str) -> Result<String, String> {
    // Make a GET request to the provided URL
    let response = get(url).map_err(|err| err.to_string())?;
    let body = response.text().map_err(|err| err.to_string())?;

    // Create a regex to find all URLs ending with .jpg
    let re = Regex::new(r"https?://[^\s]+\.jpg").map_err(|err| err.to_string())?;

    // Find all matches and collect them into a vector
    let urls: Vec<String> = re
        .find_iter(&body)
        .map(|mat| mat.as_str().to_string())
        .collect();

    // Serialize the vector as JSON
    let json = serde_json::to_string(&Urls { urls }).map_err(|err| err.to_string())?;

    Ok(json)
}
