import ipaddress
import json
import os
import urllib.error
import urllib.parse
import urllib.request

import azure.functions as func

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

TAVILY_SEARCH_URL = "https://api.tavily.com/search"
TAVILY_EXTRACT_URL = "https://api.tavily.com/extract"


def _headers() -> dict[str, str]:
    return {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": os.getenv("CROWNKEEP_WEB_ALLOWED_ORIGIN", "*"),
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Cache-Control": "no-store",
    }


def _response(payload: dict, status: int = 200) -> func.HttpResponse:
    return func.HttpResponse(
        json.dumps(payload),
        status_code=status,
        headers=_headers(),
        mimetype="application/json",
    )


def _body(req: func.HttpRequest) -> dict:
    try:
        value = req.get_json()
    except ValueError as exc:
        raise ValueError("Request body must be JSON.") from exc
    if not isinstance(value, dict):
        raise ValueError("Request body must be a JSON object.")
    return value


def _tavily_key() -> str:
    value = os.getenv("TAVILY_API_KEY", "").strip()
    if not value:
        raise RuntimeError("Web Gateway search provider is not configured.")
    return value


def _post_tavily(url: str, payload: dict, timeout: int) -> dict:
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={
            "Authorization": f"Bearer {_tavily_key()}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "CrownKeep-Web-Gateway/0.1",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(
            f"Search provider returned HTTP {exc.code}: {detail}"
        ) from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        raise RuntimeError("Search provider could not be reached.") from exc

    if not isinstance(result, dict):
        raise RuntimeError("Search provider returned an invalid response.")
    return result


def _safe_public_url(value: str) -> str:
    try:
        parsed = urllib.parse.urlparse(value)
    except ValueError as exc:
        raise ValueError("Invalid URL.") from exc

    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise ValueError("Only public http(s) URLs are supported.")
    if parsed.username or parsed.password:
        raise ValueError("URLs containing credentials are not supported.")

    hostname = parsed.hostname.lower()
    if hostname == "localhost" or hostname.endswith(".local"):
        raise ValueError("Local/private URLs are not supported.")

    try:
        address = ipaddress.ip_address(hostname)
        if (
            address.is_private
            or address.is_loopback
            or address.is_link_local
            or address.is_reserved
            or address.is_multicast
        ):
            raise ValueError("Local/private URLs are not supported.")
    except ValueError as exc:
        if "Local/private" in str(exc):
            raise
        # A normal DNS hostname is allowed. Tavily performs the external fetch.
        pass

    return urllib.parse.urlunparse(parsed)


@app.route(route="web/search", methods=["POST", "OPTIONS"])
def search(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=204, headers=_headers())

    try:
        body = _body(req)
        query = " ".join(str(body.get("query", "")).split())[:512]
        if not query:
            raise ValueError("query is required.")

        requested = body.get("maxResults", 5)
        try:
            max_results = max(1, min(8, int(requested)))
        except (TypeError, ValueError) as exc:
            raise ValueError("maxResults must be a number from 1 to 8.") from exc

        upstream = _post_tavily(
            TAVILY_SEARCH_URL,
            {
                "query": query,
                "topic": "general",
                "search_depth": "basic",
                "max_results": max_results,
                "include_answer": False,
                "include_raw_content": False,
                "include_images": False,
            },
            timeout=15,
        )

        results = []
        for item in upstream.get("results", []):
            if not isinstance(item, dict):
                continue
            title = str(item.get("title", "")).strip()
            url = str(item.get("url", "")).strip()
            snippet = str(item.get("content", "")).strip()
            if not title or not url:
                continue
            result = {
                "title": title,
                "url": url,
                "snippet": snippet[:4000],
            }
            if isinstance(item.get("score"), (int, float)):
                result["score"] = item["score"]
            published = item.get("published_date")
            if isinstance(published, str) and published:
                result["publishedAt"] = published
            results.append(result)

        return _response({"results": results[:max_results]})
    except ValueError as exc:
        return _response({"error": str(exc)}, 400)
    except RuntimeError as exc:
        return _response({"error": str(exc)}, 502)


@app.route(route="web/read", methods=["POST", "OPTIONS"])
def read(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return func.HttpResponse(status_code=204, headers=_headers())

    try:
        body = _body(req)
        url = _safe_public_url(str(body.get("url", "")).strip())
        upstream = _post_tavily(
            TAVILY_EXTRACT_URL,
            {
                "urls": [url],
                "extract_depth": "basic",
                "include_images": False,
            },
            timeout=20,
        )

        extracted = next(
            (
                item
                for item in upstream.get("results", [])
                if isinstance(item, dict) and item.get("raw_content")
            ),
            None,
        )
        if not extracted:
            failed = upstream.get("failed_results", [])
            detail = ""
            if isinstance(failed, list) and failed:
                detail = f" ({str(failed[0])[:240]})"
            return _response({"error": f"Webpage could not be read{detail}."}, 502)

        content = str(extracted.get("raw_content", "")).strip()
        return _response(
            {
                "url": str(extracted.get("url") or url),
                "title": str(extracted.get("title") or "").strip() or None,
                "content": content[:18000],
            }
        )
    except ValueError as exc:
        return _response({"error": str(exc)}, 400)
    except RuntimeError as exc:
        return _response({"error": str(exc)}, 502)
