//! CrownKeep local Windows image adapter.
//! Supports loopback AUTOMATIC1111/Forge WebUI and the user's existing
//! Stability Matrix / ComfyUI install. No remote image endpoint is accepted.
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use reqwest::{Client, Url};
use serde_json::{json, Value};
use std::{collections::HashSet, time::{Duration, SystemTime, UNIX_EPOCH}};

#[derive(Clone, Debug)]
enum RuntimeKind {
    WebUi,
    ComfyUi,
}

#[derive(Clone, Debug)]
struct DetectedRuntime {
    kind: RuntimeKind,
    base: Url,
}

fn loopback_base(value: &str) -> Result<Url, String> {
    let mut url = Url::parse(value).map_err(|_| "Invalid local image app URL".to_string())?;
    if url.scheme() != "http"
        || !matches!(url.host_str(), Some("127.0.0.1" | "localhost" | "[::1]"))
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || !matches!(url.path(), "" | "/")
    {
        return Err("Image generation accepts an HTTP loopback address only.".into());
    }
    if url.host_str() == Some("localhost") {
        url.set_host(Some("127.0.0.1"))
            .map_err(|_| "Invalid loopback host".to_string())?;
    }
    url.set_path("/");
    Ok(url)
}

fn endpoint(base: &Url, path: &str) -> Url {
    let mut url = base.clone();
    url.set_path(path);
    url.set_query(None);
    url
}

fn candidate_endpoints(configured: &str) -> Result<Vec<Url>, String> {
    let configured = loopback_base(configured)?;
    let mut seen = HashSet::new();
    let mut values = Vec::new();
    for raw in [
        Some(configured),
        Url::parse("http://127.0.0.1:8188/").ok(),
        Url::parse("http://127.0.0.1:7860/").ok(),
    ]
    .into_iter()
    .flatten()
    {
        let key = raw.as_str().to_string();
        if seen.insert(key) {
            values.push(raw);
        }
    }
    Ok(values)
}

async fn response_json_limited(mut response: reqwest::Response, max: usize) -> Result<Value, String> {
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|error| error.to_string())? {
        if bytes.len() + chunk.len() > max {
            return Err("Local image API response exceeded the safety limit.".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    serde_json::from_slice(&bytes).map_err(|_| "Local image app returned invalid JSON.".to_string())
}

async fn probe_one(client: &Client, base: &Url) -> Option<DetectedRuntime> {
    // AUTOMATIC1111 / Forge API.
    if let Ok(response) = client.get(endpoint(base, "/sdapi/v1/options")).send().await {
        if response.status().is_success() {
            if let Ok(value) = response_json_limited(response, 256 * 1024).await {
                if value.get("sd_model_checkpoint").is_some() {
                    return Some(DetectedRuntime { kind: RuntimeKind::WebUi, base: base.clone() });
                }
            }
        }
    }

    // ComfyUI native API.
    if let Ok(response) = client.get(endpoint(base, "/system_stats")).send().await {
        if response.status().is_success() {
            if let Ok(value) = response_json_limited(response, 512 * 1024).await {
                if value.get("system").is_some() || value.get("devices").is_some() {
                    return Some(DetectedRuntime { kind: RuntimeKind::ComfyUi, base: base.clone() });
                }
            }
        }
    }
    None
}

async fn detect_runtime(client: &Client, configured: &str) -> Result<Option<DetectedRuntime>, String> {
    for base in candidate_endpoints(configured)? {
        if let Some(runtime) = probe_one(client, &base).await {
            return Ok(Some(runtime));
        }
    }
    Ok(None)
}

async fn generate_webui(client: &Client, base: &Url, prompt: &str) -> Result<String, String> {
    let body = json!({
        "prompt": prompt,
        "steps": 20,
        "width": 512,
        "height": 512,
        "batch_size": 1,
        "n_iter": 1
    });
    let response = client
        .post(endpoint(base, "/sdapi/v1/txt2img"))
        .header("Content-Type", "application/json")
        .body(body.to_string())
        .send()
        .await
        .map_err(|error| format!("Local WebUI request failed: {error}"))?;
    if !response.status().is_success() {
        return Err(format!("Local WebUI returned HTTP {}.", response.status()));
    }
    let value = response_json_limited(response, 24 * 1024 * 1024).await?;
    let image = value
        .get("images")
        .and_then(|images| images.get(0))
        .and_then(Value::as_str)
        .ok_or("Local WebUI returned no image.")?;
    if image.starts_with("data:") {
        return Err("Unexpected image format from the local image app.".into());
    }
    Ok(format!("data:image/png;base64,{image}"))
}

async fn comfy_checkpoint(client: &Client, base: &Url) -> Result<String, String> {
    let response = client
        .get(endpoint(base, "/object_info/CheckpointLoaderSimple"))
        .send()
        .await
        .map_err(|error| format!("Could not inspect ComfyUI checkpoints: {error}"))?;
    if !response.status().is_success() {
        return Err(format!("ComfyUI checkpoint discovery returned HTTP {}.", response.status()));
    }
    let value = response_json_limited(response, 2 * 1024 * 1024).await?;
    let choices = value
        .pointer("/CheckpointLoaderSimple/input/required/ckpt_name/0")
        .and_then(Value::as_array)
        .ok_or("ComfyUI did not report an installed checkpoint.")?;

    let names: Vec<&str> = choices.iter().filter_map(Value::as_str).collect();
    names
        .iter()
        .find(|name| name.to_ascii_lowercase().contains("sd_xl_base_1.0"))
        .or_else(|| names.first())
        .map(|name| (*name).to_string())
        .ok_or_else(|| "ComfyUI has no checkpoint available for CrownKeep.".to_string())
}

async fn generate_comfyui(client: &Client, base: &Url, prompt: &str) -> Result<String, String> {
    let checkpoint = comfy_checkpoint(client, base).await?;
    let seed = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos() as u64;

    let graph = json!({
        "4": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": { "ckpt_name": checkpoint }
        },
        "6": {
            "class_type": "CLIPTextEncode",
            "inputs": { "text": prompt, "clip": ["4", 1] }
        },
        "7": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": "blurry, low quality, distorted, watermark, unreadable text",
                "clip": ["4", 1]
            }
        },
        "5": {
            "class_type": "EmptyLatentImage",
            "inputs": { "width": 768, "height": 768, "batch_size": 1 }
        },
        "3": {
            "class_type": "KSampler",
            "inputs": {
                "seed": seed,
                "steps": 20,
                "cfg": 7.0,
                "sampler_name": "euler",
                "scheduler": "normal",
                "denoise": 1.0,
                "model": ["4", 0],
                "positive": ["6", 0],
                "negative": ["7", 0],
                "latent_image": ["5", 0]
            }
        },
        "8": {
            "class_type": "VAEDecode",
            "inputs": { "samples": ["3", 0], "vae": ["4", 2] }
        },
        "9": {
            "class_type": "SaveImage",
            "inputs": { "filename_prefix": "CrownKeep", "images": ["8", 0] }
        }
    });

    let response = client
        .post(endpoint(base, "/prompt"))
        .header("Content-Type", "application/json")
        .body(json!({ "prompt": graph, "client_id": "crownkeep" }).to_string())
        .send()
        .await
        .map_err(|error| format!("Could not submit ComfyUI workflow: {error}"))?;
    if !response.status().is_success() {
        let status = response.status();
        let detail = response.text().await.unwrap_or_default();
        return Err(format!("ComfyUI rejected the CrownKeep workflow (HTTP {status}): {}", detail.chars().take(500).collect::<String>()));
    }
    let submitted = response_json_limited(response, 512 * 1024).await?;
    let prompt_id = submitted
        .get("prompt_id")
        .and_then(Value::as_str)
        .ok_or("ComfyUI did not return a prompt ID.")?
        .to_string();

    for _ in 0..360 {
        tokio::time::sleep(Duration::from_millis(500)).await;
        let history_url = endpoint(base, &format!("/history/{prompt_id}"));
        let response = client.get(history_url).send().await.map_err(|error| error.to_string())?;
        if !response.status().is_success() {
            continue;
        }
        let history = response_json_limited(response, 2 * 1024 * 1024).await?;
        let entry = history.get(&prompt_id);
        let image = entry
            .and_then(|value| value.pointer("/outputs/9/images/0"))
            .or_else(|| {
                entry
                    .and_then(|value| value.get("outputs"))
                    .and_then(Value::as_object)
                    .and_then(|outputs| {
                        outputs.values().find_map(|node| node.get("images")?.get(0))
                    })
            });

        if let Some(image) = image {
            let filename = image.get("filename").and_then(Value::as_str).ok_or("ComfyUI image record had no filename.")?;
            let subfolder = image.get("subfolder").and_then(Value::as_str).unwrap_or("");
            let kind = image.get("type").and_then(Value::as_str).unwrap_or("output");
            let mut view = endpoint(base, "/view");
            view.query_pairs_mut()
                .append_pair("filename", filename)
                .append_pair("subfolder", subfolder)
                .append_pair("type", kind);
            let response = client.get(view).send().await.map_err(|error| error.to_string())?;
            if !response.status().is_success() {
                return Err(format!("ComfyUI image retrieval returned HTTP {}.", response.status()));
            }
            let bytes = response.bytes().await.map_err(|error| error.to_string())?;
            if bytes.len() > 24 * 1024 * 1024 {
                return Err("Generated image exceeded the 24 MB limit.".into());
            }
            return Ok(format!("data:image/png;base64,{}", BASE64.encode(bytes)));
        }

        if let Some(status) = entry.and_then(|value| value.get("status")) {
            if status.get("completed").and_then(Value::as_bool) == Some(true) {
                return Err("ComfyUI completed the workflow but returned no image.".into());
            }
        }
    }

    Err("ComfyUI generation timed out after 180 seconds.".into())
}

#[tauri::command]
pub async fn crownkeep_generate_image(endpoint: String, prompt: String) -> Result<String, String> {
    if prompt.trim().is_empty() || prompt.chars().count() > 2000 {
        return Err("Use a prompt between 1 and 2,000 characters.".into());
    }
    let client = Client::builder()
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(180))
        .build()
        .map_err(|error| error.to_string())?;

    let runtime = detect_runtime(&client, &endpoint)
        .await?
        .ok_or(
            "No local image runtime is running. CrownKeep can use ComfyUI from Stability Matrix on 127.0.0.1:8188 or Stable Diffusion WebUI with --api on 127.0.0.1:7860."
        )?;

    match runtime.kind {
        RuntimeKind::WebUi => generate_webui(&client, &runtime.base, prompt.trim()).await,
        RuntimeKind::ComfyUi => generate_comfyui(&client, &runtime.base, prompt.trim()).await,
    }
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageRuntimeStatus {
    state: &'static str,
    detail: String,
    backend: String,
}

fn status(state: &'static str, detail: impl Into<String>, backend: impl Into<String>) -> ImageRuntimeStatus {
    ImageRuntimeStatus { state, detail: detail.into(), backend: backend.into() }
}

#[tauri::command]
pub async fn crownkeep_image_status(endpoint: String) -> ImageRuntimeStatus {
    if let Err(error) = loopback_base(&endpoint) {
        return status("wrong-endpoint", error, "WindowsLocalImageRuntime");
    }
    let client = match Client::builder()
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(3))
        .build()
    {
        Ok(client) => client,
        Err(_) => return status("stopped", "Local image app could not be reached.", "WindowsLocalImageRuntime"),
    };

    match detect_runtime(&client, &endpoint).await {
        Ok(Some(runtime)) => match runtime.kind {
            RuntimeKind::ComfyUi => status(
                "ready",
                format!("ComfyUI is ready at {}. CrownKeep will use the installed local checkpoint.", runtime.base),
                "WindowsComfyUIImageRuntime",
            ),
            RuntimeKind::WebUi => status(
                "ready",
                format!("Stable Diffusion WebUI API is ready at {}.", runtime.base),
                "WindowsWebUIImageRuntime",
            ),
        },
        Ok(None) => status(
            "stopped",
            r"Start ComfyUI in Stability Matrix (C:\AI\StabilityMatrix); CrownKeep auto-detects 127.0.0.1:8188. WebUI --api on 127.0.0.1:7860 is also supported.",
            "WindowsLocalImageRuntime",
        ),
        Err(error) => status("wrong-endpoint", error, "WindowsLocalImageRuntime"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_loopback_image_services_are_allowed() {
        assert!(loopback_base("http://127.0.0.1:7860").is_ok());
        assert!(loopback_base("http://127.0.0.1:8188").is_ok());
        assert!(loopback_base("http://localhost:8188").is_ok());
        for url in [
            "https://127.0.0.1",
            "http://example.com",
            "http://127.0.0.1@evil.com",
            "http://127.0.0.1/api",
            "http://127.0.0.1?token=secret",
        ] {
            assert!(loopback_base(url).is_err());
        }
    }

    #[test]
    fn candidate_list_includes_comfyui_and_webui() {
        let urls = candidate_endpoints("http://127.0.0.1:7860").unwrap();
        let values: Vec<_> = urls.iter().map(Url::as_str).collect();
        assert!(values.iter().any(|value| value.contains(":8188")));
        assert!(values.iter().any(|value| value.contains(":7860")));
    }
}
