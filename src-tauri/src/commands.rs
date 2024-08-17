// Prevents additional console window on Windows in release, DO NOT REMOVE!!
// #![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use regex::Regex;
use reqwest::blocking::get;
use serde::Serialize;
use std::env;
use std::path::Path;
use std::process::Command;
use tauri::command;

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// Binding for yt-dlp, we only need audio in the highest quality

#[command]
pub fn download_audio(url: &str, format: &str) -> String {
    let home_dir = env::var("HOME")
        .or_else(|_| env::var("USERPROFILE"))
        .expect("Failed to get home directory");
    let downloads_path = Path::new(&home_dir).join("Downloads");
    let output_path = downloads_path.join("%(title)s.%(ext)s");

    let output = Command::new("yt-dlp")
        .args(&[
            "-f",
            "bestaudio",
            "--extract-audio",
            "--audio-format",
            format,
            url,
            "-o",
            output_path.to_str().unwrap(),
        ])
        .output()
        .expect("failed to execute process");

    output.status.success().to_string()
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
