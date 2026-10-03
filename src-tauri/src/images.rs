//! Explicit user-initiated local Stable Diffusion adapter. No remote endpoints.
use std::time::Duration;

fn local_endpoint(value: &str) -> Result<reqwest::Url, String> {
    let mut url = reqwest::Url::parse(value).map_err(|_| "Invalid local image app URL".to_string())?;
    if url.scheme() != "http" || !matches!(url.host_str(), Some("127.0.0.1" | "localhost" | "[::1]"))
        || !url.username().is_empty() || url.password().is_some() || url.query().is_some()
        || url.fragment().is_some() || !matches!(url.path(), "" | "/") {
        return Err("Image generation accepts an HTTP loopback address only.".into());
    }
    // Pin localhost to a literal loopback host rather than allowing DNS resolution.
    if url.host_str() == Some("localhost") { url.set_host(Some("127.0.0.1")).map_err(|_| "Invalid loopback host".to_string())?; }
    url.set_path("/sdapi/v1/txt2img");
    Ok(url)
}

#[tauri::command]
pub async fn crownkeep_generate_image(endpoint: String, prompt: String) -> Result<String, String> {
    let url = local_endpoint(&endpoint)?;
    if prompt.trim().is_empty() || prompt.chars().count() > 2000 { return Err("Use a prompt between 1 and 2,000 characters.".into()); }
    let client = reqwest::Client::builder().no_proxy().redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(180)).build().map_err(|error| error.to_string())?;
    let body = serde_json::json!({ "prompt": prompt, "steps": 20, "width": 512, "height": 512, "batch_size": 1, "n_iter": 1 });
    let mut response = client.post(url).header("Content-Type", "application/json").body(body.to_string()).send().await
        .map_err(|_| "Could not reach the local image app. Start Stable Diffusion WebUI with --api.".to_string())?;
    if !response.status().is_success() { return Err(format!("Local image app returned HTTP {}.", response.status())); }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|error| error.to_string())? {
        if bytes.len() + chunk.len() > 24 * 1024 * 1024 { return Err("Image response exceeded the 24 MB limit.".into()); }
        bytes.extend_from_slice(&chunk);
    }
    let value: serde_json::Value = serde_json::from_slice(&bytes).map_err(|_| "Local image app returned invalid JSON.".to_string())?;
    let image = value.get("images").and_then(|images| images.get(0)).and_then(|item| item.as_str()).ok_or("Local image app returned no image.")?;
    if image.starts_with("data:") { return Err("Unexpected image format from the local image app.".into()); }
    Ok(format!("data:image/png;base64,{image}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn only_loopback_image_services_are_allowed() {
        assert!(local_endpoint("http://127.0.0.1:7860").is_ok());
        assert!(local_endpoint("http://localhost:7860").is_ok());
        for url in ["https://127.0.0.1", "http://example.com", "http://127.0.0.1@evil.com", "http://127.0.0.1/api", "http://127.0.0.1?token=secret"] { assert!(local_endpoint(url).is_err()); }
    }
}
