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

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageRuntimeStatus { state: &'static str, detail: String, backend: &'static str }
fn status(state: &'static str, detail: &str) -> ImageRuntimeStatus {
    ImageRuntimeStatus { state, detail: detail.into(), backend: "WindowsWebUIImageRuntime" }
}
#[tauri::command]
pub async fn crownkeep_image_status(endpoint: String) -> ImageRuntimeStatus {
    let mut url = match local_endpoint(&endpoint) { Ok(url) => url, Err(error) => return status("wrong-endpoint", &error) };
    url.set_path("/sdapi/v1/options");
    let client = match reqwest::Client::builder().no_proxy().redirect(reqwest::redirect::Policy::none()).timeout(Duration::from_secs(3)).build() {
        Ok(client) => client, Err(_) => return status("stopped", "Local image app could not be reached."),
    };
    let mut response = match client.get(url.clone()).send().await {
        Ok(response) => response,
        Err(_) => return status("stopped", "Start your configured Stable Diffusion WebUI with --api, then retry."),
    };
    if response.status() == reqwest::StatusCode::NOT_FOUND {
        url.set_path("/");
        let webui = match client.get(url).send().await {
            Ok(mut root) if root.status().is_success() => {
                let mut bytes = Vec::new();
                while let Ok(Some(chunk)) = root.chunk().await { if bytes.len() + chunk.len() > 256*1024 { break; } bytes.extend_from_slice(&chunk); }
                let text = String::from_utf8_lossy(&bytes).to_lowercase();
                text.contains("stable diffusion") || text.contains("gradio")
            }, _ => false,
        };
        return if webui { status("api-invalid", "WebUI is reachable but its API is disabled. Restart WebUI with --api.") }
            else { status("wrong-endpoint", "This address is not a Stable Diffusion WebUI API. Check its loopback port.") };
    }
    if !response.status().is_success() { return status("api-invalid", "Local image API rejected the probe. Check API configuration/authentication."); }
    let mut bytes = Vec::new();
    while let Some(chunk) = match response.chunk().await { Ok(chunk) => chunk, Err(_) => return status("api-invalid", "Local API response failed.") } {
        if bytes.len() + chunk.len() > 256*1024 { return status("api-invalid", "Local API response was too large."); }
        bytes.extend_from_slice(&chunk);
    }
    match serde_json::from_slice::<serde_json::Value>(&bytes) {
        Ok(value) if value.get("sd_model_checkpoint").is_some() => status("ready", "Local image app is ready."),
        _ => status("api-invalid", "Address responded, but did not provide a valid WebUI options API."),
    }
}

#[cfg(test)]
mod runtime_tests {
    use super::*;
    fn probe(api: &str, root: Option<&str>) -> ImageRuntimeStatus {
        use std::{io::{Read, Write}, net::TcpListener};
        let server = TcpListener::bind("127.0.0.1:0").unwrap();
        let endpoint = format!("http://{}", server.local_addr().unwrap());
        let responses: Vec<String> = std::iter::once(api).chain(root).map(str::to_owned).collect();
        let worker = std::thread::spawn(move || {
            for response in responses {
                let (mut stream, _) = server.accept().unwrap();
                let mut input = [0u8;4096]; let _ = stream.read(&mut input);
                stream.write_all(response.as_bytes()).unwrap();
            }
        });
        let result = tokio::runtime::Runtime::new().unwrap().block_on(crownkeep_image_status(endpoint));
        worker.join().unwrap(); result
    }
    #[test] fn runtime_status_distinguishes_api_and_endpoint() {
        let ready = "HTTP/1.1 200 OK\r\nContent-Length: 27\r\nConnection: close\r\n\r\n{\"sd_model_checkpoint\":\"x\"}";
        assert_eq!(probe(ready, None).state, "ready");
        assert_eq!(probe("HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}", None).state, "api-invalid");
        let missing="HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
        assert_eq!(probe(missing,Some("HTTP/1.1 200 OK\r\nContent-Length: 6\r\nConnection: close\r\n\r\ngr adio")).state,"wrong-endpoint");
        assert_eq!(probe(missing,Some("HTTP/1.1 200 OK\r\nContent-Length: 6\r\nConnection: close\r\n\r\ngradio")).state,"api-invalid");
    }
    #[test] fn invalid_and_stopped_do_not_probe_remote_services() {
        let runtime = tokio::runtime::Runtime::new().unwrap();
        assert_eq!(runtime.block_on(crownkeep_image_status("http://example.com".into())).state,"wrong-endpoint");
        let listener=std::net::TcpListener::bind("127.0.0.1:0").unwrap();let endpoint=format!("http://{}",listener.local_addr().unwrap());drop(listener);
        assert_eq!(runtime.block_on(crownkeep_image_status(endpoint)).state,"stopped");
    }
}
