//! Independent Julia lifecycle; never touches Foundry, Anne or a network client.
use crownkeep_decision::{DecisionRequest, DecisionResult, Engine, QUALIFIED_JOBS, VERSION};
use serde::Serialize;
use std::sync::Mutex;
use tauri::Manager;
static ENGINE: Mutex<Option<Engine>> = Mutex::new(None);
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status { available: bool, version: &'static str, backend: &'static str, load_state: &'static str, qualified_jobs: &'static [&'static str], detail: String }
fn directory(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(app.path().app_data_dir().map_err(|e| e.to_string())?.join("decision/julia-1"))
}
#[tauri::command]
pub fn crownkeep_decision_status(app: tauri::AppHandle) -> Result<Status, String> {
    let directory = directory(&app)?;
    let installed = ["model.onnx", "model.onnx.data", "tokenizer.json", "onnxruntime.dll"].iter().all(|x| directory.join(x).is_file());
    let loaded = ENGINE.lock().map_err(|e| e.to_string())?.is_some();
    Ok(Status { available: installed, version: VERSION, backend: "ONNX Runtime CPU", load_state: if loaded { "loaded" } else if installed { "unloaded" } else { "unavailable" }, qualified_jobs: QUALIFIED_JOBS,
        detail: format!("{} Assets: {}. Production categories require CrownKeep held-out evaluation and Windows memory/latency acceptance.", if installed { "Local assets staged; checksum/load verified before inference." } else { "Julia native assets not installed; no automatic download." }, directory.display()) })
}
#[tauri::command]
pub async fn crownkeep_decide(app: tauri::AppHandle, request: DecisionRequest) -> Result<DecisionResult, String> {
    if !QUALIFIED_JOBS.contains(&request.job.as_str()) { return Err("Julia judgment category is not production qualified.".into()); }
    let directory = directory(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let mut engine = ENGINE.lock().map_err(|e| e.to_string())?;
        if engine.is_none() { *engine = Some(Engine::load(&directory)?); }
        engine.as_mut().ok_or("Julia unavailable")?.decide(&request)
    }).await.map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn crownkeep_decision_release() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(|| { *ENGINE.lock().map_err(|e| e.to_string())? = None; Ok(()) }).await.map_err(|e| e.to_string())?
}
