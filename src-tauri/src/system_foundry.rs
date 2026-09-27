//! Thin bridge to the installed `foundry` CLI. This module deliberately owns no
//! cache path, model selection, or execution-provider preference.
use serde::Serialize;
use std::process::Command;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionResult { pub supported: bool, pub detail: String }

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelSummary { pub id: String, pub alias: String }

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStatus {
    pub sdk_ready: bool,
    pub service_urls: Vec<String>,
    pub catalog_model_count: usize,
    pub cached_models: Vec<ModelSummary>,
    pub loaded_models: Vec<ModelSummary>,
    pub runtime_version: Option<String>,
    pub cache_location: Option<String>,
    pub authority: String,
    pub legacy_cache_location: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelCandidate {
    pub id: String,
    pub alias: String,
    pub display_name: String,
    pub cached: bool,
    pub loaded: bool,
    pub device: Option<String>,
    pub execution_provider: Option<String>,
    pub file_size_mb: Option<u64>,
    pub context_length: Option<u64>,
    pub model_type: String,
    pub task: Option<String>,
    pub supports_tool_calling: Option<bool>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionProviderStatus { pub name: String, pub registered: bool, pub registration_attempted: bool, pub registration_succeeded: bool }

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceAnalysis { pub devices: Vec<String>, pub execution_providers: Vec<ExecutionProviderStatus>, pub accelerated_variant_count: usize, pub cpu_variant_count: usize, pub detail: String }

fn run(args: &[&str]) -> Result<String, String> {
    let output = Command::new("foundry").args(args).output().map_err(|error| {
        format!("System Foundry is unavailable. Install it or add 'foundry' to PATH: {error}")
    })?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if !output.status.success() {
        return Err(format!("System Foundry command `foundry {}` failed: {}", args.join(" "), if stderr.is_empty() { stdout } else { stderr }));
    }
    Ok(if stdout.is_empty() { stderr } else { stdout })
}

fn lines_as_models(value: &str) -> Vec<ModelSummary> {
    value.lines().filter_map(|line| {
        let line = line.trim();
        if line.is_empty() || line.starts_with('-') || line.to_ascii_lowercase().contains("model") && line.contains("cached") { return None; }
        let id = line.split_whitespace().next()?.trim_matches(|c: char| c == '|' || c == '*').to_string();
        if id.eq_ignore_ascii_case("id") || id.eq_ignore_ascii_case("name") { return None; }
        let alias = id.split(':').next().unwrap_or(&id).to_string();
        Some(ModelSummary { id, alias })
    }).collect()
}

fn service_urls(status: &str) -> Vec<String> {
    status.split_whitespace().filter(|token| token.starts_with("http://") || token.starts_with("https://"))
        .map(|value| value.trim_matches(|c: char| ",.;()[]".contains(c)).to_string()).collect()
}

fn legacy_path() -> String {
    std::env::var("USERPROFILE").map(|home| format!("{home}\\.CrownKeep\\cache\\models")).unwrap_or_else(|_| "~/.CrownKeep/cache/models".into())
}

fn status() -> Result<RuntimeStatus, String> {
    let version = run(&["--version"])?;
    let cache = run(&["cache", "location"])?;
    let server = run(&["server", "status"]).unwrap_or_default();
    let cached = lines_as_models(&run(&["cache", "list"]).unwrap_or_default());
    let loaded = lines_as_models(&run(&["model", "list", "--loaded", "--variants"]).unwrap_or_default());
    let catalog = lines_as_models(&run(&["model", "list", "--variants"]).unwrap_or_default());
    // The REST service is authoritative for loaded models. The frontend confirms
    // it through /v1/models before enabling Send.
    Ok(RuntimeStatus { sdk_ready: true, service_urls: service_urls(&server), catalog_model_count: catalog.len(), cached_models: cached, loaded_models: loaded, runtime_version: Some(version), cache_location: Some(cache), authority: "Installed System Foundry CLI/service".into(), legacy_cache_location: legacy_path() })
}

#[tauri::command]
pub async fn crownkeep_system_foundry_status() -> Result<RuntimeStatus, String> { status() }

#[tauri::command]
pub async fn crownkeep_system_foundry_endpoint() -> Result<String, String> {
    status()?.service_urls.into_iter().next().ok_or_else(|| "System Foundry service is not running. Start it with `foundry server start`.".into())
}

#[tauri::command]
pub async fn crownkeep_system_foundry_models() -> Result<Vec<ModelCandidate>, String> {
    let snapshot = status()?;
    let catalog = lines_as_models(&run(&["model", "list", "--variants"]).unwrap_or_default());
    Ok(catalog.into_iter().map(|model| ModelCandidate {
        cached: snapshot.cached_models.iter().any(|cached| cached.id == model.id || cached.alias == model.alias),
        loaded: snapshot.loaded_models.iter().any(|loaded| loaded.id == model.id || loaded.alias == model.alias), display_name: model.alias.clone(), id: model.id, alias: model.alias,
        device: None, execution_provider: None, file_size_mb: None, context_length: None,
        model_type: "unknown".into(), task: None, supports_tool_calling: None,
    }).collect())
}

#[tauri::command]
pub async fn crownkeep_system_foundry_analyze_device() -> Result<DeviceAnalysis, String> {
    let report = run(&["report"]).unwrap_or_default();
    let mut devices = Vec::new();
    for (needle, label) in [("CUDA", "GPU"), ("TensorRT", "GPU"), ("OpenVINO", "NPU/GPU"), ("NPU", "NPU"), ("CPU", "CPU")] {
        if report.to_ascii_lowercase().contains(&needle.to_ascii_lowercase()) && !devices.iter().any(|item: &String| item == label) { devices.push(label.into()); }
    }
    Ok(DeviceAnalysis { devices, execution_providers: Vec::new(), accelerated_variant_count: 0, cpu_variant_count: 0, detail: "System Foundry report inspected. Provider/variant selection remains owned by System Foundry; benchmark aliases rather than ranking providers in CrownKeep.".into() })
}

#[tauri::command]
pub async fn crownkeep_system_foundry_start() -> Result<ActionResult, String> { run(&["server", "start"])?; Ok(ActionResult { supported: true, detail: "Started the installed System Foundry service.".into() }) }
#[tauri::command]
pub async fn crownkeep_system_foundry_stop() -> Result<ActionResult, String> { run(&["server", "stop"])?; Ok(ActionResult { supported: true, detail: "Stopped the installed System Foundry service.".into() }) }
#[tauri::command]
pub async fn crownkeep_system_foundry_install_model(model_id: String) -> Result<ActionResult, String> { run(&["model", "download", &model_id])?; Ok(ActionResult { supported: true, detail: format!("System Foundry downloaded alias '{model_id}'.") }) }
#[tauri::command]
pub async fn crownkeep_system_foundry_activate_model(model_id: String) -> Result<ActionResult, String> { run(&["model", "load", &model_id])?; let _ = run(&["server", "start"]); Ok(ActionResult { supported: true, detail: format!("System Foundry activated alias '{model_id}'. CrownKeep will confirm the actual /v1 model before chat.") }) }
#[tauri::command]
pub async fn crownkeep_system_foundry_load_model(model_id: String) -> Result<ActionResult, String> { crownkeep_system_foundry_activate_model(model_id).await }
#[tauri::command]
pub async fn crownkeep_system_foundry_unload_model(model_id: String) -> Result<ActionResult, String> { run(&["model", "unload", &model_id])?; Ok(ActionResult { supported: true, detail: format!("System Foundry unloaded '{model_id}'.") }) }
#[tauri::command]
pub async fn crownkeep_system_foundry_remove_cached_model(model_id: String) -> Result<ActionResult, String> { run(&["cache", "remove", &model_id, "--force"])?; Ok(ActionResult { supported: true, detail: format!("System Foundry removed cached model '{model_id}'.") }) }
