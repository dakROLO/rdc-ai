use serde::Serialize;
use std::net::IpAddr;
use std::time::Duration;

const WEB_PROVIDER: &str = "duckduckgo";
const DUCKDUCKGO_HTML_URL: &str = "https://html.duckduckgo.com/html/";
const MAX_READ_BYTES: usize = 2 * 1024 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeWebStatus {
    native_available: bool,
    provider: &'static str,
    search_available: bool,
    read_available: bool,
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

fn status_payload() -> NativeWebStatus {
    NativeWebStatus {
        native_available: true,
        provider: WEB_PROVIDER,
        search_available: true,
        read_available: true,
        detail:
            "Keyless DuckDuckGo search and direct webpage reading are ready. Only the search query or selected public URL leaves this device."
                .into(),
    }
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

fn normalized_text(value: &str, max_chars: usize) -> String {
    value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(max_chars)
        .collect()
}

fn html_fragment_text(fragment: &str, max_chars: usize) -> String {
    match html2text::from_read(fragment.as_bytes(), 100) {
        Ok(value) => normalized_text(&value, max_chars),
        Err(_) => normalized_text(fragment, max_chars),
    }
}

fn html_attr_value(tag: &str, attribute: &str) -> Option<String> {
    let lower = tag.to_ascii_lowercase();
    let needle = format!("{attribute}=");
    let start = lower.find(&needle)? + needle.len();
    let quote = tag.as_bytes().get(start).copied()? as char;
    if quote != '"' && quote != '\'' {
        return None;
    }

    let value_start = start + 1;
    let rest = tag.get(value_start..)?;
    let value_end = rest.find(quote)?;
    Some(rest[..value_end].replace("&amp;", "&"))
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

fn duckduckgo_result_url(raw_href: &str) -> Option<String> {
    let href = raw_href.replace("&amp;", "&");
    let absolute = if href.starts_with("//") {
        format!("https:{href}")
    } else if href.starts_with('/') {
        format!("https://duckduckgo.com{href}")
    } else {
        href
    };

    let parsed = reqwest::Url::parse(&absolute).ok()?;
    let host = parsed.host_str()?.to_ascii_lowercase();

    if host.ends_with("duckduckgo.com") && parsed.path().starts_with("/l/") {
        if let Some((_, target)) = parsed.query_pairs().find(|(key, _)| key == "uddg") {
            let target = target.into_owned();
            if safe_public_url(&target).is_ok() {
                return Some(target);
            }
        }
    }

    if safe_public_url(parsed.as_str()).is_ok() {
        Some(parsed.to_string())
    } else {
        None
    }
}

fn extract_snippet(segment: &str) -> String {
    let lower = segment.to_ascii_lowercase();
    let marker = ["class=\"result__snippet", "class='result__snippet"]
        .into_iter()
        .find_map(|needle| lower.find(needle));

    let Some(marker) = marker else {
        return String::new();
    };

    let start_tag = segment[..marker].rfind('<').unwrap_or(marker);
    let Some(open_end_rel) = segment[start_tag..].find('>') else {
        return String::new();
    };
    let content_start = start_tag + open_end_rel + 1;
    let content_rest = &segment[content_start..];
    let content_end = content_rest.find("</").unwrap_or(content_rest.len());
    html_fragment_text(&content_rest[..content_end], 1_200)
}

fn parse_duckduckgo_results(body: &str, max_results: usize) -> Vec<WebSearchResult> {
    let lower = body.to_ascii_lowercase();
    let markers = ["class=\"result__a", "class='result__a"];
    let mut cursor = 0usize;
    let mut results = Vec::new();

    while results.len() < max_results && cursor < body.len() {
        let remaining = &lower[cursor..];
        let marker_rel = markers
            .iter()
            .filter_map(|needle| remaining.find(needle))
            .min();

        let Some(marker_rel) = marker_rel else {
            break;
        };
        let marker = cursor + marker_rel;
        let Some(anchor_start) = lower[..marker].rfind("<a") else {
            cursor = marker + 1;
            continue;
        };
        let Some(open_end_rel) = body[anchor_start..].find('>') else {
            cursor = marker + 1;
            continue;
        };
        let open_end = anchor_start + open_end_rel;
        let open_tag = &body[anchor_start..=open_end];
        let Some(href) = html_attr_value(open_tag, "href") else {
            cursor = open_end + 1;
            continue;
        };
        let Some(close_rel) = lower[open_end + 1..].find("</a>") else {
            cursor = open_end + 1;
            continue;
        };
        let close_start = open_end + 1 + close_rel;
        let close_end = close_start + 4;
        let title = html_fragment_text(&body[open_end + 1..close_start], 400);

        let next_marker = markers
            .iter()
            .filter_map(|needle| lower[close_end..].find(needle))
            .min()
            .map(|offset| close_end + offset)
            .unwrap_or_else(|| (close_end + 6_000).min(body.len()));

        let snippet = extract_snippet(&body[close_end..next_marker.min(body.len())]);
        cursor = close_end;

        if title.is_empty() {
            continue;
        }
        let Some(url) = duckduckgo_result_url(&href) else {
            continue;
        };

        if results.iter().any(|result: &WebSearchResult| result.url == url) {
            continue;
        }

        results.push(WebSearchResult {
            title,
            url,
            snippet,
            score: None,
            published_at: None,
        });
    }

    results
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
        Some(html_fragment_text(raw, 240))
    }
}

#[tauri::command]
pub fn crownkeep_web_status() -> NativeWebStatus {
    status_payload()
}

#[tauri::command]
pub async fn crownkeep_web_search(
    query: String,
    max_results: Option<u8>,
) -> Result<WebSearchResponse, String> {
    let query = normalized_query(&query);
    if query.is_empty() {
        return Err("Web Search requires a query.".into());
    }

    let max_results = max_results.unwrap_or(5).clamp(1, 8) as usize;
    let response = web_client(15)?
        .get(DUCKDUCKGO_HTML_URL)
        .query(&[("q", query.as_str())])
        .header(
            reqwest::header::ACCEPT,
            "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
        )
        .send()
        .await
        .map_err(|error| format!("DuckDuckGo Search could not be reached: {error}"))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|error| format!("Could not read DuckDuckGo Search results: {error}"))?;

    if !status.is_success() {
        return Err(format!(
            "DuckDuckGo Search returned HTTP {}.",
            status.as_u16()
        ));
    }

    let lower = body.to_ascii_lowercase();
    if lower.contains("bots use duckduckgo too")
        || lower.contains("anomaly-modal")
        || lower.contains("challenge-form")
    {
        return Err(
            "DuckDuckGo asked for an interactive verification. CrownKeep will not bypass it; try again later."
                .into(),
        );
    }

    Ok(WebSearchResponse {
        results: parse_duckduckgo_results(&body, max_results),
    })
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
        return Err(format!("Webpage returned HTTP {}.", status.as_u16()));
    }

    if response
        .content_length()
        .is_some_and(|size| size > MAX_READ_BYTES as u64)
    {
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

    let content = normalized_text(&rendered, 18_000);

    if content.is_empty() {
        return Err("Web Read returned no readable content.".into());
    }

    Ok(WebReadResponse {
        url: url.to_string(),
        title,
        content,
    })
}
