use foundry_local_sdk::{FoundryLocalConfig, FoundryLocalManager};
use serde::Serialize;

const FOUNDRY_WEB_URL: &str = "http://127.0.0.1:39839";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CrownKeepHostInfo {
    host: &'static str,
    platform: &'static str,
    arch: &'static str,
    version: &'static str,
    runtime_control_available: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FoundryModelSummary {
    id: String,
    alias: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FoundryRuntimeStatus {
    sdk_ready: bool,
    service_urls: Vec<String>,
    catalog_model_count: usize,
    cached_models: Vec<FoundryModelSummary>,
    loaded_models: Vec<FoundryModelSummary>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FoundryActionResult {
    supported: bool,
    detail: String,
}

fn foundry_manager() -> Result<&'static FoundryLocalManager, String> {
    let config = FoundryLocalConfig::new("CrownKeep")
        .web_service_urls(FOUNDRY_WEB_URL);

    FoundryLocalManager::create(config)
        .map_err(|error| format!("Foundry Local SDK initialization failed: {error}"))
}

async fn resolve_model(alias_or_id: &str) -> Result<std::sync::Arc<foundry_local_sdk::Model>, String> {
    let manager = foundry_manager()?;
    let catalog = manager.catalog();

    if let Ok(model) = catalog.get_model_variant(alias_or_id).await {
        return Ok(model);
    }

    catalog
        .get_model(alias_or_id)
        .await
        .map_err(|error| format!("Foundry Local could not resolve model '{alias_or_id}': {error}"))
}

#[tauri::command]
fn crownkeep_host_info() -> CrownKeepHostInfo {
    CrownKeepHostInfo {
        host: "tauri",
        platform: std::env::consts::OS,
        arch: std::env::consts::ARCH,
        version: env!("CARGO_PKG_VERSION"),
        runtime_control_available: true,
    }
}

#[tauri::command]
async fn crownkeep_foundry_status() -> Result<FoundryRuntimeStatus, String> {
    let manager = foundry_manager()?;
    let catalog = manager.catalog();

    let models = catalog
        .get_models()
        .await
        .map_err(|error| format!("Foundry Local catalog discovery failed: {error}"))?;

    let cached = catalog
        .get_cached_models()
        .await
        .map_err(|error| format!("Foundry Local cached-model discovery failed: {error}"))?;

    let loaded = catalog
        .get_loaded_models()
        .await
        .map_err(|error| format!("Foundry Local loaded-model discovery failed: {error}"))?;

    let service_urls = manager
        .urls()
        .map_err(|error| format!("Foundry Local service URL inspection failed: {error}"))?;

    Ok(FoundryRuntimeStatus {
        sdk_ready: true,
        service_urls,
        catalog_model_count: models.len(),
        cached_models: cached
            .iter()
            .map(|model| FoundryModelSummary {
                id: model.id().to_string(),
                alias: model.alias().to_string(),
            })
            .collect(),
        loaded_models: loaded
            .iter()
            .map(|model| FoundryModelSummary {
                id: model.id().to_string(),
                alias: model.alias().to_string(),
            })
            .collect(),
    })
}

#[tauri::command]
async fn crownkeep_foundry_start() -> Result<FoundryActionResult, String> {
    let manager = foundry_manager()?;

    if !manager
        .urls()
        .map_err(|error| format!("Foundry Local service inspection failed: {error}"))?
        .is_empty()
    {
        return Ok(FoundryActionResult {
            supported: true,
            detail: "CrownKeep's embedded Foundry Local service is already running.".into(),
        });
    }

    manager
        .start_web_service()
        .await
        .map_err(|error| format!("Could not start CrownKeep's embedded Foundry Local service: {error}"))?;

    let urls = manager
        .urls()
        .map_err(|error| format!("Foundry Local started but its service URL could not be read: {error}"))?;

    Ok(FoundryActionResult {
        supported: true,
        detail: format!(
            "CrownKeep started Foundry Local at {}.",
            urls.first().map(String::as_str).unwrap_or(FOUNDRY_WEB_URL)
        ),
    })
}

#[tauri::command]
async fn crownkeep_foundry_stop() -> Result<FoundryActionResult, String> {
    let manager = foundry_manager()?;

    if manager
        .urls()
        .map_err(|error| format!("Foundry Local service inspection failed: {error}"))?
        .is_empty()
    {
        return Ok(FoundryActionResult {
            supported: true,
            detail: "CrownKeep's embedded Foundry Local service is already stopped.".into(),
        });
    }

    manager
        .stop_web_service()
        .await
        .map_err(|error| format!("Could not stop CrownKeep's embedded Foundry Local service: {error}"))?;

    Ok(FoundryActionResult {
        supported: true,
        detail: "CrownKeep stopped its embedded Foundry Local service.".into(),
    })
}

#[tauri::command]
async fn crownkeep_foundry_install_model(model_id: String) -> Result<FoundryActionResult, String> {
    let manager = foundry_manager()?;

    manager
        .download_and_register_eps(None)
        .await
        .map_err(|error| format!("Foundry Local execution-provider setup failed: {error}"))?;

    let model = resolve_model(&model_id).await?;

    if !model
        .is_cached()
        .await
        .map_err(|error| format!("Could not inspect Foundry Local model cache state: {error}"))?
    {
        model
            .download(None::<fn(f64)>)
            .await
            .map_err(|error| format!("Could not download Foundry Local model '{model_id}': {error}"))?;
    }

    Ok(FoundryActionResult {
        supported: true,
        detail: format!("Foundry Local model '{}' is available on this device.", model.alias()),
    })
}

#[tauri::command]
async fn crownkeep_foundry_load_model(model_id: String) -> Result<FoundryActionResult, String> {
    let model = resolve_model(&model_id).await?;

    model
        .load()
        .await
        .map_err(|error| format!("Could not load Foundry Local model '{model_id}': {error}"))?;

    Ok(FoundryActionResult {
        supported: true,
        detail: format!("Loaded Foundry Local model '{}'.", model.id()),
    })
}

#[tauri::command]
async fn crownkeep_foundry_unload_model(model_id: String) -> Result<FoundryActionResult, String> {
    let model = resolve_model(&model_id).await?;

    model
        .unload()
        .await
        .map_err(|error| format!("Could not unload Foundry Local model '{model_id}': {error}"))?;

    Ok(FoundryActionResult {
        supported: true,
        detail: format!("Unloaded Foundry Local model '{}'.", model.id()),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            crownkeep_host_info,
            crownkeep_foundry_status,
            crownkeep_foundry_start,
            crownkeep_foundry_stop,
            crownkeep_foundry_install_model,
            crownkeep_foundry_load_model,
            crownkeep_foundry_unload_model
        ])
        .run(tauri::generate_context!())
        .expect("error while running CrownKeep");
}
