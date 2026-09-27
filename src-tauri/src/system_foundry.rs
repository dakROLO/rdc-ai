//! Typed bridge to the installed Foundry 0.10.3 CLI. CrownKeep does not own its chat cache.
use serde::{Deserialize, Serialize};
use std::{collections::HashSet, fs, path::Path, process::Command};

#[derive(Deserialize)] #[serde(rename_all = "camelCase")]
struct FoundryStatus { system: FoundrySystem, service: FoundryService, models: FoundryCounts, connectivity: FoundryConnectivity, #[allow(dead_code)] warnings: Vec<String> }
#[derive(Deserialize)] #[serde(rename_all = "camelCase")]
struct FoundrySystem { operating_system: String, architecture: String, cpu: String, total_memory_bytes: u64, #[allow(dead_code)] available_memory_bytes: u64, gpus: Vec<FoundryProcessor>, npus: Vec<FoundryProcessor> }
#[derive(Deserialize)] #[serde(rename_all = "camelCase")]
struct FoundryProcessor { name: String, vendor: String, video_memory_bytes: Option<u64> }
#[derive(Deserialize)] #[serde(rename_all = "camelCase")]
struct FoundryService { state: String, ready: bool, web_urls: Vec<String>, cli_version: String, foundry_local_core_version: String, ort_version: String, ort_gen_ai_version: String }
#[derive(Deserialize)] #[serde(rename_all = "camelCase")]
struct FoundryCounts { available: usize, loaded: usize, cached: usize }
#[derive(Deserialize)] #[serde(rename_all = "camelCase")]
struct FoundryConnectivity { local_service_reachable: bool, model_registry_reachable: bool }
#[derive(Deserialize)] #[serde(rename_all = "camelCase")]
struct FoundryServerStatus { running: bool, state: String, web_urls: Vec<String> }
#[derive(Deserialize)] struct FoundryModelList { variants: Vec<FoundryVariant> }
#[derive(Clone, Deserialize)] #[serde(rename_all = "camelCase")]
struct FoundryVariant { alias: String, variant_name: String, variant_id: String, #[serde(rename = "type")] model_type: String, device: String, execution_provider: String, file_size_mb: Option<u64>, cached: bool, #[allow(dead_code)] license: Option<String> }

#[derive(Serialize)] #[serde(rename_all = "camelCase")] pub struct ActionResult { pub supported: bool, pub detail: String }
#[derive(Clone, Serialize)] #[serde(rename_all = "camelCase")] pub struct ModelSummary { pub id: String, pub alias: String }
#[derive(Serialize)] #[serde(rename_all = "camelCase")] pub struct LegacyCacheInventory { pub path: String, pub exists: bool, pub approximate_size_bytes: u64, pub entries: Vec<String>, pub entry_count: usize, pub status: String, pub cleanup: String }
#[derive(Serialize)] #[serde(rename_all = "camelCase")] pub struct RuntimeStatus { pub sdk_ready: bool, pub service_urls: Vec<String>, pub catalog_model_count: usize, pub cached_model_count: usize, pub loaded_model_count: usize, pub cached_models: Vec<ModelSummary>, pub loaded_models: Vec<ModelSummary>, pub runtime_version: Option<String>, pub cache_location: Option<String>, pub authority: String, pub legacy_cache_location: String, pub legacy_cache: LegacyCacheInventory, pub service_ready: bool, pub service_state: String, pub foundry_local_core_version: String, pub ort_version: String, pub ort_gen_ai_version: String, pub local_service_reachable: bool, pub model_registry_reachable: bool }
#[derive(Clone, Serialize)] #[serde(rename_all = "camelCase")] pub struct ModelCandidate { pub id: String, pub alias: String, pub display_name: String, pub cached: bool, pub loaded: bool, pub device: Option<String>, pub execution_provider: Option<String>, pub file_size_mb: Option<u64>, pub context_length: Option<u64>, pub model_type: String, pub task: Option<String>, pub supports_tool_calling: Option<bool> }
#[derive(Serialize)] #[serde(rename_all = "camelCase")] pub struct ExecutionProviderStatus { pub name: String, pub registered: bool, pub registration_attempted: bool, pub registration_succeeded: bool }
#[derive(Serialize)] #[serde(rename_all = "camelCase")] pub struct DeviceAnalysis { pub devices: Vec<String>, pub execution_providers: Vec<ExecutionProviderStatus>, pub accelerated_variant_count: usize, pub cpu_variant_count: usize, pub detail: String }

fn output(args: &[&str]) -> Result<String, String> { let result = Command::new("foundry").args(args).output().map_err(|e| format!("System Foundry is unavailable: {e}"))?; let out = String::from_utf8_lossy(&result.stdout).trim().to_string(); let err = String::from_utf8_lossy(&result.stderr).trim().to_string(); if result.status.success() { Ok(if out.is_empty() { err } else { out }) } else { Err(format!("System Foundry command `foundry {}` failed: {}", args.join(" "), if err.is_empty() { out } else { err })) } }
async fn run(args: Vec<&'static str>) -> Result<String, String> { tauri::async_runtime::spawn_blocking(move || output(&args)).await.map_err(|e| e.to_string())? }
async fn json<T: for<'a> Deserialize<'a>>(args: Vec<&'static str>) -> Result<T, String> { serde_json::from_str(&run(args).await?).map_err(|e| format!("System Foundry returned invalid JSON: {e}")) }
async fn status() -> Result<FoundryStatus, String> { json(vec!["status", "--output", "json"]).await }
async fn server_status() -> Result<FoundryServerStatus, String> { json(vec!["server", "status", "--output", "json"]).await }
async fn variants(args: Vec<&'static str>) -> Result<Vec<FoundryVariant>, String> { Ok(json::<FoundryModelList>(args).await?.variants) }
fn normalized_device(value: &str) -> Option<String> { match value.to_ascii_lowercase().as_str() { "gpu" => Some("GPU".into()), "cpu" => Some("CPU".into()), "npu" => Some("NPU".into()), _ => None } }
fn candidate(v: FoundryVariant, loaded: bool) -> ModelCandidate { ModelCandidate { id: v.variant_id, alias: v.alias, display_name: v.variant_name, cached: v.cached, loaded, device: normalized_device(&v.device), execution_provider: Some(v.execution_provider), file_size_mb: v.file_size_mb, context_length: None, model_type: v.model_type, task: None, supports_tool_calling: None } }
fn legacy_path() -> String { std::env::var("USERPROFILE").map(|p| format!("{p}\\.CrownKeep\\cache\\models")).unwrap_or_else(|_| "~/.CrownKeep/cache/models".into()) }
fn directory_size(path: &Path) -> u64 { fs::read_dir(path).ok().into_iter().flatten().filter_map(Result::ok).map(|e| { let p=e.path(); e.metadata().ok().map(|m| if m.is_dir(){directory_size(&p)}else{m.len()}).unwrap_or(0) }).sum() }
fn legacy_status() -> LegacyCacheInventory { let path=legacy_path(); LegacyCacheInventory { exists:Path::new(&path).exists(), path, approximate_size_bytes:0, entries:Vec::new(), entry_count:0, status:"Not used by current Windows chat runtime".into(), cleanup:"Pending physical acceptance".into() } }
fn legacy_inventory() -> LegacyCacheInventory { let mut inventory=legacy_status(); let root=Path::new(&inventory.path); if inventory.exists { inventory.entries=fs::read_dir(root).ok().into_iter().flatten().filter_map(Result::ok).filter(|e| e.file_type().map(|t|t.is_dir()).unwrap_or(false)).filter_map(|e|e.file_name().into_string().ok()).collect(); inventory.entry_count=inventory.entries.len(); inventory.approximate_size_bytes=directory_size(root); } inventory }
fn cache_path(value: &serde_json::Value) -> Option<String> { value.as_str().map(str::to_owned).or_else(||value.get("path").or_else(||value.get("location")).or_else(||value.get("cacheLocation")).and_then(|v|v.as_str()).map(str::to_owned)) }
async fn cache_location() -> Result<String, String> { match json::<serde_json::Value>(vec!["cache", "location", "--output", "json"]).await.ok().and_then(|value|cache_path(&value)) { Some(path)=>Ok(path), None=>run(vec!["cache", "location"]).await } }
fn valid_url(url: &str) -> bool { url.starts_with("http://") || url.starts_with("https://") }

#[tauri::command] pub async fn crownkeep_system_foundry_status() -> Result<RuntimeStatus, String> { let s=status().await?; let cache_location=cache_location().await.ok(); let legacy_cache=legacy_status(); Ok(RuntimeStatus { sdk_ready:s.service.ready, service_urls:s.service.web_urls.iter().filter(|url|valid_url(url)).cloned().collect(), catalog_model_count:s.models.available, cached_model_count:s.models.cached, loaded_model_count:s.models.loaded, cached_models:Vec::new(), loaded_models:Vec::new(), runtime_version:Some(s.service.cli_version), cache_location, authority:"Installed System Foundry CLI/service".into(), legacy_cache_location:legacy_cache.path.clone(), legacy_cache, service_ready:s.service.ready, service_state:s.service.state, foundry_local_core_version:s.service.foundry_local_core_version, ort_version:s.service.ort_version, ort_gen_ai_version:s.service.ort_gen_ai_version, local_service_reachable:s.connectivity.local_service_reachable, model_registry_reachable:s.connectivity.model_registry_reachable }) }
#[tauri::command] pub async fn crownkeep_system_foundry_legacy_inventory() -> Result<LegacyCacheInventory,String> { tauri::async_runtime::spawn_blocking(legacy_inventory).await.map_err(|e|e.to_string()) }
#[tauri::command] pub async fn crownkeep_system_foundry_endpoint() -> Result<String, String> { let s=server_status().await?; if !s.running || !s.state.eq_ignore_ascii_case("ready") { return Err(format!("System Foundry server is not ready (running={}, state={}).",s.running,s.state)); } s.web_urls.into_iter().find(|url|valid_url(url)).ok_or_else(||"System Foundry server status did not report a valid webUrls endpoint.".into()) }
#[tauri::command] pub async fn crownkeep_system_foundry_models() -> Result<Vec<ModelCandidate>, String> { let all=variants(vec!["model","list","--variants","--output","json"]).await?; let loaded=variants(vec!["model","list","--loaded","--variants","--output","json"]).await?; let loaded_ids=loaded.into_iter().map(|v|v.variant_id).collect::<HashSet<_>>(); Ok(all.into_iter().map(|v|{let is_loaded=loaded_ids.contains(&v.variant_id);candidate(v,is_loaded)}).collect()) }
#[tauri::command] pub async fn crownkeep_system_foundry_analyze_device() -> Result<DeviceAnalysis, String> { let m=crownkeep_system_foundry_models().await?; let mut devices=m.iter().filter_map(|x|x.device.clone()).collect::<Vec<_>>(); devices.sort(); devices.dedup(); Ok(DeviceAnalysis{accelerated_variant_count:m.iter().filter(|x|matches!(x.device.as_deref(),Some("Gpu")|Some("Npu")|Some("GPU")|Some("NPU"))).count(),cpu_variant_count:m.iter().filter(|x|x.device.as_deref().map(|d|d.eq_ignore_ascii_case("cpu")).unwrap_or(false)).count(),devices,execution_providers:Vec::new(),detail:"System Foundry status is the Windows hardware source; model metadata is inspected without provider ranking.".into()}) }
pub async fn foundry_device_profile() -> Result<(String, Option<u64>, String),String> { let s=status().await?; let mut durable=vec![s.system.operating_system.clone(),s.system.architecture.clone(),s.system.cpu.clone(),s.system.total_memory_bytes.to_string(),s.service.cli_version.clone(),s.service.foundry_local_core_version.clone(),s.service.ort_version.clone()]; durable.extend(s.system.gpus.iter().map(|g|format!("{}:{}:{}",g.name,g.vendor,g.video_memory_bytes.unwrap_or(0)))); durable.extend(s.system.npus.iter().map(|n|format!("{}:{}",n.name,n.vendor))); durable.sort(); Ok((durable.join("|"),Some(s.system.total_memory_bytes/1024/1024),format!("{} MB system RAM · {} · {}. System Foundry hardware report; benchmark results decide.",s.system.total_memory_bytes/1024/1024,s.system.cpu, s.system.gpus.iter().map(|g|g.name.as_str()).collect::<Vec<_>>().join(", ")))) }
async fn mutation(args:Vec<String>,detail:String)->Result<ActionResult,String>{tauri::async_runtime::spawn_blocking(move||{let refs=args.iter().map(String::as_str).collect::<Vec<_>>();output(&refs)}).await.map_err(|e|e.to_string())??;Ok(ActionResult{supported:true,detail})}
#[tauri::command] pub async fn crownkeep_system_foundry_start()->Result<ActionResult,String>{mutation(vec!["server".into(),"start".into()],"Started System Foundry.".into()).await}
#[tauri::command] pub async fn crownkeep_system_foundry_stop()->Result<ActionResult,String>{mutation(vec!["server".into(),"stop".into()],"Stopped System Foundry.".into()).await}
#[tauri::command] pub async fn crownkeep_system_foundry_install_model(model_id:String)->Result<ActionResult,String>{mutation(vec!["model".into(),"download".into(),model_id.clone()],format!("System Foundry downloaded alias '{model_id}'.")).await}
async fn unload_other_loaded_models(target:&str)->Result<(),String>{
    let loaded=variants(vec!["model","list","--loaded","--variants","--output","json"]).await.unwrap_or_default();
    let mut aliases=loaded.into_iter().filter_map(|v|{
        if v.alias.eq_ignore_ascii_case(target) || v.variant_id.eq_ignore_ascii_case(target) || v.variant_name.eq_ignore_ascii_case(target) { None } else { Some(v.alias) }
    }).collect::<Vec<_>>();
    aliases.sort();
    aliases.dedup();
    for alias in aliases {
        mutation(vec!["model".into(),"unload".into(),alias.clone()],format!("System Foundry unloaded '{alias}' before switching models.")).await?;
    }
    Ok(())
}
#[tauri::command] pub async fn crownkeep_system_foundry_activate_model(model_id:String)->Result<ActionResult,String>{
    unload_other_loaded_models(&model_id).await?;
    mutation(vec!["model".into(),"load".into(),model_id.clone()],format!("System Foundry activated alias '{model_id}'. CrownKeep will confirm /v1 before chat.")).await
}
#[tauri::command] pub async fn crownkeep_system_foundry_load_model(model_id:String)->Result<ActionResult,String>{crownkeep_system_foundry_activate_model(model_id).await}
#[tauri::command] pub async fn crownkeep_system_foundry_unload_model(model_id:String)->Result<ActionResult,String>{mutation(vec!["model".into(),"unload".into(),model_id.clone()],format!("System Foundry unloaded '{model_id}'.")).await}
#[tauri::command] pub async fn crownkeep_system_foundry_remove_cached_model(model_id:String)->Result<ActionResult,String>{mutation(vec!["cache".into(),"remove".into(),model_id.clone(),"--force".into()],format!("System Foundry removed '{model_id}'.")).await}

#[cfg(test)] mod tests { use super::*; #[test] fn parses_actual_status_shape(){let s:FoundryStatus=serde_json::from_value(serde_json::json!({"system":{"operatingSystem":"Windows","architecture":"X64","cpu":"CPU","totalMemoryBytes":337,"availableMemoryBytes":12,"gpus":[{"name":"RTX","vendor":"NVIDIA","videoMemoryBytes":8}],"npus":[{"name":"AI Boost","vendor":"Intel"}]},"service":{"state":"ready","ready":true,"webUrls":["http://127.0.0.1:59757"],"cliVersion":"0.10.3","foundryLocalCoreVersion":"1","ortVersion":"1.26","ortGenAiVersion":"0"},"models":{"available":166,"loaded":0,"cached":1},"connectivity":{"localServiceReachable":true,"modelRegistryReachable":true},"warnings":[]})).unwrap();assert!(s.service.ready);assert_eq!(s.service.web_urls[0],"http://127.0.0.1:59757");assert_eq!(s.system.gpus[0].name,"RTX");}
#[test] fn parses_variants_and_types(){let list:FoundryModelList=serde_json::from_value(serde_json::json!({"variants":[{"alias":"qwen3-4b","variantName":"qwen3-4b-cuda-gpu","variantId":"qwen3-4b-cuda-gpu:2","type":"Chat","device":"Gpu","executionProvider":"CUDAExecutionProvider","fileSizeMb":2692,"cached":true,"license":"apache-2.0"},{"alias":"speech","variantName":"speech-cpu","variantId":"speech-cpu:1","type":"Speech","device":"Cpu","executionProvider":"CPUExecutionProvider","fileSizeMb":1,"cached":false,"license":null}]})).unwrap();assert_eq!(list.variants.len(),2);let chat=candidate(list.variants[0].clone(),false);assert_eq!(chat.model_type,"Chat");assert!(chat.cached);assert_eq!(list.variants[1].model_type,"Speech");} }
