import Foundation
import WebKit

final class CrownKeepBundleSchemeHandler: NSObject, WKURLSchemeHandler {
    private let rootDirectory: URL

    override init() {
        guard let resources = Bundle.main.resourceURL else {
            fatalError("CrownKeep app bundle has no resource directory.")
        }

        self.rootDirectory = resources.appendingPathComponent("dist", isDirectory: true)
        super.init()
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let requestURL = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }

        var relativePath = requestURL.path
        if relativePath.hasPrefix("/") {
            relativePath.removeFirst()
        }
        if relativePath.isEmpty {
            relativePath = "index.html"
        }

        guard !relativePath.split(separator: "/").contains("..") else {
            urlSchemeTask.didFailWithError(URLError(.noPermissionsToReadFile))
            return
        }

        var fileURL = rootDirectory.appendingPathComponent(relativePath)

        if !FileManager.default.fileExists(atPath: fileURL.path),
           !relativePath.contains(".") {
            fileURL = rootDirectory.appendingPathComponent("index.html")
        }

        guard
            FileManager.default.fileExists(atPath: fileURL.path),
            let data = try? Data(contentsOf: fileURL)
        else {
            urlSchemeTask.didFailWithError(URLError(.fileDoesNotExist))
            return
        }

        let response = URLResponse(
            url: requestURL,
            mimeType: Self.mimeType(for: fileURL.pathExtension),
            expectedContentLength: data.count,
            textEncodingName: Self.isText(fileURL.pathExtension) ? "utf-8" : nil
        )

        urlSchemeTask.didReceive(response)
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}

    private static func isText(_ extensionName: String) -> Bool {
        ["html", "js", "css", "json", "webmanifest", "svg", "txt"].contains(
            extensionName.lowercased()
        )
    }

    private static func mimeType(for extensionName: String) -> String {
        switch extensionName.lowercased() {
        case "html":
            return "text/html"
        case "js", "mjs":
            return "application/javascript"
        case "css":
            return "text/css"
        case "json":
            return "application/json"
        case "webmanifest":
            return "application/manifest+json"
        case "svg":
            return "image/svg+xml"
        case "png":
            return "image/png"
        case "jpg", "jpeg":
            return "image/jpeg"
        case "webp":
            return "image/webp"
        case "ico":
            return "image/x-icon"
        default:
            return "application/octet-stream"
        }
    }
}
