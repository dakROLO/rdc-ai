import CoreML
import CryptoKit
import Foundation
import StableDiffusion
import Tokenizers
import UIKit
import ZIPFoundation

// Optional models are explicitly user-installed. Nothing in this file downloads
// a model merely because CrownKeep starts or a permission switch is ON.
@MainActor
final class CrownKeepOptionalModels {
    static let shared = CrownKeepOptionalModels()

    private let fm = FileManager.default
    #if CROWNKEEP_IOS27_SDK
    // Keep iOS-27-only Julia types out of stored-property signatures because
    // CrownKeep still targets iOS 26. The concrete type is recovered only
    // inside #available(iOS 27, *) code paths.
    private var juliaRuntime: Any?
    private var juliaTokenizer: Any?
    #endif
    private var imagePipeline: StableDiffusionPipeline?
    private var juliaInstallProgress: [String: Any]?
    private var imageInstallProgress: [String: Any]?

    private struct DownloadResponse: Sendable {
        let statusCode: Int
        let finalURL: String
        let host: String
    }

    private let juliaPublishedRevision = "d1e943545c64e20e73a88ae1f890227c349e22ba"
    private let imageRevision = "2f36b5d37f234ef41df5e25b55240083bd6a95ee"
    private let imageArchiveBytes: Int64 = 1_565_721_660
    private let imageArchiveSHA256 = "fabf8f28478473abcf1c6288d35cc6faf1a399b09cb4813a8cb8bc44de2b734e"

    private init() {}

    // MARK: - Paths

    private var root: URL {
        let base = try! fm.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        return base.appending(path: "CrownKeepModels", directoryHint: .isDirectory)
    }

    private var juliaFolder: URL {
        root.appending(path: "julia-1-coreai-fp32-s512", directoryHint: .isDirectory)
    }

    private var imageFolder: URL {
        root.appending(path: "stable-diffusion-1-4-palettized", directoryHint: .isDirectory)
    }

    private var imageResources: URL {
        imageFolder.appending(path: "Resources", directoryHint: .isDirectory)
    }

    // MARK: - Shared download helpers

    private func ensureFreeSpace(_ required: Int64) throws {
        try fm.createDirectory(at: root, withIntermediateDirectories: true)
        let values = try root.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey])
        if let available = values.volumeAvailableCapacityForImportantUsage,
           available < required {
            throw NSError(
                domain: "CrownKeepModels",
                code: 10,
                userInfo: [
                    NSLocalizedDescriptionKey:
                        "Not enough free storage. CrownKeep needs about \(ByteCountFormatter.string(fromByteCount: required, countStyle: .file)) free for this local model."
                ]
            )
        }
    }

    private func modelRequest(_ url: URL) -> URLRequest {
        var request = URLRequest(
            url: url,
            cachePolicy: .reloadIgnoringLocalAndRemoteCacheData,
            timeoutInterval: 120
        )
        request.setValue("CrownKeep-iOS/1.0", forHTTPHeaderField: "User-Agent")
        request.setValue("application/octet-stream,*/*;q=0.8", forHTTPHeaderField: "Accept")
        return request
    }

    private func progress(_ stage: String, _ percent: Double, _ message: String) -> [String: Any] {
        [
            "stage": stage,
            "percent": max(0, min(100, percent)),
            "message": message,
        ]
    }

    private func download(
        _ url: URL,
        to destination: URL,
        expectedBytes: Int64? = nil,
        expectedSHA256: String? = nil,
        assetName: String? = nil,
        onProgress: (@MainActor (Double) -> Void)? = nil
    ) async throws {
        let name = assetName ?? destination.lastPathComponent
        try fm.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
        if fm.fileExists(atPath: destination.path()) {
            try fm.removeItem(at: destination)
        }

        let request = modelRequest(url)
        let response: DownloadResponse = try await withCheckedThrowingContinuation { continuation in
            let task = URLSession.shared.downloadTask(with: request) { temporary, response, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                guard let temporary, let response else {
                    continuation.resume(throwing: NSError(
                        domain: "CrownKeepModels",
                        code: 11,
                        userInfo: [NSLocalizedDescriptionKey: "No download response was returned for \(name)."]
                    ))
                    return
                }
                do {
                    let manager = FileManager.default
                    if manager.fileExists(atPath: destination.path()) {
                        try manager.removeItem(at: destination)
                    }
                    try manager.moveItem(at: temporary, to: destination)
                    let http = response as? HTTPURLResponse
                    continuation.resume(returning: DownloadResponse(
                        statusCode: http?.statusCode ?? -1,
                        finalURL: response.url?.absoluteString ?? url.absoluteString,
                        host: response.url?.host ?? url.host ?? "unknown host"
                    ))
                } catch {
                    continuation.resume(throwing: error)
                }
            }
            task.resume()

            if let onProgress {
                Task { @MainActor in
                    while task.state == .running {
                        let expected = task.countOfBytesExpectedToReceive
                        let received = task.countOfBytesReceived
                        if expected > 0 {
                            onProgress(Double(received) / Double(expected))
                        }
                        try? await Task.sleep(nanoseconds: 200_000_000)
                    }
                }
            }
        }

        guard (200..<300).contains(response.statusCode) else {
            try? fm.removeItem(at: destination)
            throw NSError(
                domain: "CrownKeepModels",
                code: 11,
                userInfo: [
                    NSLocalizedDescriptionKey:
                        "Could not download \(name). HTTP \(response.statusCode) from \(response.host). Final URL: \(response.finalURL)"
                ]
            )
        }

        let size = (try? destination.resourceValues(forKeys: [.fileSizeKey]).fileSize).map(Int64.init)
        if let expectedBytes, size != expectedBytes {
            try? fm.removeItem(at: destination)
            throw NSError(
                domain: "CrownKeepModels",
                code: 12,
                userInfo: [
                    NSLocalizedDescriptionKey:
                        "Downloaded \(name) size did not match the pinned release (expected \(expectedBytes), received \(size ?? -1))."
                ]
            )
        }

        if let expectedSHA256 {
            let actual = try sha256(of: destination)
            guard actual.caseInsensitiveCompare(expectedSHA256) == .orderedSame else {
                try? fm.removeItem(at: destination)
                throw NSError(
                    domain: "CrownKeepModels",
                    code: 13,
                    userInfo: [NSLocalizedDescriptionKey: "Downloaded \(name) checksum did not match the pinned release."]
                )
            }
        }
        onProgress?(1)
    }

    private func downloadSmall(
        _ url: URL,
        to destination: URL,
        assetName: String? = nil
    ) async throws {
        let name = assetName ?? destination.lastPathComponent
        let (data, response) = try await URLSession.shared.data(for: modelRequest(url))
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let status = (response as? HTTPURLResponse)?.statusCode ?? -1
            let finalURL = response.url?.absoluteString ?? url.absoluteString
            throw NSError(
                domain: "CrownKeepModels",
                code: 14,
                userInfo: [
                    NSLocalizedDescriptionKey:
                        "Could not download \(name). HTTP \(status). Final URL: \(finalURL)"
                ]
            )
        }
        try fm.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
        try data.write(to: destination, options: .atomic)
    }

    private func sha256(of url: URL) throws -> String {
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        var digest = SHA256()
        while true {
            let data = try handle.read(upToCount: 4 * 1024 * 1024) ?? Data()
            if data.isEmpty { break }
            digest.update(data: data)
        }
        return digest.finalize().map { String(format: "%02x", $0) }.joined()
    }

    private func stagingFolder(_ name: String) throws -> URL {
        try fm.createDirectory(at: root, withIntermediateDirectories: true)
        let url = root.appending(path: ".\(name)-\(UUID().uuidString)", directoryHint: .isDirectory)
        try fm.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    // MARK: - Julia

    func juliaStatus() -> [String: Any] {
        #if CROWNKEEP_IOS27_SDK
        if #available(iOS 27.0, *) {
            let installed = juliaFilesPresent()
            if (juliaRuntime as? JuliaDecisions) != nil {
                return decisionStatus(
                    available: true,
                    loadState: "loaded",
                    detail: "Julia-1 is installed and its Core AI runtime passed CrownKeep's native parity smoke check. Production semantic categories remain gated until CrownKeep-specific qualification is approved."
                )
            }
            if installed {
                return decisionStatus(
                    available: true,
                    loadState: "unloaded",
                    detail: "Julia-1 is installed locally. It will load only when Decision Assist evaluates a qualified category."
                )
            }
            return decisionStatus(
                available: false,
                loadState: "unavailable",
                detail: "Julia-1 is not installed. Download is optional and stays on this device after installation."
            )
        }
        #endif
        return decisionStatus(
            available: false,
            loadState: "unavailable",
            detail: "Julia Decision Assist requires iOS 27 and CrownKeep's Core AI host."
        )
    }

    private func decisionStatus(available: Bool, loadState: String, detail: String) -> [String: Any] {
        var value: [String: Any] = [
            "available": available,
            "version": "Julia-1 Core AI fp32-s512",
            "backend": "Apple Core AI · local GPU/CPU",
            "loadState": loadState,
            // The current CrownKeep semantic suite is not yet sufficient to
            // promote any category. Native installation/parity is separate
            // from production semantic qualification.
            "qualifiedJobs": [],
            "detail": detail,
        ]
        if let juliaInstallProgress { value["installProgress"] = juliaInstallProgress }
        return value
    }

    private func juliaFilesPresent() -> Bool {
        fm.fileExists(atPath: juliaFolder.appending(path: "julia1_fp32_s512.aimodel").path()) &&
        fm.fileExists(atPath: juliaFolder.appending(path: "metadata.json").path()) &&
        fm.fileExists(atPath: juliaFolder.appending(path: "tokenizer/tokenizer.json").path()) &&
        fm.fileExists(atPath: juliaFolder.appending(path: "tokenizer/tokenizer_config.json").path())
    }

    #if CROWNKEEP_IOS27_SDK
    func installJulia() async throws -> [String: Any] {
        guard #available(iOS 27.0, *) else {
            throw NSError(domain: "CrownKeepJulia", code: 1, userInfo: [NSLocalizedDescriptionKey: "Julia requires iOS 27."])
        }
        try ensureFreeSpace(900_000_000)
        let staging = try stagingFolder("julia")
        defer { try? fm.removeItem(at: staging) }
        juliaInstallProgress = progress("manifest", 1, "Preparing Julia download…")

        let repoBase = "https://huggingface.co/mlboydaisuke/Julia-1-CoreAI/resolve/\(juliaPublishedRevision)"
        guard let manifestURL = URL(string: "\(repoBase)/SHA256SUMS?download=true") else {
            throw NSError(domain: "CrownKeepJulia", code: 2, userInfo: [NSLocalizedDescriptionKey: "Julia manifest URL is invalid."])
        }
        let manifestFile = staging.appending(path: "SHA256SUMS")
        try await downloadSmall(manifestURL, to: manifestFile, assetName: "Julia SHA256 manifest")
        let manifestText = try String(contentsOf: manifestFile, encoding: .utf8)

        struct JuliaAsset {
            let path: String
            let sha256: String
        }
        let variantPrefix = "macos/fp32-s512/"
        let bundlePrefix = variantPrefix + "julia1_fp32_s512.aimodel/"
        var assets: [JuliaAsset] = []

        for line in manifestText.split(whereSeparator: \.isNewline) {
            let fields = line.split(maxSplits: 1, whereSeparator: \.isWhitespace)
            guard fields.count == 2 else { continue }
            let hash = String(fields[0])
            let path = String(fields[1]).trimmingCharacters(in: CharacterSet(charactersIn: " *"))
            let needed =
                path.hasPrefix(bundlePrefix) ||
                path == variantPrefix + "metadata.json" ||
                path.hasPrefix(variantPrefix + "tokenizer/")
            if needed {
                assets.append(.init(path: path, sha256: hash))
            }
        }

        guard
            assets.contains(where: { $0.path == bundlePrefix + "main.mlirb" }),
            assets.contains(where: { $0.path == bundlePrefix + "main.hash" }),
            assets.contains(where: { $0.path == bundlePrefix + "metadata.json" }),
            assets.contains(where: { $0.path == variantPrefix + "metadata.json" }),
            assets.contains(where: { $0.path == variantPrefix + "tokenizer/tokenizer.json" })
        else {
            throw NSError(
                domain: "CrownKeepJulia",
                code: 3,
                userInfo: [NSLocalizedDescriptionKey: "Julia manifest did not contain the required Core AI bundle files."]
            )
        }

        assets.sort { left, right in
            func rank(_ path: String) -> Int {
                if path.hasSuffix("/main.mlirb") { return 0 }
                if path.hasSuffix("/tokenizer.json") { return 1 }
                return 2
            }
            return rank(left.path) == rank(right.path)
                ? left.path < right.path
                : rank(left.path) < rank(right.path)
        }

        let minorAssets = max(1, assets.filter { !$0.path.hasSuffix("/main.mlirb") && !$0.path.hasSuffix("/tokenizer.json") }.count)
        var minorDone = 0

        for asset in assets {
            let relative = String(asset.path.dropFirst(variantPrefix.count))
            let destination = staging.appending(path: relative)
            guard let url = URL(string: "\(repoBase)/\(asset.path)?download=true") else {
                throw NSError(domain: "CrownKeepJulia", code: 4, userInfo: [NSLocalizedDescriptionKey: "Julia asset URL is invalid: \(asset.path)"])
            }

            if asset.path.hasSuffix("/main.mlirb") {
                try await download(
                    url,
                    to: destination,
                    expectedSHA256: asset.sha256,
                    assetName: "Julia Core AI weights",
                    onProgress: { [weak self] fraction in
                        self?.juliaInstallProgress = self?.progress(
                            "downloading",
                            3 + fraction * 80,
                            "Downloading Julia… \(Int((3 + fraction * 80).rounded()))%"
                        )
                    }
                )
            } else if asset.path.hasSuffix("/tokenizer.json") {
                try await download(
                    url,
                    to: destination,
                    expectedSHA256: asset.sha256,
                    assetName: "Julia tokenizer",
                    onProgress: { [weak self] fraction in
                        self?.juliaInstallProgress = self?.progress(
                            "tokenizer",
                            84 + fraction * 10,
                            "Downloading Julia tokenizer… \(Int((84 + fraction * 10).rounded()))%"
                        )
                    }
                )
            } else {
                minorDone += 1
                juliaInstallProgress = progress(
                    "metadata",
                    94 + (Double(minorDone) / Double(minorAssets)) * 3,
                    "Verifying Julia metadata…"
                )
                try await download(
                    url,
                    to: destination,
                    expectedSHA256: asset.sha256,
                    assetName: destination.lastPathComponent
                )
            }
        }

        juliaInstallProgress = progress("tokenizer", 97, "Preparing Julia tokenizer…")
        try normalizeJuliaTokenizerConfig(at: staging.appending(path: "tokenizer/tokenizer_config.json"))

        juliaInstallProgress = progress("validating", 98, "Running Julia parity check on this iPhone…")
        try await validateJulia(folder: staging)

        juliaRuntime = nil
        juliaTokenizer = nil
        if fm.fileExists(atPath: juliaFolder.path()) { try fm.removeItem(at: juliaFolder) }
        try fm.moveItem(at: staging, to: juliaFolder)
        try await loadJulia()
        juliaInstallProgress = progress("complete", 100, "Julia is installed locally.")
        return juliaStatus()
    }

    func removeJulia() async throws -> [String: Any] {
        juliaRuntime = nil
        juliaTokenizer = nil
        juliaInstallProgress = nil
        if fm.fileExists(atPath: juliaFolder.path()) { try fm.removeItem(at: juliaFolder) }
        return juliaStatus()
    }

    func releaseJulia() {
        juliaRuntime = nil
        juliaTokenizer = nil
    }

    @available(iOS 27.0, *)
    private func normalizeJuliaTokenizerConfig(at url: URL) throws {
        let data = try Data(contentsOf: url)
        guard var json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw NSError(domain: "CrownKeepJulia", code: 3, userInfo: [NSLocalizedDescriptionKey: "Julia tokenizer configuration is invalid."])
        }
        json["tokenizer_class"] = "GemmaTokenizer"
        try JSONSerialization.data(withJSONObject: json, options: [.prettyPrinted, .sortedKeys]).write(to: url, options: .atomic)
    }

    @available(iOS 27.0, *)
    private func tokenizerForJulia(folder: URL) async throws -> any Tokenizer {
        let tokenizer = try await AutoTokenizer.from(
            modelFolder: folder.appending(path: "tokenizer", directoryHint: .isDirectory)
        )
        return tokenizer
    }

    @available(iOS 27.0, *)
    private func makeJulia(folder: URL) async throws -> (JuliaDecisions, any Tokenizer) {
        let tokenizer = try await tokenizerForJulia(folder: folder)
        let runtime = try await JuliaDecisions(folder: folder) { text in
            let pieces = tokenizer.tokenize(text: text)
            return tokenizer.convertTokensToIds(pieces).compactMap { $0 }.map(Int32.init)
        }
        return (runtime, tokenizer)
    }

    @available(iOS 27.0, *)
    private func validateJulia(folder: URL) async throws {
        let (runtime, _) = try await makeJulia(folder: folder)
        let question = "Which option correctly fills the blank?\nHe couldn't fit the soda bottle on the refrigerator shelf because the _ was too tall."
        let expected: [Int32] = [
            2, 6241, 2872, 235292, 12236, 4984, 16105, 49992, 573, 15601,
            235336, 108, 1315, 8961, 235303, 235251, 3806, 573, 30886, 12989,
            611, 573, 46154, 25966, 1861, 573, 1762, 729, 1980, 13754,
            235265, 1, 4, 25966, 4, 12989, 1, 1
        ]
        let row = try runtime.row(
            state: "",
            instructions: question,
            type: "choice",
            options: ["shelf", "bottle"]
        )
        guard row.ids == expected, row.markers == [32, 34] else {
            throw NSError(
                domain: "CrownKeepJulia",
                code: 4,
                userInfo: [
                    NSLocalizedDescriptionKey:
                        "The downloaded Julia model loaded, but the iPhone tokenizer did not reproduce the publisher's pinned parity row. CrownKeep will not enable it."
                ]
            )
        }
        let answer = try await runtime.predict(
            state: "",
            questions: [
                ("smoke", .choice(question, [("shelf", "shelf"), ("bottle", "bottle")]))
            ]
        )["smoke"]
        guard answer?.choice == "bottle" else {
            throw NSError(
                domain: "CrownKeepJulia",
                code: 5,
                userInfo: [NSLocalizedDescriptionKey: "Julia loaded but failed CrownKeep's native inference parity smoke check."]
            )
        }
    }

    @available(iOS 27.0, *)
    private func loadJulia() async throws {
        if (juliaRuntime as? JuliaDecisions) != nil { return }
        guard juliaFilesPresent() else {
            throw NSError(domain: "CrownKeepJulia", code: 6, userInfo: [NSLocalizedDescriptionKey: "Julia is not installed."])
        }
        let (runtime, tokenizer) = try await makeJulia(folder: juliaFolder)
        juliaRuntime = runtime
        juliaTokenizer = tokenizer
    }

    func decide(_ request: [String: Any]) async throws -> [String: Any] {
        guard #available(iOS 27.0, *) else {
            throw NSError(domain: "CrownKeepJulia", code: 7, userInfo: [NSLocalizedDescriptionKey: "Julia requires iOS 27."])
        }
        try await loadJulia()
        guard
            let runtime = juliaRuntime as? JuliaDecisions,
            let state = request["state"] as? String,
            let question = request["question"] as? String,
            let optionRecords = request["options"] as? [[String: Any]]
        else {
            throw NSError(domain: "CrownKeepJulia", code: 8, userInfo: [NSLocalizedDescriptionKey: "Invalid Julia decision request."])
        }

        let options: [(String, String)] = try optionRecords.map { item in
            guard let id = item["id"] as? String, let description = item["description"] as? String else {
                throw NSError(domain: "CrownKeepJulia", code: 9, userInfo: [NSLocalizedDescriptionKey: "Julia decision options are invalid."])
            }
            return (id, description)
        }

        let start = ContinuousClock.now
        let answer = try await runtime.predict(
            state: String(state.prefix(12_000)),
            questions: [("decision", .choice(String(question.prefix(1000)), options))]
        )["decision"]
        guard let answer, let selected = answer.choice else {
            throw NSError(domain: "CrownKeepJulia", code: 10, userInfo: [NSLocalizedDescriptionKey: "Julia returned no decision."])
        }
        let elapsed = ContinuousClock.now - start
        let latencyMs = Double(elapsed.components.seconds) * 1000 +
            Double(elapsed.components.attoseconds) / 1_000_000_000_000_000

        var scores: [String: Double] = [:]
        for (index, key) in answer.keys.enumerated() where index < answer.probabilities.count {
            scores[key] = answer.probabilities[index]
        }
        return [
            "selected": selected,
            "confidence": answer.maxProbability ?? 0,
            "scores": scores,
            "latencyMs": latencyMs,
        ]
    }

    #else
    func installJulia() async throws -> [String: Any] {
        throw NSError(
            domain: "CrownKeepJulia",
            code: 1,
            userInfo: [NSLocalizedDescriptionKey: "Julia Decision Assist requires an iOS 27 / Xcode 27 CrownKeep build."]
        )
    }

    func removeJulia() async throws -> [String: Any] {
        if fm.fileExists(atPath: juliaFolder.path()) { try fm.removeItem(at: juliaFolder) }
        return juliaStatus()
    }

    func releaseJulia() {}

    func decide(_ request: [String: Any]) async throws -> [String: Any] {
        _ = request
        throw NSError(
            domain: "CrownKeepJulia",
            code: 7,
            userInfo: [NSLocalizedDescriptionKey: "Julia Decision Assist requires an iOS 27 / Xcode 27 CrownKeep build."]
        )
    }

    #endif

    // MARK: - Image generation

    func imageStatus() -> [String: Any] {
        let ready = imageResourcesReady()
        var value: [String: Any] = [
            "ocrAvailable": true,
            "understandingAvailable": false, // controller overlays Foundation Models image input availability
            "generationAvailable": ready,
            "generationState": ready ? "ready" : "not-installed",
            "detail": ready
                ? "Stable Diffusion 1.4 palettized Core ML model is installed locally."
                : "Optional local image model is not installed. Download is about 1.57 GB and occurs only when requested.",
        ]
        if let imageInstallProgress { value["installProgress"] = imageInstallProgress }
        return value
    }

    private func imageResourcesReady(at resources: URL? = nil) -> Bool {
        let base = resources ?? imageResources
        let required = [
            "TextEncoder.mlmodelc",
            "VAEDecoder.mlmodelc",
            "vocab.json",
            "merges.txt",
        ]
        let basics = required.allSatisfy { fm.fileExists(atPath: base.appending(path: $0).path()) }
        let fullUnet = fm.fileExists(atPath: base.appending(path: "Unet.mlmodelc").path())
        let chunked = fm.fileExists(atPath: base.appending(path: "UnetChunk1.mlmodelc").path()) &&
            fm.fileExists(atPath: base.appending(path: "UnetChunk2.mlmodelc").path())
        return basics && (fullUnet || chunked)
    }

    func installImageModel() async throws -> [String: Any] {
        try ensureFreeSpace(4_500_000_000)
        imageInstallProgress = progress("preparing", 1, "Preparing local image model download…")
        let staging = try stagingFolder("image")
        defer { try? fm.removeItem(at: staging) }
        let archive = staging.appending(path: "model.zip")

        let filename = "coreml-stable-diffusion-1-4-palettized_split_einsum_v2_compiled.zip"
        guard let url = URL(string:
            "https://huggingface.co/apple/coreml-stable-diffusion-1-4-palettized/resolve/\(imageRevision)/\(filename)?download=true"
        ) else {
            throw NSError(domain: "CrownKeepImages", code: 20, userInfo: [NSLocalizedDescriptionKey: "Pinned image-model URL is invalid."])
        }

        try await download(
            url,
            to: archive,
            expectedBytes: imageArchiveBytes,
            expectedSHA256: imageArchiveSHA256,
            assetName: "local image model archive",
            onProgress: { [weak self] fraction in
                self?.imageInstallProgress = self?.progress(
                    "downloading",
                    2 + fraction * 86,
                    "Downloading image model… \(Int((2 + fraction * 86).rounded()))%"
                )
            }
        )

        imageInstallProgress = progress("extracting", 90, "Extracting Core ML image model…")
        let expanded = staging.appending(path: "expanded", directoryHint: .isDirectory)
        try fm.createDirectory(at: expanded, withIntermediateDirectories: true)
        try await Task.detached(priority: .userInitiated) {
            try FileManager.default.unzipItem(at: archive, to: expanded)
        }.value

        imageInstallProgress = progress("mapping", 94, "Preparing image model resources…")
        let finalStaging = staging.appending(path: "final", directoryHint: .isDirectory)
        let canonicalResources = finalStaging.appending(path: "Resources", directoryHint: .isDirectory)
        try fm.createDirectory(at: canonicalResources, withIntermediateDirectories: true)
        try stageStableDiffusionResources(from: expanded, to: canonicalResources)
        guard imageResourcesReady(at: canonicalResources) else {
            throw NSError(
                domain: "CrownKeepImages",
                code: 22,
                userInfo: [NSLocalizedDescriptionKey: "Prepared image model is missing required Core ML resources."]
            )
        }

        imageInstallProgress = progress("validating", 97, "Validating image runtime on this iPhone…")
        imagePipeline?.unloadResources()
        imagePipeline = nil
        if fm.fileExists(atPath: imageFolder.path()) { try fm.removeItem(at: imageFolder) }
        try fm.moveItem(at: finalStaging, to: imageFolder)

        // Load/unload once so "installed" means the pipeline can actually open
        // the downloaded assets on this device, not merely that files exist.
        let pipeline = try makeImagePipeline()
        try pipeline.loadResources()
        pipeline.unloadResources()
        imageInstallProgress = progress("complete", 100, "Local image model is installed.")
        return imageStatus()
    }

    func removeImageModel() async throws -> [String: Any] {
        imagePipeline?.unloadResources()
        imageInstallProgress = nil
        imagePipeline = nil
        if fm.fileExists(atPath: imageFolder.path()) { try fm.removeItem(at: imageFolder) }
        return imageStatus()
    }

    private func allExpandedURLs(inside root: URL) -> [URL] {
        guard let enumerator = fm.enumerator(
            at: root,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles]
        ) else { return [] }
        return enumerator.compactMap { $0 as? URL }
    }

    private func stageStableDiffusionResources(from expanded: URL, to destination: URL) throws {
        let urls = allExpandedURLs(inside: expanded)

        func namedFile(_ exact: String) -> URL? {
            urls.first { $0.lastPathComponent.caseInsensitiveCompare(exact) == .orderedSame }
        }

        func modelDirectory(_ terms: [String]) -> URL? {
            urls.first { url in
                let name = url.lastPathComponent.lowercased()
                guard name.hasSuffix(".mlmodelc") else { return false }
                return terms.allSatisfy { name.contains($0) }
            }
        }

        let textEncoder =
            modelDirectory(["text", "encoder"])
            ?? modelDirectory(["textencoder"])
        let vaeDecoder =
            modelDirectory(["vae", "decoder"])
            ?? modelDirectory(["vaedecoder"])
        let unetChunk1 = urls.first {
            $0.lastPathComponent.caseInsensitiveCompare("UnetChunk1.mlmodelc") == .orderedSame
        }
        let unetChunk2 = urls.first {
            $0.lastPathComponent.caseInsensitiveCompare("UnetChunk2.mlmodelc") == .orderedSame
        }
        let fullUnet =
            urls.first { $0.lastPathComponent.caseInsensitiveCompare("Unet.mlmodelc") == .orderedSame }
            ?? urls.first {
                let name = $0.lastPathComponent.lowercased()
                return name.hasSuffix(".mlmodelc") &&
                    name.contains("unet") &&
                    !name.contains("chunk")
            }
        let safety =
            modelDirectory(["safety"])
        let vocab = namedFile("vocab.json")
        let merges = namedFile("merges.txt")

        let hasUnet = (unetChunk1 != nil && unetChunk2 != nil) || fullUnet != nil
        guard
            let textEncoder,
            let vaeDecoder,
            let vocab,
            let merges,
            hasUnet
        else {
            let modelNames = urls
                .filter { $0.lastPathComponent.lowercased().hasSuffix(".mlmodelc") }
                .map(\.lastPathComponent)
                .sorted()
                .prefix(16)
                .joined(separator: ", ")
            throw NSError(
                domain: "CrownKeepImages",
                code: 21,
                userInfo: [
                    NSLocalizedDescriptionKey:
                        "Downloaded image model archive was valid, but CrownKeep could not map its compiled resources. Found: \(modelNames.isEmpty ? "no .mlmodelc folders" : modelNames)."
                ]
            )
        }

        func copy(_ source: URL, _ name: String) throws {
            let target = destination.appending(path: name)
            if fm.fileExists(atPath: target.path()) { try fm.removeItem(at: target) }
            try fm.copyItem(at: source, to: target)
        }

        try copy(textEncoder, "TextEncoder.mlmodelc")
        try copy(vaeDecoder, "VAEDecoder.mlmodelc")
        if let unetChunk1, let unetChunk2 {
            try copy(unetChunk1, "UnetChunk1.mlmodelc")
            try copy(unetChunk2, "UnetChunk2.mlmodelc")
        } else if let fullUnet {
            try copy(fullUnet, "Unet.mlmodelc")
        }
        try copy(vocab, "vocab.json")
        try copy(merges, "merges.txt")
        if let safety { try copy(safety, "SafetyChecker.mlmodelc") }

        // VAEEncoder is optional for text-to-image generation but preserve it
        // when the archive contains one.
        if let vaeEncoder =
            modelDirectory(["vae", "encoder"])
            ?? modelDirectory(["vaeencoder"]) {
            try copy(vaeEncoder, "VAEEncoder.mlmodelc")
        }
    }

    private func makeImagePipeline() throws -> StableDiffusionPipeline {
        guard imageResourcesReady() else {
            throw NSError(domain: "CrownKeepImages", code: 22, userInfo: [NSLocalizedDescriptionKey: "Local image model is not installed."])
        }
        let config = MLModelConfiguration()
        // Apple's split-einsum mobile path is designed for CPU + Neural Engine;
        // reduced-memory mode aggressively unloads stages between steps.
        config.computeUnits = .cpuAndNeuralEngine
        return try StableDiffusionPipeline(
            resourcesAt: imageResources,
            controlNet: [],
            configuration: config,
            disableSafety: false,
            reduceMemory: true
        )
    }

    func generateImage(prompt: String) async throws -> String {
        let clean = String(prompt.trimmingCharacters(in: .whitespacesAndNewlines).prefix(2000))
        guard !clean.isEmpty else {
            throw NSError(domain: "CrownKeepImages", code: 23, userInfo: [NSLocalizedDescriptionKey: "Image prompt is empty."])
        }

        let pipeline = try makeImagePipeline()
        imagePipeline = pipeline
        defer {
            pipeline.unloadResources()
            imagePipeline = nil
        }
        try pipeline.loadResources()

        var configuration = StableDiffusionPipeline.Configuration(prompt: clean)
        configuration.imageCount = 1
        configuration.stepCount = 20
        configuration.guidanceScale = 7.5
        configuration.disableSafety = false
        configuration.seed = UInt32.random(in: UInt32.min...UInt32.max)

        let images = try await Task.detached(priority: .userInitiated) {
            try pipeline.generateImages(configuration: configuration)
        }.value
        guard let image = images.first ?? nil else {
            throw NSError(
                domain: "CrownKeepImages",
                code: 24,
                userInfo: [NSLocalizedDescriptionKey: "The local image pipeline produced no image. The safety checker may have rejected the result."]
            )
        }
        guard let png = UIImage(cgImage: image).pngData() else {
            throw NSError(domain: "CrownKeepImages", code: 25, userInfo: [NSLocalizedDescriptionKey: "Generated image could not be encoded."])
        }
        return "data:image/png;base64," + png.base64EncodedString()
    }
}
