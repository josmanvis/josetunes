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
pub fn download_audio(url: &str, format: &str) -> String {
    let output = std::process::Command::new("yt-dlp")
        .args(&[
            "-f",
            "bestaudio",
            "--extract-audio",
            "--audio-format",
            format,
            url,
            "-o",
            "~/Downloads/%(title)s.%(ext)s",
        ])
        .output()
        .expect("failed to execute process");

    return output.status.success().to_string();
    // if output.status.success() {
    //     return "Downloaded audio".to_string();
    // } else {
    //     return "Failed to download audio".to_string();
    // }
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
