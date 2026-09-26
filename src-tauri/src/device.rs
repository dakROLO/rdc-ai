use serde::Serialize;
use std::hash::{Hash, Hasher};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceProfile {
    fingerprint: String,
    memory_mb: Option<u64>,
    detail: String,
}

#[tauri::command]
pub async fn crownkeep_device_profile() -> Result<DeviceProfile, String> {
    let manager = super::foundry_manager()?;
    let hardware = tauri::async_runtime::spawn_blocking(inspect_hardware)
        .await
        .map_err(|e| e.to_string())??;

    let mut providers: Vec<_> = manager
        .discover_eps()
        .map_err(|e| e.to_string())?
        .into_iter()
        .map(|ep| format!("{}:{}", ep.name, ep.is_registered))
        .collect();
    providers.sort();

    let mut variants = Vec::new();
    for model in manager
        .catalog()
        .get_models()
        .await
        .map_err(|e| e.to_string())?
    {
        for variant in model.variants() {
            variants.push(variant.id().to_string());
        }
    }
    variants.sort();

    let memory_mb = hardware["memoryMb"].as_u64();
    let cpu = hardware["cpu"].as_str().unwrap_or("unknown").to_string();
    let os = hardware["os"].as_str().unwrap_or("unknown").to_string();
    let mut gpus = hardware["gpu"]
        .as_array()
        .map(|items| {
            items
                .iter()
                .map(|item| {
                    format!(
                        "{}:{}",
                        item["Name"].as_str().unwrap_or("unknown"),
                        item["DriverVersion"].as_str().unwrap_or("unknown")
                    )
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    gpus.sort();

    let mut hash = std::collections::hash_map::DefaultHasher::new();
    // Fingerprints must change for durable capability changes, not because a
    // Foundry/ONNX DLL happened to be loaded at a different point in the app
    // lifecycle. Cache/load state and transient process-module state are omitted.
    (
        memory_mb,
        cpu.as_str(),
        os.as_str(),
        &gpus,
        &providers,
        &variants,
        "foundry-sdk-1.2.3-policy-3",
    )
        .hash(&mut hash);

    Ok(DeviceProfile {
        fingerprint: format!("{:016x}", hash.finish()),
        memory_mb,
        detail: format!(
            "{} MB system RAM · {} · {}. Memory fit is estimated; benchmark results decide.",
            memory_mb
                .map(|v| v.to_string())
                .unwrap_or_else(|| "Unknown".into()),
            cpu,
            hardware["gpu"]
                .as_array()
                .map(|items| {
                    items
                        .iter()
                        .filter_map(|item| item["Name"].as_str())
                        .collect::<Vec<_>>()
                        .join(", ")
                })
                .unwrap_or_else(|| "GPU details unavailable".into())
        ),
    })
}

#[cfg(target_os = "windows")]
fn inspect_hardware() -> Result<serde_json::Value, String> {
    use std::os::windows::process::CommandExt;

    // Fixed, read-only query. No shell text comes from the webview or user.
    let script = r#"
$ErrorActionPreference='Stop';
$ram=(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory;
$cpu=(Get-CimInstance Win32_Processor | Select-Object -First 1).Name;
$gpu=@(Get-CimInstance Win32_VideoController | Sort-Object Name | Select-Object Name,DriverVersion);
$os=(Get-CimInstance Win32_OperatingSystem).Version;
@{memoryMb=[math]::Floor($ram/1MB);cpu=$cpu;gpu=$gpu;os=$os} | ConvertTo-Json -Compress -Depth 4
"#;

    let output = std::process::Command::new("powershell.exe")
        .creation_flags(0x08000000)
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .output()
        .map_err(|e| format!("Hardware inspection failed: {e}"))?;

    if !output.status.success() {
        return Err("Windows hardware inspection unavailable. Retry device analysis.".into());
    }

    serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Hardware response invalid: {e}"))
}

#[cfg(not(target_os = "windows"))]
fn inspect_hardware() -> Result<serde_json::Value, String> {
    Err("Windows hardware inspection is unavailable on this platform.".into())
}
