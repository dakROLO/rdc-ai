use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CrownKeepHostInfo {
    host: &'static str,
    platform: &'static str,
    arch: &'static str,
    version: &'static str,
    runtime_control_available: bool,
}

#[tauri::command]
fn crownkeep_host_info() -> CrownKeepHostInfo {
    CrownKeepHostInfo {
        host: "tauri",
        platform: std::env::consts::OS,
        arch: std::env::consts::ARCH,
        version: env!("CARGO_PKG_VERSION"),
        runtime_control_available: false,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![crownkeep_host_info])
        .run(tauri::generate_context!())
        .expect("error while running CrownKeep");
}
