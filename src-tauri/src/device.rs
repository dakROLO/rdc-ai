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
        .await.map_err(|e| e.to_string())??;
    let mut providers: Vec<_> = manager.discover_eps().map_err(|e| e.to_string())?
        .into_iter().map(|ep| format!("{}:{}", ep.name, ep.is_registered)).collect();
    providers.sort();
    let mut variants = Vec::new();
    for model in manager.catalog().get_models().await.map_err(|e| e.to_string())? {
        for variant in model.variants() { variants.push(variant.id().to_string()); }
    }
    variants.sort();
    let mut hash = std::collections::hash_map::DefaultHasher::new();
    // Deliberately omit cache/load state and available RAM: ordinary use must not
    // invalidate the profile. Hardware names, drivers, OS build, EPs and catalog do.
    (hardware.to_string(), providers, variants, "foundry-sdk-1.2.3-policy-2").hash(&mut hash);
    let memory_mb = hardware["memoryMb"].as_u64();
    Ok(DeviceProfile {
        fingerprint: format!("{:016x}", hash.finish()),
        memory_mb,
        detail: format!("{} MB system RAM · {} · {}. Memory fit is estimated; benchmark results decide.",
            memory_mb.map(|v| v.to_string()).unwrap_or_else(|| "Unknown".into()),
            hardware["cpu"].as_str().unwrap_or("Hardware inspection incomplete"),
            hardware["gpu"].as_array().map(|items| items.iter().filter_map(|item| item["Name"].as_str()).collect::<Vec<_>>().join(", ")).unwrap_or_else(|| "GPU details unavailable".into())),
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
$runtime=@((Get-Process -Id CROWNKEEP_PROCESS_ID).Modules | Where-Object {$_.ModuleName -match '^(Microsoft.AI.Foundry.Local.Core|onnxruntime|onnxruntime-genai|Microsoft.Windows.AI.MachineLearning)\.dll$'} | Sort-Object ModuleName | ForEach-Object { @{name=$_.ModuleName;version=$_.FileVersionInfo.FileVersion} });
@{memoryMb=[math]::Floor($ram/1MB);cpu=$cpu;gpu=$gpu;os=$os;runtime=$runtime} | ConvertTo-Json -Compress -Depth 4
"#.replace("CROWNKEEP_PROCESS_ID", &std::process::id().to_string());
    let output = std::process::Command::new("powershell.exe")
        .creation_flags(0x08000000)
        .args(["-NoProfile", "-NonInteractive", "-Command", script.as_str()]).output().map_err(|e| format!("Hardware inspection failed: {e}"))?;
    if !output.status.success() { return Err("Windows hardware inspection unavailable. Retry device analysis.".into()); }
    serde_json::from_slice(&output.stdout).map_err(|e| format!("Hardware response invalid: {e}"))
}
#[cfg(not(target_os = "windows"))]
fn inspect_hardware() -> Result<serde_json::Value, String> {
    Err("Windows hardware inspection is unavailable on this platform.".into())
}
