use std::hash::{Hash, Hasher};

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceProfile { fingerprint: String, memory_mb: Option<u64>, detail: String }

#[tauri::command]
pub async fn crownkeep_device_profile() -> Result<DeviceProfile, String> {
    let (durable, memory_mb, detail) = super::system_foundry::foundry_device_profile().await?;
    let mut hash = std::collections::hash_map::DefaultHasher::new();
    // Foundry's current available-memory value is deliberately excluded: it is transient.
    (durable, "system-foundry-alias-policy-7").hash(&mut hash);
    Ok(DeviceProfile { fingerprint: format!("{:016x}", hash.finish()), memory_mb, detail })
}
