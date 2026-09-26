use foundry_local_sdk::{FoundryLocalConfig, FoundryLocalManager};
use serde::Serialize;
use tauri::Emitter;
mod speech;
mod device;

const FOUNDRY_WEB_URL: &str = "http://127.0.0.1:39839";
static FOUNDRY_LIFECYCLE_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

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
struct FoundryModelCandidate {
    id: String,
    alias: String,
    display_name: String,
    cached: bool,
    loaded: bool,
    device: Option<String>,
    execution_provider: Option<String>,
    file_size_mb: Option<u64>,
    context_length: Option<u64>,
    model_type: String,
    task: Option<String>,
    supports_tool_calling: Option<bool>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FoundryExecutionProviderStatus {
    name: String,
    registered: bool,
    registration_attempted: bool,
    registration_succeeded: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FoundryDeviceAnalysis {
    devices: Vec<String>,
    execution_providers: Vec<FoundryExecutionProviderStatus>,
    accelerated_variant_count: usize,
    cpu_variant_count: usize,
    detail: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FoundryActionResult {
    supported: bool,
    detail: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct FoundryOperationProgress {
    stage: String,
    message: String,
    model_id: Option<String>,
    alias: Option<String>,
    percent: Option<f64>,
}

fn emit_operation_progress(
    app: &tauri::AppHandle,
    stage: &str,
    message: impl Into<String>,
    model_id: Option<String>,
    alias: Option<String>,
    percent: Option<f64>,
) {
    let _ = app.emit(
        "crownkeep-foundry-operation-progress",
        FoundryOperationProgress {
            stage: stage.to_string(),
            message: message.into(),
            model_id,
            alias,
            percent,
        },
    );
}

fn foundry_manager() -> Result<&'static FoundryLocalManager, String> {
    let config = FoundryLocalConfig::new("CrownKeep")
        .web_service_urls(FOUNDRY_WEB_URL);

    FoundryLocalManager::create(config).map_err(|error| {
        eprintln!("[CrownKeep/Foundry] SDK initialization failed: {error}");
        format!("Foundry Local SDK initialization failed: {error}")
    })
}

fn normalized_model_key(value: &str) -> String {
    value
        .split(':')
        .next()
        .unwrap_or(value)
        .trim()
        .to_ascii_lowercase()
}


fn run_foundry_cache_remove(model_id: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    use std::os::windows::process::CommandExt;

    fn run(args: &[&str]) -> Result<std::process::Output, String> {
        let mut command = std::process::Command::new("foundry");
        #[cfg(target_os = "windows")]
        command.creation_flags(0x08000000);
        command
            .args(args)
            .output()
            .map_err(|error| format!("Could not start Foundry Local CLI: {error}"))
    }

    let first = run(&["cache", "remove", model_id, "--force"])?;
    if first.status.success() {
        return Ok(());
    }

    // Newer preview builds renamed remove to rm; support both forms.
    let second = run(&["cache", "rm", model_id, "--force"])?;
    if second.status.success() {
        return Ok(());
    }

    let first_error = String::from_utf8_lossy(&first.stderr).trim().to_string();
    let second_error = String::from_utf8_lossy(&second.stderr).trim().to_string();
    Err(format!(
        "Foundry Local could not remove cached model '{}'. remove: {} rm: {}",
        model_id,
        if first_error.is_empty() { "command failed" } else { first_error.as_str() },
        if second_error.is_empty() { "command failed" } else { second_error.as_str() },
    ))
}

async fn resolve_model(alias_or_id: &str) -> Result<std::sync::Arc<foundry_local_sdk::Model>, String> {
    let manager = foundry_manager()?;
    let catalog = manager.catalog();

    if let Ok(model) = catalog.get_model_variant(alias_or_id).await {
        return Ok(model);
    }

    if let Ok(model) = catalog.get_model(alias_or_id).await {
        return Ok(model);
    }

    // The OpenAI-compatible service can expose an unversioned variant ID
    // (for example "Phi-4-mini-instruct-generic-cpu") while the catalog keeps
    // the native variant as "Phi-4-mini-instruct-generic-cpu:5". Match those
    // forms so a previously verified provider model can be restored natively.
    let requested = normalized_model_key(alias_or_id);
    let models = catalog
        .get_models()
        .await
        .map_err(|error| format!("Foundry Local catalog lookup failed: {error}"))?;

    for model in models {
        for variant in model.variants() {
            let info = variant.info();
            if normalized_model_key(&info.id) == requested
                || info.alias.to_ascii_lowercase() == requested
            {
                eprintln!(
                    "[CrownKeep/Foundry] resolved provider model '{}' to native variant '{}'",
                    alias_or_id,
                    info.id
                );
                return Ok(variant);
            }
        }
    }

    Err(format!(
        "Foundry Local could not resolve model '{}'. Try the model alias shown in Local Model Analyst.",
        alias_or_id
    ))
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
async fn crownkeep_foundry_models() -> Result<Vec<FoundryModelCandidate>, String> {
    use std::collections::HashSet;

    let manager = foundry_manager()?;
    let catalog = manager.catalog();

    let models = catalog
        .get_models()
        .await
        .map_err(|error| format!("Foundry Local catalog discovery failed: {error}"))?;

    let loaded = catalog
        .get_loaded_models()
        .await
        .map_err(|error| format!("Foundry Local loaded-model discovery failed: {error}"))?;

    let loaded_ids: HashSet<String> = loaded
        .iter()
        .map(|model| model.id().to_string())
        .collect();

    let mut candidates = Vec::new();

    for model in models {
        for variant in model.variants() {
            let info = variant.info();
            let runtime = info.runtime.as_ref();
            let cached = variant.is_cached().await.unwrap_or(info.cached);
            candidates.push(FoundryModelCandidate {
                id: info.id.clone(),
                alias: info.alias.clone(),
                display_name: info
                    .display_name
                    .clone()
                    .unwrap_or_else(|| info.name.clone()),
                cached,
                loaded: loaded_ids.contains(&info.id),
                device: runtime.map(|value| format!("{:?}", value.device_type)),
                execution_provider: runtime.map(|value| value.execution_provider.clone()),
                file_size_mb: info.file_size_mb,
                context_length: info.context_length,
                model_type: info.model_type.clone(),
                task: info.task.clone(),
                supports_tool_calling: info.supports_tool_calling,
            });
        }
    }

    candidates.sort_by(|left, right| {
        right
            .cached
            .cmp(&left.cached)
            .then_with(|| left.alias.cmp(&right.alias))
            .then_with(|| left.id.cmp(&right.id))
    });

    Ok(candidates)
}


#[tauri::command]
async fn crownkeep_foundry_analyze_device(app: tauri::AppHandle) -> Result<FoundryDeviceAnalysis, String> {
    use std::collections::BTreeSet;

    eprintln!("[CrownKeep/Foundry] stage=device-analysis discover-eps");
    let manager = foundry_manager()?;
    let catalog = manager.catalog();

    let _ = app.emit("crownkeep-analysis-progress", "Discovering execution providers…");
    let discovered = manager
        .discover_eps()
        .map_err(|error| format!("Foundry Local execution-provider discovery failed: {error}"))?;

    let mut ep_statuses = Vec::new();

    for ep in discovered {
        if ep.is_registered {
            ep_statuses.push(FoundryExecutionProviderStatus {
                name: ep.name,
                registered: true,
                registration_attempted: false,
                registration_succeeded: true,
            });
            continue;
        }

        let ep_name = ep.name.clone();
        let _ = app.emit("crownkeep-analysis-progress", format!("Registering {}…", ep_name));
        eprintln!(
            "[CrownKeep/Foundry] stage=device-analysis register-ep name={}",
            ep_name
        );

        let result = manager
            .download_and_register_eps(Some(&[ep_name.as_str()]))
            .await;

        match result {
            Ok(result) => {
                let succeeded = result.success
                    || result
                        .registered_eps
                        .iter()
                        .any(|registered| registered.eq_ignore_ascii_case(&ep_name));

                if succeeded {
                    eprintln!(
                        "[CrownKeep/Foundry] stage=device-analysis register-ep complete name={}",
                        ep_name
                    );
                } else {
                    eprintln!(
                        "[CrownKeep/Foundry] stage=device-analysis register-ep partial name={} status={}",
                        ep_name,
                        result.status
                    );
                }

                ep_statuses.push(FoundryExecutionProviderStatus {
                    name: ep_name,
                    registered: succeeded,
                    registration_attempted: true,
                    registration_succeeded: succeeded,
                });
            }
            Err(error) => {
                eprintln!(
                    "[CrownKeep/Foundry] stage=device-analysis register-ep failed name={} error={}",
                    ep_name,
                    error
                );
                ep_statuses.push(FoundryExecutionProviderStatus {
                    name: ep_name,
                    registered: false,
                    registration_attempted: true,
                    registration_succeeded: false,
                });
            }
        }
    }

    let _ = app.emit("crownkeep-analysis-progress", "Refreshing compatible model catalog…");
    catalog
        .update_models()
        .await
        .map_err(|error| format!("Foundry Local catalog refresh failed after device analysis: {error}"))?;

    let models = catalog
        .get_models()
        .await
        .map_err(|error| format!("Foundry Local model discovery failed after device analysis: {error}"))?;

    let mut devices = BTreeSet::new();
    let mut accelerated_variant_count = 0usize;
    let mut cpu_variant_count = 0usize;

    for model in models {
        for variant in model.variants() {
            if let Some(runtime) = variant.info().runtime.as_ref() {
                let device = format!("{:?}", runtime.device_type);
                devices.insert(device.clone());

                match device.as_str() {
                    "GPU" | "NPU" => accelerated_variant_count += 1,
                    "CPU" => cpu_variant_count += 1,
                    _ => {}
                }
            }
        }
    }

    let registered_count = ep_statuses.iter().filter(|ep| ep.registered).count();
    let failed_count = ep_statuses
        .iter()
        .filter(|ep| ep.registration_attempted && !ep.registration_succeeded)
        .count();

    let device_list: Vec<String> = devices.into_iter().collect();
    let detail = if accelerated_variant_count > 0 {
        format!(
            "Found {} execution provider(s) ready. Found {} accelerated model variant(s) across {}. Benchmark candidates on this device before choosing a preferred model.",
            registered_count,
            accelerated_variant_count,
            device_list.join(", ")
        )
    } else if failed_count > 0 {
        format!(
            "Found {} execution provider(s) ready, but {} provider registration attempt(s) failed. The refreshed catalog currently exposes CPU-only model variants.",
            registered_count,
            failed_count
        )
    } else {
        format!(
            "Found {} execution provider(s) ready. The refreshed catalog currently exposes CPU-only model variants on this device.",
            registered_count
        )
    };

    eprintln!(
        "[CrownKeep/Foundry] stage=device-analysis complete devices={} accelerated_variants={} cpu_variants={}",
        device_list.join(","),
        accelerated_variant_count,
        cpu_variant_count
    );

    Ok(FoundryDeviceAnalysis {
        devices: device_list,
        execution_providers: ep_statuses,
        accelerated_variant_count,
        cpu_variant_count,
        detail,
    })
}

#[tauri::command]
async fn crownkeep_foundry_start() -> Result<FoundryActionResult, String> {
    eprintln!("[CrownKeep/Foundry] stage=start-service");
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
        .map_err(|error| {
            eprintln!("[CrownKeep/Foundry] stage=start-service failed: {error}");
            format!("Could not start CrownKeep's embedded Foundry Local service: {error}")
        })?;

    let urls = manager
        .urls()
        .map_err(|error| format!("Foundry Local started but its service URL could not be read: {error}"))?;

    let url = urls.first().map(String::as_str).unwrap_or(FOUNDRY_WEB_URL);
    eprintln!("[CrownKeep/Foundry] stage=start-service ready url={url}");

    Ok(FoundryActionResult {
        supported: true,
        detail: format!("CrownKeep started Foundry Local at {url}."),
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

async fn ensure_model_cached(
    app: &tauri::AppHandle,
    model: &std::sync::Arc<foundry_local_sdk::Model>,
    requested_id: &str,
) -> Result<(), String> {
    let cached = model
        .is_cached()
        .await
        .map_err(|error| format!("Could not inspect Foundry Local model cache state: {error}"))?;

    if cached {
        emit_operation_progress(
            app,
            "download-complete",
            format!("{} is already downloaded.", model.alias()),
            Some(model.id().to_string()),
            Some(model.alias().to_string()),
            Some(100.0),
        );
        return Ok(());
    }

    eprintln!(
        "[CrownKeep/Foundry] stage=download-model begin alias={} id={}",
        model.alias(),
        model.id()
    );

    let progress_app = app.clone();
    let progress_id = model.id().to_string();
    let progress_alias = model.alias().to_string();
    model
        .download(Some(move |progress: f64| {
            let clamped = progress.clamp(0.0, 100.0);
            emit_operation_progress(
                &progress_app,
                "downloading",
                format!("Downloading {} · {:.0}%", progress_alias, clamped),
                Some(progress_id.clone()),
                Some(progress_alias.clone()),
                Some(clamped),
            );
        }))
        .await
        .map_err(|error| {
            eprintln!("[CrownKeep/Foundry] stage=download-model failed: {error}");
            format!("Could not download Foundry Local model '{requested_id}': {error}")
        })?;

    eprintln!("[CrownKeep/Foundry] stage=download-model complete");
    emit_operation_progress(
        app,
        "download-complete",
        format!("{} download complete.", model.alias()),
        Some(model.id().to_string()),
        Some(model.alias().to_string()),
        Some(100.0),
    );
    Ok(())
}

#[tauri::command]
async fn crownkeep_foundry_install_model(
    app: tauri::AppHandle,
    model_id: String,
) -> Result<FoundryActionResult, String> {
    eprintln!("[CrownKeep/Foundry] stage=resolve-model requested={model_id}");
    let model = resolve_model(&model_id).await.map_err(|error| {
        eprintln!("[CrownKeep/Foundry] stage=resolve-model failed: {error}");
        error
    })?;

    emit_operation_progress(
        &app,
        "preparing",
        format!("Preparing {}…", model.alias()),
        Some(model.id().to_string()),
        Some(model.alias().to_string()),
        None,
    );
    ensure_model_cached(&app, &model, &model_id).await?;

    Ok(FoundryActionResult {
        supported: true,
        detail: format!("Foundry Local model '{}' is available on this device.", model.alias()),
    })
}

#[tauri::command]
async fn crownkeep_foundry_activate_model(
    app: tauri::AppHandle,
    model_id: String,
) -> Result<FoundryActionResult, String> {
    let _guard = FOUNDRY_LIFECYCLE_LOCK.lock().await;
    let manager = foundry_manager()?;
    let model = resolve_model(&model_id).await?;
    let previous = manager
        .catalog()
        .get_loaded_models()
        .await
        .map_err(|error| format!("Could not inspect loaded Foundry models: {error}"))?;
    let service_was_running = !manager
        .urls()
        .map_err(|error| format!("Could not inspect Foundry service state: {error}"))?
        .is_empty();

    emit_operation_progress(
        &app,
        "stopping-service",
        "Pausing local inference before changing models…",
        Some(model.id().to_string()),
        Some(model.alias().to_string()),
        None,
    );
    if service_was_running {
        manager
            .stop_web_service()
            .await
            .map_err(|error| format!("Could not pause Foundry Local before model change: {error}"))?;
    }

    let result: Result<(), String> = async {
        ensure_model_cached(&app, &model, &model_id).await?;

        emit_operation_progress(
            &app,
            "unloading",
            "Releasing the previous local model…",
            Some(model.id().to_string()),
            Some(model.alias().to_string()),
            None,
        );
        for loaded in &previous {
            if normalized_model_key(loaded.id()) != normalized_model_key(model.id()) {
                loaded
                    .unload()
                    .await
                    .map_err(|error| format!("Could not unload '{}': {error}", loaded.id()))?;
            }
        }

        let target_already_loaded = previous
            .iter()
            .any(|loaded| normalized_model_key(loaded.id()) == normalized_model_key(model.id()));
        if !target_already_loaded {
            emit_operation_progress(
                &app,
                "loading",
                format!("Loading {}…", model.alias()),
                Some(model.id().to_string()),
                Some(model.alias().to_string()),
                None,
            );
            model
                .load()
                .await
                .map_err(|error| format!("Could not load '{}': {error}", model.id()))?;
        }

        emit_operation_progress(
            &app,
            "starting-service",
            "Starting local inference…",
            Some(model.id().to_string()),
            Some(model.alias().to_string()),
            None,
        );
        manager
            .start_web_service()
            .await
            .map_err(|error| format!("Could not start Foundry Local after model change: {error}"))?;
        Ok(())
    }
    .await;

    if let Err(error) = result {
        let _ = model.unload().await;
        for loaded in &previous {
            let _ = loaded.load().await;
        }
        if service_was_running {
            let _ = manager.start_web_service().await;
        }
        emit_operation_progress(
            &app,
            "error",
            format!("Model change failed; previous model restored. {error}"),
            Some(model.id().to_string()),
            Some(model.alias().to_string()),
            None,
        );
        return Err(error);
    }

    emit_operation_progress(
        &app,
        "ready",
        format!("{} is ready.", model.alias()),
        Some(model.id().to_string()),
        Some(model.alias().to_string()),
        Some(100.0),
    );

    Ok(FoundryActionResult {
        supported: true,
        detail: format!("Loaded Foundry Local model '{}'.", model.id()),
    })
}

#[tauri::command]
async fn crownkeep_foundry_load_model(model_id: String) -> Result<FoundryActionResult, String> {
    eprintln!("[CrownKeep/Foundry] stage=load-model requested={model_id}");
    let model = resolve_model(&model_id).await.map_err(|error| {
        eprintln!("[CrownKeep/Foundry] stage=load-model resolve failed: {error}");
        error
    })?;

    model
        .load()
        .await
        .map_err(|error| {
            eprintln!("[CrownKeep/Foundry] stage=load-model failed: {error}");
            format!("Could not load Foundry Local model '{model_id}': {error}")
        })?;

    eprintln!(
        "[CrownKeep/Foundry] stage=load-model complete alias={} id={}",
        model.alias(),
        model.id()
    );

    Ok(FoundryActionResult {
        supported: true,
        detail: format!("Loaded Foundry Local model '{}'.", model.id()),
    })
}

#[tauri::command]
async fn crownkeep_foundry_unload_model(model_id: String) -> Result<FoundryActionResult, String> {
    let _guard = FOUNDRY_LIFECYCLE_LOCK.lock().await;
    let manager = foundry_manager()?;
    let model = resolve_model(&model_id).await?;

    let loaded = manager
        .catalog()
        .get_loaded_models()
        .await
        .map_err(|error| format!("Could not inspect loaded Foundry models: {error}"))?;

    let target_loaded = loaded
        .iter()
        .any(|item| normalized_model_key(item.id()) == normalized_model_key(model.id()));

    if !target_loaded {
        return Ok(FoundryActionResult {
            supported: true,
            detail: format!("Foundry Local model '{}' is already unloaded.", model.id()),
        });
    }

    let service_was_running = !manager
        .urls()
        .map_err(|error| format!("Could not inspect Foundry Local service state: {error}"))?
        .is_empty();

    if service_was_running {
        manager
            .stop_web_service()
            .await
            .map_err(|error| format!("Could not pause Foundry Local before unloading: {error}"))?;
    }

    model
        .unload()
        .await
        .map_err(|error| format!("Could not unload Foundry Local model '{model_id}': {error}"))?;

    let remaining = manager
        .catalog()
        .get_loaded_models()
        .await
        .map_err(|error| format!("Model unloaded, but remaining load state could not be inspected: {error}"))?;

    if service_was_running && !remaining.is_empty() {
        manager
            .start_web_service()
            .await
            .map_err(|error| format!("Model unloaded, but Foundry Local service could not restart: {error}"))?;
    }

    Ok(FoundryActionResult {
        supported: true,
        detail: format!("Unloaded Foundry Local model '{}'.", model.id()),
    })
}

#[tauri::command]
async fn crownkeep_foundry_remove_cached_model(
    app: tauri::AppHandle,
    model_id: String,
) -> Result<FoundryActionResult, String> {
    let _guard = FOUNDRY_LIFECYCLE_LOCK.lock().await;
    let manager = foundry_manager()?;
    let model = resolve_model(&model_id).await?;

    let loaded = manager
        .catalog()
        .get_loaded_models()
        .await
        .map_err(|error| format!("Could not inspect loaded Foundry models: {error}"))?;

    if loaded
        .iter()
        .any(|item| normalized_model_key(item.id()) == normalized_model_key(model.id()))
    {
        return Err(format!(
            "Unload '{}' before deleting it from this device.",
            model.alias()
        ));
    }

    if !model
        .is_cached()
        .await
        .map_err(|error| format!("Could not inspect cache state for '{}': {error}", model.id()))?
    {
        return Ok(FoundryActionResult {
            supported: true,
            detail: format!("Foundry Local model '{}' is not cached.", model.id()),
        });
    }

    emit_operation_progress(
        &app,
        "removing-cache",
        format!("Deleting {} from this device…", model.alias()),
        Some(model.id().to_string()),
        Some(model.alias().to_string()),
        None,
    );

    let requested = model.id().to_string();
    tauri::async_runtime::spawn_blocking(move || run_foundry_cache_remove(&requested))
        .await
        .map_err(|error| format!("Cache cleanup task failed: {error}"))??;

    emit_operation_progress(
        &app,
        "cache-removed",
        format!("{} was deleted from this device.", model.alias()),
        Some(model.id().to_string()),
        Some(model.alias().to_string()),
        Some(100.0),
    );

    Ok(FoundryActionResult {
        supported: true,
        detail: format!("Deleted cached Foundry Local model '{}'.", model.id()),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            crownkeep_host_info,
            device::crownkeep_device_profile,
            speech::crownkeep_transcribe,
            crownkeep_foundry_status,
            crownkeep_foundry_models,
            crownkeep_foundry_analyze_device,
            crownkeep_foundry_start,
            crownkeep_foundry_stop,
            crownkeep_foundry_install_model,
            crownkeep_foundry_activate_model,
            crownkeep_foundry_load_model,
            crownkeep_foundry_unload_model,
            crownkeep_foundry_remove_cached_model
        ])
        .run(tauri::generate_context!())
        .expect("error while running CrownKeep");
}
