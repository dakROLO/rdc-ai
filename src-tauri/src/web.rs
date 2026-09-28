use keyring::Entry;
use serde::Serialize;
use serde_json::json;
use std::net::IpAddr;
use std::time::Duration;

const WEB_PROVIDER: &str = "tavily";
const TAVILY_SEARCH_URL: &str = "https://api.tavily.com/search";
const CREDENTIAL_SERVICE: &str = "com.royaldigitalclarity.crownkeep.web";
const CREDENTIAL_ACCOUNT: &str = "tavily-api-key";
const MAX_READ_BYTES: usize = 2 * 1024 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeWebStatus {
    native_available: bool,
    provider: &'static str,
    search_configured: bool,
    read_available: bool,
    credential_store: &'static str,
    detail: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebSearchResult {
    title: String,
    url: String,
    snippet: String,
    score: Option<f64>,
    published_at: Option<String>,
}

#[derive(Serialize)]
pub struct WebSearchResponse {
    results: Vec<WebSearchResult>,
}

#[derive(Serialize)]
pub struct WebReadResponse {
    url: String,
    title: Option<String>,
    content: String,
}

fn credential_entry() -> Result<Entry, String> {
    Entry::new(CREDENTIAL_SERVICE, CREDENTIAL_ACCOUNT)
        .map_err(|error| format!("Could not open Windows Credential Manager: {error}"))
}

fn load_search_credential() -> Result<Option<String>, String> {
    let entry = credential_entry()?;
    match entry.get_password() {
        Ok(value) if !value.trim().is_empty() => Ok(Some(value)),
        Ok(_) => Ok(None),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(format!(
            "Could not read the CrownKeep web-search credential: {error}"
        )),
    }
}

fn status_payload() -> Result<NativeWebStatus, String> {
    let search_configured = load_search_credential()?.is_some();
    Ok(NativeWebStatus {
        native_available: true,
        provider: WEB_PROVIDER,
        search_configured,
        read_available: true,
        credential_store: "Windows Credential Manager",
        detail: if search_configured {
            "Direct Web Access is ready. Search credentials stay in Windows Credential Manager; webpage reads are fetched directly from this device.".into()
        } else {
            "Direct webpage reading is ready. Add a Tavily API key to enable public-web search; the key will stay in Windows Credential Manager.".into()
        },
    })
}

fn web_client(timeout_seconds: u64) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(timeout_seconds))
        .user_agent("CrownKeep-Native-Web/0.1")
        .build()
        .map_err(|error| format!("Could not initialize CrownKeep Web Access: {error}"))
}

fn normalized_query(value: &str) -> String {
    value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(512)
        .collect()
}

fn safe_public_url(value: &str) -> Result<reqwest::Url, String> {
    let url = reqwest::Url::parse(value)
        .map_err(|_| "Web Read requires a valid public http(s) URL.".to_string())?;

    if !matches!(url.scheme(), "http" | "https") {
        return Err("Web Read only supports public http(s) URLs.".into());
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err("Web Read does not accept URLs containing credentials.".into());
    }

    let host = url
        .host_str()
        .ok_or_else(|| "Web Read requires a public hostname.".to_string())?
        .to_ascii_lowercase();

    if host == "localhost" || host.ends_with(".local") {
        return Err("Local/private URLs are not supported by Web Read.".into());
    }

    if let Ok(ip) = host.parse::<IpAddr>() {
        let blocked = match ip {
            IpAddr::V4(value) => {
                value.is_private()
                    || value.is_loopback()
                    || value.is_link_local()
                    || value.is_broadcast()
                    || value.is_documentation()
                    || value.is_multicast()
                    || value.is_unspecified()
            }
            IpAddr::V6(value) => {
                value.is_loopback()
                    || value.is_unique_local()
                    || value.is_unicast_link_local()
                    || value.is_multicast()
                    || value.is_unspecified()
            }
        };
        if blocked {
            return Err("Local/private URLs are not supported by Web Read.".into());
        }
    }

    Ok(url)
}

fn html_title(body: &str) -> Option<String> {
    let lower = body.to_ascii_lowercase();
    let start = lower.find("<title")?;
    let open_end = lower[start..].find('>')? + start + 1;
    let close = lower[open_end..].find("</title>")? + open_end;
    let raw = body[open_end..close].trim();
    if raw.is_empty() {
        None
    } else {
        Some(raw.chars().take(240).collect())
    }
}

#[tauri::command]
pub fn crownkeep_web_status() -> Result<NativeWebStatus, String> {
    status_payload()
}

#[tauri::command]
pub fn crownkeep_web_save_search_credential(api_key: String) -> Result<NativeWebStatus, String> {
    let normalized = api_key.trim();
    if normalized.is_empty() {
        return Err("Search provider API key is required.".into());
    }
    if normalized.len() > 2048 {
        return Err("Search provider API key is unexpectedly long.".into());
    }

    credential_entry()?
        .set_password(normalized)
        .map_err(|error| format!("Could not save the web-search credential: {error}"))?;

    status_payload()
}

#[tauri::command]
pub fn crownkeep_web_clear_search_credential() -> Result<NativeWebStatus, String> {
    let entry = credential_entry()?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => status_payload(),
        Err(error) => Err(format!(
            "Could not remove the CrownKeep web-search credential: {error}"
        )),
    }
}

#[tauri::command]
pub async fn crownkeep_web_search(
    query: String,
    max_results: Option<u8>,
) -> Result<WebSearchResponse, String> {
    let api_key = load_search_credential()?.ok_or_else(|| {
        "Web Search is not configured. Add a Tavily API key in CrownKeep Web Access settings."
            .to_string()
    })?;
    let query = normalized_query(&query);
    if query.is_empty() {
        return Err("Web Search requires a query.".into());
    }

    let max_results = max_results.unwrap_or(5).clamp(1, 8);
    let response = web_client(15)?
        .post(TAVILY_SEARCH_URL)
        .bearer_auth(api_key)
        .json(&json!({
            "query": query,
            "topic": "general",
            "search_depth": "basic",
            "max_results": max_results,
            "include_answer": false,
            "include_raw_content": false,
            "include_images": false
        }))
        .send()
        .await
        .map_err(|error| format!("Search provider could not be reached: {error}"))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|error| format!("Could not read the search-provider response: {error}"))?;

    if !status.is_success() {
        let detail: String = body.chars().take(300).collect();
        return Err(format!(
            "Search provider returned HTTP {}{}",
            status.as_u16(),
            if detail.is_empty() {
                String::new()
            } else {
                format!(": {detail}")
            }
        ));
    }

    let payload: serde_json::Value = serde_json::from_str(&body)
        .map_err(|error| format!("Search provider returned invalid JSON: {error}"))?;

    let results = payload
        .get("results")
        .and_then(|value| value.as_array())
        .into_iter()
        .flatten()
        .filter_map(|item| {
            let title = item.get("title")?.as_str()?.trim();
            let url = item.get("url")?.as_str()?.trim();
            if title.is_empty() || url.is_empty() {
                return None;
            }
            let snippet = item
                .get("content")
                .and_then(|value| value.as_str())
                .unwrap_or("")
                .chars()
                .take(4000)
                .collect();

            Some(WebSearchResult {
                title: title.to_string(),
                url: url.to_string(),
                snippet,
                score: item.get("score").and_then(|value| value.as_f64()),
                published_at: item
                    .get("published_date")
                    .and_then(|value| value.as_str())
                    .map(str::to_string),
            })
        })
        .take(max_results as usize)
        .collect();

    Ok(WebSearchResponse { results })
}

#[tauri::command]
pub async fn crownkeep_web_read(url: String) -> Result<WebReadResponse, String> {
    let url = safe_public_url(&url)?;
    let response = web_client(20)?
        .get(url.clone())
        .header(
            reqwest::header::ACCEPT,
            "text/html, text/plain, application/xhtml+xml;q=0.9, */*;q=0.1",
        )
        .send()
        .await
        .map_err(|error| format!("Webpage could not be reached: {error}"))?;

    let status = response.status();
    if !status.is_success() {
        return Err(format!(
            "Webpage returned HTTP {}.",
            status.as_u16()
        ));
    }

    if response.content_length().is_some_and(|size| size > MAX_READ_BYTES as u64) {
        return Err("Webpage is too large for the bounded CrownKeep Web Read tool.".into());
    }

    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .to_ascii_lowercase();

    let bytes = response
        .bytes()
        .await
        .map_err(|error| format!("Could not read webpage content: {error}"))?;
    if bytes.len() > MAX_READ_BYTES {
        return Err("Webpage is too large for the bounded CrownKeep Web Read tool.".into());
    }

    let raw = String::from_utf8_lossy(&bytes).to_string();
    let looks_html = content_type.contains("html")
        || raw
            .trim_start()
            .to_ascii_lowercase()
            .starts_with("<!doctype html")
        || raw.trim_start().to_ascii_lowercase().starts_with("<html");

    let title = if looks_html { html_title(&raw) } else { None };
    let rendered = if looks_html {
        html2text::from_read(raw.as_bytes(), 100)
            .map_err(|error| format!("Could not convert webpage HTML to readable text: {error}"))?
    } else if content_type.starts_with("text/")
        || content_type.contains("json")
        || content_type.is_empty()
    {
        raw
    } else {
        return Err(format!(
            "Web Read does not support this content type: {}.",
            content_type
        ));
    };

    let content: String = rendered
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(18_000)
        .collect();

    if content.is_empty() {
        return Err("Web Read returned no readable content.".into());
    }

    Ok(WebReadResponse {
        url: url.to_string(),
        title,
        content,
    })
}
