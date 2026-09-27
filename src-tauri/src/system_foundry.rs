//! Structured bridge to the installed `foundry` CLI. No CrownKeep model cache.
use serde::Serialize;
use serde_json::Value;
use std::process::Command;

#[derive(Serialize)] #[serde(rename_all = "camelCase")]
pub struct ActionResult { pub supported: bool, pub detail: String }
#[derive(Clone, Serialize)] #[serde(rename_all = "camelCase")]
pub struct ModelSummary { pub id: String, pub alias: String }
#[derive(Serialize)] #[serde(rename_all = "camelCase")]
pub struct RuntimeStatus { pub sdk_ready: bool, pub service_urls: Vec<String>, pub catalog_model_count: usize, pub cached_models: Vec<ModelSummary>, pub loaded_models: Vec<ModelSummary>, pub runtime_version: Option<String>, pub cache_location: Option<String>, pub authority: String, pub legacy_cache_location: String }
#[derive(Clone, Serialize)] #[serde(rename_all = "camelCase")]
pub struct ModelCandidate { pub id: String, pub alias: String, pub display_name: String, pub cached: bool, pub loaded: bool, pub device: Option<String>, pub execution_provider: Option<String>, pub file_size_mb: Option<u64>, pub context_length: Option<u64>, pub model_type: String, pub task: Option<String>, pub supports_tool_calling: Option<bool> }
#[derive(Serialize)] #[serde(rename_all = "camelCase")]
pub struct ExecutionProviderStatus { pub name: String, pub registered: bool, pub registration_attempted: bool, pub registration_succeeded: bool }
#[derive(Serialize)] #[serde(rename_all = "camelCase")]
pub struct DeviceAnalysis { pub devices: Vec<String>, pub execution_providers: Vec<ExecutionProviderStatus>, pub accelerated_variant_count: usize, pub cpu_variant_count: usize, pub detail: String }

fn output(args: &[&str]) -> Result<String, String> {
    let result = Command::new("foundry").args(args).output().map_err(|e| format!("System Foundry is unavailable: {e}"))?;
    let out = String::from_utf8_lossy(&result.stdout).trim().to_string(); let err = String::from_utf8_lossy(&result.stderr).trim().to_string();
    if result.status.success() { Ok(if out.is_empty() { err } else { out }) } else { Err(format!("System Foundry command `foundry {}` failed: {}", args.join(" "), if err.is_empty() { out } else { err })) }
}
async fn run(args: Vec<&'static str>) -> Result<String, String> { tauri::async_runtime::spawn_blocking(move || output(&args)).await.map_err(|e| e.to_string())? }
async fn json(args: Vec<&'static str>) -> Result<Value, String> { serde_json::from_str(&run(args).await?).map_err(|e| format!("System Foundry returned invalid JSON: {e}")) }
fn text(v: &Value, keys: &[&str]) -> Option<String> { keys.iter().find_map(|k| v.get(*k)?.as_str().map(ToString::to_string)) }
fn list(v: &Value) -> Vec<&Value> { v.as_array().map(|a| a.iter().collect()).or_else(|| ["models","items","data","results"].iter().find_map(|k| v.get(*k)?.as_array().map(|a| a.iter().collect()))).unwrap_or_default() }
fn flag(v: &Value, keys: &[&str]) -> Option<bool> { keys.iter().find_map(|k| v.get(*k)?.as_bool()) }
fn num(v: &Value, keys: &[&str]) -> Option<u64> { keys.iter().find_map(|k| v.get(*k)?.as_u64()) }
fn model(v: &Value) -> Option<ModelCandidate> {
    let id = text(v,&["id","modelId","variantId"])?; let alias = text(v,&["alias","modelAlias","family"]).unwrap_or_else(|| id.split(':').next().unwrap_or(&id).to_string()); let r=v.get("runtime").unwrap_or(v);
    Some(ModelCandidate { display_name:text(v,&["displayName","name"]).unwrap_or_else(||alias.clone()), id, alias, cached:flag(v,&["cached","isCached"]).unwrap_or(false), loaded:flag(v,&["loaded","isLoaded"]).unwrap_or(false), device:text(r,&["device","deviceType"]), execution_provider:text(r,&["executionProvider","provider"]), file_size_mb:num(v,&["fileSizeMb","sizeMb"]), context_length:num(v,&["contextLength","contextWindow"]), model_type:text(v,&["modelType","type"]).unwrap_or_else(||"unknown".into()), task:text(v,&["task","capability"]), supports_tool_calling:flag(v,&["supportsToolCalling","toolCalling"]) })
}
fn summaries(v:&Value)->Vec<ModelSummary>{list(v).into_iter().filter_map(model).map(|m|ModelSummary{id:m.id,alias:m.alias}).collect()}
fn urls(v:&Value,out:&mut Vec<String>){match v {Value::String(s) if s.starts_with("http")=>if !out.contains(s){out.push(s.clone())},Value::Array(a)=>for x in a{urls(x,out)},Value::Object(o)=>for(k,x)in o{if ["url","urls","endpoint","endpoints","serviceUrl","serviceUrls","service","server"].contains(&k.as_str()){urls(x,out)}},_=>{}}}
fn legacy()->String{std::env::var("USERPROFILE").map(|h|format!("{h}\\.CrownKeep\\cache\\models")).unwrap_or_else(|_|"~/.CrownKeep/cache/models".into())}
async fn models(args:&[&'static str])->Result<Value,String>{let mut a=args.to_vec();a.extend(["--output","json"]);json(a).await}
async fn cache()->Result<String,String>{match json(vec!["cache","location","--output","json"]).await {Ok(v)=>text(&v,&["location","path","cacheLocation"]).ok_or_else(||"Cache JSON omitted path.".into()),Err(_)=>run(vec!["cache","location"]).await}}
async fn snapshot()->Result<RuntimeStatus,String>{let s=json(vec!["status","--output","json"]).await?;let mut u=Vec::new();urls(&s,&mut u);Ok(RuntimeStatus{sdk_ready:true,service_urls:u,catalog_model_count:0,cached_models:summaries(&models(&["model","list","--cached","--variants"]).await?),loaded_models:summaries(&models(&["model","list","--loaded","--variants"]).await?),runtime_version:text(&s,&["version","cliVersion","foundryVersion"]),cache_location:Some(cache().await?),authority:"Installed System Foundry CLI/service".into(),legacy_cache_location:legacy()})}
#[tauri::command] pub async fn crownkeep_system_foundry_status()->Result<RuntimeStatus,String>{snapshot().await}
#[tauri::command] pub async fn crownkeep_system_foundry_endpoint()->Result<String,String>{snapshot().await?.service_urls.into_iter().next().ok_or_else(||"System Foundry did not report a service URL.".into())}
#[tauri::command] pub async fn crownkeep_system_foundry_models()->Result<Vec<ModelCandidate>,String>{let s=snapshot().await?;let mut all=list(&models(&["model","list","--variants"]).await?).into_iter().filter_map(model).collect::<Vec<_>>();for m in &mut all {m.cached=s.cached_models.iter().any(|x|x.id==m.id||x.alias==m.alias);m.loaded=s.loaded_models.iter().any(|x|x.id==m.id||x.alias==m.alias)}Ok(all)}
#[tauri::command] pub async fn crownkeep_system_foundry_analyze_device()->Result<DeviceAnalysis,String>{let m=crownkeep_system_foundry_models().await?;let mut d=m.iter().filter_map(|x|x.device.clone()).collect::<Vec<_>>();d.sort();d.dedup();Ok(DeviceAnalysis{accelerated_variant_count:m.iter().filter(|x|matches!(x.device.as_deref(),Some("GPU")|Some("NPU"))).count(),cpu_variant_count:m.iter().filter(|x|x.device.as_deref()==Some("CPU")).count(),devices:d,execution_providers:Vec::new(),detail:"System Foundry JSON model metadata inspected; CrownKeep records but does not rank providers.".into()})}
async fn mutation(args:Vec<String>,detail:String)->Result<ActionResult,String>{tauri::async_runtime::spawn_blocking(move||{let refs=args.iter().map(String::as_str).collect::<Vec<_>>();output(&refs)}).await.map_err(|e|e.to_string())??;Ok(ActionResult{supported:true,detail})}
#[tauri::command] pub async fn crownkeep_system_foundry_start()->Result<ActionResult,String>{mutation(vec!["server".into(),"start".into()],"Started System Foundry.".into()).await}
#[tauri::command] pub async fn crownkeep_system_foundry_stop()->Result<ActionResult,String>{mutation(vec!["server".into(),"stop".into()],"Stopped System Foundry.".into()).await}
#[tauri::command] pub async fn crownkeep_system_foundry_install_model(model_id:String)->Result<ActionResult,String>{mutation(vec!["model".into(),"download".into(),model_id.clone()],format!("System Foundry downloaded alias '{model_id}'.")).await}
#[tauri::command] pub async fn crownkeep_system_foundry_activate_model(model_id:String)->Result<ActionResult,String>{mutation(vec!["model".into(),"load".into(),model_id.clone()],format!("System Foundry activated alias '{model_id}'. CrownKeep will confirm /v1 before chat.")).await}
#[tauri::command] pub async fn crownkeep_system_foundry_load_model(model_id:String)->Result<ActionResult,String>{crownkeep_system_foundry_activate_model(model_id).await}
#[tauri::command] pub async fn crownkeep_system_foundry_unload_model(model_id:String)->Result<ActionResult,String>{mutation(vec!["model".into(),"unload".into(),model_id.clone()],format!("System Foundry unloaded '{model_id}'.")).await}
#[tauri::command] pub async fn crownkeep_system_foundry_remove_cached_model(model_id:String)->Result<ActionResult,String>{mutation(vec!["cache".into(),"remove".into(),model_id.clone(),"--force".into()],format!("System Foundry removed '{model_id}'.")).await}
#[cfg(test)] mod tests{use super::*;#[test]fn structured_model_preserves_chat(){let v=serde_json::json!({"id":"phi:4","alias":"phi","modelType":"chat","task":"chat","runtime":{"device":"GPU","executionProvider":"CUDA"},"cached":true,"loaded":true});let m=model(&v).unwrap();assert_eq!(m.model_type,"chat");assert_eq!(m.task.as_deref(),Some("chat"));assert!(m.cached&&m.loaded)}#[test]fn structured_url(){let v=serde_json::json!({"service":{"url":"http://127.0.0.1:12"}});let mut u=Vec::new();urls(&v,&mut u);assert_eq!(u.len(),1)}}
