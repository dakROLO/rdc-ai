//! Independent Julia lifecycle; never touches Foundry or Anne.
//! Network access exists only in the explicit user-triggered installer.
use crownkeep_decision::{
    verify_directory, DecisionRequest, DecisionResult, Engine, QUALIFIED_JOBS, VERSION,
};
use serde::Serialize;
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    process::Command,
    sync::Mutex,
};
use tauri::Manager;

static ENGINE: Mutex<Option<Engine>> = Mutex::new(None);

const JULIA_REVISION: &str = "82a2fadf8fccfccdc5fd4e1009ba8f1a265eb7a8";
const ORT_VERSION: &str = "1.22.0";
const SUPPORTED_JOBS: &[&str] = &[
    "model-route",
    "tool-choice",
    "tool-arguments",
    "tool-result",
];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    available: bool,
    version: &'static str,
    backend: &'static str,
    load_state: &'static str,
    qualified_jobs: &'static [&'static str],
    detail: String,
}

fn directory(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("decision/julia-1"))
}

fn installed(directory: &Path) -> bool {
    ["model.onnx", "model.onnx.data", "tokenizer.json", "onnxruntime.dll"]
        .iter()
        .all(|name| directory.join(name).is_file())
}

#[tauri::command]
pub fn crownkeep_decision_status(app: tauri::AppHandle) -> Result<Status, String> {
    let directory = directory(&app)?;
    let installed = installed(&directory);
    let loaded = ENGINE.lock().map_err(|e| e.to_string())?.is_some();
    Ok(Status {
        available: installed,
        version: VERSION,
        backend: "ONNX Runtime CPU",
        load_state: if loaded {
            "loaded"
        } else if installed {
            "unloaded"
        } else {
            "unavailable"
        },
        qualified_jobs: QUALIFIED_JOBS,
        detail: format!(
            "{} Assets: {}. Production categories still require CrownKeep qualification; installed Julia may run shadow judgments locally.",
            if installed {
                "Local assets are installed and checksum-verified before first use."
            } else {
                "Julia is not installed. Use Download Julia inside the Keep; nothing downloads automatically."
            },
            directory.display()
        ),
    })
}

async fn download_to(
    client: &reqwest::Client,
    url: &str,
    destination: &Path,
) -> Result<(), String> {
    let mut response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Could not download Julia asset: {e}"))?
        .error_for_status()
        .map_err(|e| format!("Julia asset download failed: {e}"))?;

    let mut file = fs::File::create(destination)
        .map_err(|e| format!("Could not create {}: {e}", destination.display()))?;

    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|e| format!("Julia asset download interrupted: {e}"))?
    {
        file.write_all(&chunk)
            .map_err(|e| format!("Could not write {}: {e}", destination.display()))?;
    }
    file.flush().map_err(|e| e.to_string())?;
    Ok(())
}

fn find_file(root: &Path, name: &str) -> Option<PathBuf> {
    for entry in fs::read_dir(root).ok()?.flatten() {
        let path = entry.path();
        if path.file_name().and_then(|value| value.to_str()) == Some(name) {
            return Some(path);
        }
        if path.is_dir() {
            if let Some(found) = find_file(&path, name) {
                return Some(found);
            }
        }
    }
    None
}

fn extract_ort(archive: &Path, destination: &Path) -> Result<(), String> {
    fs::create_dir_all(destination).map_err(|e| e.to_string())?;
    let tar = Command::new("tar")
        .arg("-xf")
        .arg(archive)
        .arg("-C")
        .arg(destination)
        .status();

    if matches!(tar, Ok(status) if status.success()) {
        return Ok(());
    }

    let script = format!(
        "Expand-Archive -LiteralPath '{}' -DestinationPath '{}' -Force",
        archive.display().to_string().replace('\'', "''"),
        destination.display().to_string().replace(''', "''"),
    );
    let status = Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .status()
        .map_err(|e| format!("Could not start the Windows archive extractor: {e}"))?;
    if !status.success() {
        return Err("Could not extract the pinned ONNX Runtime package.".into());
    }
    Ok(())
}

#[tauri::command]
pub async fn crownkeep_decision_install(app: tauri::AppHandle) -> Result<Status, String> {
    let directory = directory(&app)?;
    let parent = directory
        .parent()
        .ok_or("Julia install directory has no parent.")?
        .to_path_buf();
    fs::create_dir_all(&parent).map_err(|e| e.to_string())?;
    *ENGINE.lock().map_err(|e| e.to_string())? = None;

    let staging = tempfile::Builder::new()
        .prefix(".julia-install-")
        .tempdir_in(&parent)
        .map_err(|e| format!("Could not create Julia staging directory: {e}"))?;
    let payload = staging.path().join("payload");
    fs::create_dir_all(&payload).map_err(|e| e.to_string())?;

    let base = format!(
        "https://huggingface.co/SupersonicLabs/Julia-1-ONNX/resolve/{JULIA_REVISION}"
    );
    let client = reqwest::Client::builder()
        .user_agent("CrownKeep/JuliaInstaller")
        .build()
        .map_err(|e| e.to_string())?;

    download_to(&client, &format!("{base}/model.onnx"), &payload.join("model.onnx")).await?;
    download_to(
        &client,
        &format!("{base}/model.onnx.data"),
        &payload.join("model.onnx.data"),
    )
    .await?;
    download_to(
        &client,
        &format!("{base}/tokenizer.json"),
        &payload.join("tokenizer.json"),
    )
    .await?;

    let ort_archive = staging.path().join("onnxruntime.zip");
    let ort_url = format!(
        "https://github.com/microsoft/onnxruntime/releases/download/v{ORT_VERSION}/onnxruntime-win-x64-{ORT_VERSION}.zip"
    );
    download_to(&client, &ort_url, &ort_archive).await?;
    let ort_expanded = staging.path().join("onnxruntime");
    extract_ort(&ort_archive, &ort_expanded)?;

    let dll = find_file(&ort_expanded, "onnxruntime.dll")
        .ok_or("The pinned ONNX Runtime package did not contain onnxruntime.dll.")?;
    fs::copy(&dll, payload.join("onnxruntime.dll"))
        .map_err(|e| format!("Could not stage ONNX Runtime: {e}"))?;

    if let Some(license) = find_file(&ort_expanded, "LICENSE") {
        let _ = fs::copy(license, payload.join("ONNXRUNTIME-LICENSE.txt"));
    }

    verify_directory(&payload)?;

    if directory.exists() {
        fs::remove_dir_all(&directory)
            .map_err(|e| format!("Could not replace the existing Julia package: {e}"))?;
    }
    fs::rename(&payload, &directory)
        .map_err(|e| format!("Could not activate the verified Julia package: {e}"))?;

    crownkeep_decision_status(app)
}

#[tauri::command]
pub async fn crownkeep_decision_remove(app: tauri::AppHandle) -> Result<Status, String> {
    *ENGINE.lock().map_err(|e| e.to_string())? = None;
    let directory = directory(&app)?;
    if directory.exists() {
        fs::remove_dir_all(&directory)
            .map_err(|e| format!("Could not remove Julia from this device: {e}"))?;
    }
    crownkeep_decision_status(app)
}

#[tauri::command]
pub async fn crownkeep_decide(
    app: tauri::AppHandle,
    request: DecisionRequest,
) -> Result<DecisionResult, String> {
    if !SUPPORTED_JOBS.contains(&request.job.as_str()) {
        return Err("Unsupported Julia judgment category.".into());
    }
    let directory = directory(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let mut engine = ENGINE.lock().map_err(|e| e.to_string())?;
        if engine.is_none() {
            *engine = Some(Engine::load(&directory)?);
        }
        engine
            .as_mut()
            .ok_or("Julia unavailable")?
            .decide(&request)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn crownkeep_decision_release() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(|| {
        *ENGINE.lock().map_err(|e| e.to_string())? = None;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}
