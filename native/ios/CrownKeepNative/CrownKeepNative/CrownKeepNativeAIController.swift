import Foundation
import FoundationModels
import WebKit
import Speech
import AVFoundation
import UIKit

@MainActor
final class CrownKeepNativeAIController: NSObject, WKScriptMessageHandler {
    static let messageHandlerName = "crownKeepAI"

    weak var webView: WKWebView?

    private let speech = CrownKeepSpeechInput()
    private let model = SystemLanguageModel.default
    private var generationTasks: [String: Task<Void, Never>] = [:]

    static let injectedBridgeScript = """
    (() => {
      const pending = new Map();
      const streams = new Map();
      let sequence = 0;

      const nextId = (prefix) => {
        sequence += 1;
        return prefix + "-" + Date.now() + "-" + sequence;
      };

      const post = (payload) => {
        window.webkit.messageHandlers.crownKeepAI.postMessage(payload);
      };

      window.__crownKeepNativeResolve = (id, value) => {
        const entry = pending.get(id);
        if (!entry) return;
        pending.delete(id);
        entry.resolve(value);
      };

      window.__crownKeepNativeReject = (id, message) => {
        const entry = pending.get(id);
        if (!entry) return;
        pending.delete(id);
        entry.reject(new Error(message || "Native CrownKeep request failed."));
      };

      window.__crownKeepNativeStreamChunk = (streamId, chunk) => {
        const stream = streams.get(streamId);
        if (stream) stream.onChunk(chunk);
      };

      window.__crownKeepNativeStreamError = (streamId, message) => {
        const stream = streams.get(streamId);
        if (!stream) return;
        streams.delete(streamId);
        stream.onError(message || "Native CrownKeep generation failed.");
      };

      window.__crownKeepNativeStreamComplete = (streamId) => {
        const stream = streams.get(streamId);
        if (!stream) return;
        streams.delete(streamId);
        stream.onComplete();
      };

      const call = (method, args = {}) =>
        new Promise((resolve, reject) => {
          const id = nextId("request");
          pending.set(id, { resolve, reject });
          post({ id, method, args });
        });

      window.crownKeepNativeAI = {
        platform: "ios",
        provider: "apple-foundation-models",
        speech: {
          capability: () => call("speechCapability"),
          startCapture: () => call("speechStart"),
          stopCapture: () => call("speechStop"),
          transcribe: () => call("speechTranscribe"),
          cancel: () => call("speechCancel")
        },

        getAvailability() {
          return call("getAvailability");
        },

        listModels() {
          return call("listModels");
        },

        async streamChat(request, onChunk, onError, onComplete) {
          const streamId = nextId("stream");
          streams.set(streamId, { onChunk, onError, onComplete });
          post({ id: streamId, method: "streamChat", args: { request } });

          return {
            async cancel() {
              streams.delete(streamId);
              post({ id: streamId, method: "cancelStream", args: { streamId } });
            }
          };
        }
      };
    })();
    """

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard
            message.name == Self.messageHandlerName,
            let body = message.body as? [String: Any],
            let id = body["id"] as? String,
            let method = body["method"] as? String
        else {
            return
        }

        let args = body["args"] as? [String: Any] ?? [:]

        switch method {
        case "speechCapability", "speechStart", "speechStop", "speechTranscribe", "speechCancel":
            Task { @MainActor [weak self] in
                guard let self else { return }
                do {
                    switch method {
                    case "speechCapability": self.resolve(id: id, value: await self.speech.capability())
                    case "speechStart": try await self.speech.startCapture(); self.resolve(id: id, value: true)
                    case "speechStop": try self.speech.stopCapture(); self.resolve(id: id, value: true)
                    case "speechTranscribe": self.resolve(id: id, value: try await self.speech.transcribe())
                    default: await self.speech.cancel(); self.resolve(id: id, value: true)
                    }
                } catch { self.reject(id: id, message: error.localizedDescription) }
            }

        case "getAvailability":
            resolve(id: id, value: availabilityPayload())

        case "listModels":
            resolve(id: id, value: modelListPayload())

        case "streamChat":
            startGeneration(streamId: id, args: args)

        case "cancelStream":
            generationTasks[id]?.cancel()
            generationTasks[id] = nil

        default:
            reject(id: id, message: "Unknown CrownKeep native method: \(method)")
        }
    }

    private func availabilityPayload() -> [String: Any] {
        switch model.availability {
        case .available:
            return [
                "available": true,
                "detail": "Apple on-device Foundation Model is ready."
            ]

        case .unavailable(.deviceNotEligible):
            return [
                "available": false,
                "reason": "device-not-eligible",
                "detail": "This iPhone is not eligible for Apple Intelligence."
            ]

        case .unavailable(.modelNotReady):
            return [
                "available": false,
                "reason": "model-not-ready",
                "detail": "Apple's on-device Foundation Model is not ready yet."
            ]

        case .unavailable(let reason):
            let description = String(describing: reason)
            let normalized = description.lowercased()
            let reasonCode = normalized.contains("notenabled")
                ? "apple-intelligence-not-enabled"
                : "unknown"

            return [
                "available": false,
                "reason": reasonCode,
                "detail": "Apple on-device AI is unavailable: \(description)"
            ]
        }
    }

    private func modelListPayload() -> [[String: Any]] {
        guard model.isAvailable else { return [] }

        return [[
            "id": "apple-system-language-model",
            "displayName": "Apple On-Device Model"
        ]]
    }

    private func startGeneration(streamId: String, args: [String: Any]) {
        guard model.isAvailable else {
            streamError(
                streamId: streamId,
                message: "Apple on-device Foundation Model is unavailable."
            )
            return
        }

        guard
            let request = args["request"] as? [String: Any],
            let messages = request["messages"] as? [[String: Any]]
        else {
            streamError(streamId: streamId, message: "Invalid native chat request.")
            return
        }

        let instructions = messages
            .filter { ($0["role"] as? String) == "system" }
            .compactMap { $0["content"] as? String }
            .joined(separator: "\n\n")

        let conversationMessages = messages.filter {
            ($0["role"] as? String) != "system"
        }

        guard let currentUserIndex = conversationMessages.lastIndex(where: {
            ($0["role"] as? String) == "user"
        }),
        let currentPrompt = conversationMessages[currentUserIndex]["content"] as? String
        else {
            streamError(streamId: streamId, message: "No current user prompt was supplied.")
            return
        }

        let recentPriorMessages = conversationMessages[..<currentUserIndex].suffix(8)

        let recentUserRequests = recentPriorMessages.compactMap { item -> String? in
            guard
                let role = item["role"] as? String,
                role == "user",
                let content = item["content"] as? String
            else {
                return nil
            }
            return content
        }

        let creativeIntentText = (recentUserRequests + [currentPrompt])
            .joined(separator: " ")
            .lowercased()

        let creativeRequestMarkers = [
            "story", "fiction", "fictional", "imagine", "creative",
            "brainstorm", "roleplay", "role-play", "hypothetical",
            "make up", "make-up", "invent", "princess", "kingdom"
        ]
        let isCreativeRequest = creativeRequestMarkers.contains {
            creativeIntentText.contains($0)
        }

        let priorConversation = recentPriorMessages
            .compactMap { item -> String? in
                guard
                    let role = item["role"] as? String,
                    let content = item["content"] as? String,
                    !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                else {
                    return nil
                }

                // For creative recovery, do not reinforce earlier model refusals.
                if isCreativeRequest && role == "assistant" {
                    return nil
                }

                let label = role == "assistant" ? "Anne" : "User"
                return "\(label): \(content)"
            }
            .joined(separator: "\n\n")

        let prompt: String
        if isCreativeRequest {
            prompt = """
            This is a creative fiction request. Complete it as fiction.

            A character named Anne is a fictional namesake character, not a claim about the assistant's biography or memories. You are expected to invent fictional characters, settings, secrets, dialogue, and events when needed.

            Recent user context:
            \(priorConversation.isEmpty ? "(none)" : priorConversation)

            Current user request:
            \(currentPrompt)

            Write or continue the requested creative content now. Do not explain that you lack personal narratives. Do not repeat an earlier refusal or offer to discuss themes instead.
            """
        } else if priorConversation.isEmpty {
            prompt = currentPrompt
        } else {
            prompt = """
            Previous conversation context:
            \(priorConversation)

            Current user request:
            \(currentPrompt)

            Respond directly to the current user request. Use the previous conversation only as context. Do not repeat an earlier Anne response unless the user explicitly asks you to repeat it.
            """
        }

        generationTasks[streamId]?.cancel()

        let task = Task { [weak self] in
            guard let self else { return }

            do {
                let session = LanguageModelSession(
                    model: self.model,
                    instructions: instructions.isEmpty
                        ? "You are Anne, the private local assistant inside CrownKeep."
                        : instructions
                )

                var generationOptions = GenerationOptions()
                if isCreativeRequest {
                    generationOptions.temperature = 0.9
                    generationOptions.sampling = .random(
                        probabilityThreshold: 0.9,
                        seed: nil
                    )
                }

                let stream = session.streamResponse(
                    to: prompt,
                    options: generationOptions
                )

                var previousSnapshot = ""

                for try await partialResponse in stream {
                    guard !Task.isCancelled else { return }

                    let snapshot = partialResponse.content
                    let delta: String

                    if snapshot.hasPrefix(previousSnapshot) {
                        delta = String(snapshot.dropFirst(previousSnapshot.count))
                    } else {
                        // Foundation Models normally emits cumulative snapshots.
                        // If that contract ever changes, do not drop content.
                        delta = snapshot
                    }

                    previousSnapshot = snapshot

                    if !delta.isEmpty {
                        self.streamChunk(
                            streamId: streamId,
                            chunk: ["text": delta]
                        )
                    }
                }

                guard !Task.isCancelled else { return }

                #if CROWNKEEP_IOS27_SDK
                if #available(iOS 27.0, *) {
                    let usage = session.usage
                    self.streamChunk(
                        streamId: streamId,
                        chunk: [
                            "text": "",
                            "usage": [
                                "promptTokens": usage.input.totalTokenCount,
                                "completionTokens": usage.output.totalTokenCount,
                                "totalTokens": usage.totalTokenCount
                            ]
                        ]
                    )
                }

                #endif

                self.streamComplete(streamId: streamId)
            } catch is CancellationError {
                // CrownKeep already treats the aborted request as stopped.
            } catch {
                self.streamError(
                    streamId: streamId,
                    message: error.localizedDescription
                )
            }

            self.generationTasks[streamId] = nil
        }

        generationTasks[streamId] = task
    }

    private func resolve(id: String, value: Any) {
        evaluate(
            function: "__crownKeepNativeResolve",
            arguments: [id, value]
        )
    }

    private func reject(id: String, message: String) {
        evaluate(
            function: "__crownKeepNativeReject",
            arguments: [id, message]
        )
    }

    private func streamChunk(streamId: String, chunk: [String: Any]) {
        evaluate(
            function: "__crownKeepNativeStreamChunk",
            arguments: [streamId, chunk]
        )
    }

    private func streamError(streamId: String, message: String) {
        generationTasks[streamId] = nil
        evaluate(
            function: "__crownKeepNativeStreamError",
            arguments: [streamId, message]
        )
    }

    private func streamComplete(streamId: String) {
        generationTasks[streamId] = nil
        evaluate(
            function: "__crownKeepNativeStreamComplete",
            arguments: [streamId]
        )
    }

    private func evaluate(function: String, arguments: [Any]) {
        let encoded = arguments.map(Self.jsonLiteral).joined(separator: ",")
        let script = "window.\(function)(\(encoded));"

        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript(script)
        }
    }

    private static func jsonLiteral(_ value: Any) -> String {
        guard JSONSerialization.isValidJSONObject(["value": value]),
              let data = try? JSONSerialization.data(
                withJSONObject: ["value": value],
                options: []
              ),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let normalized = object["value"],
              let normalizedData = try? JSONSerialization.data(
                withJSONObject: normalized,
                options: [.fragmentsAllowed]
              ),
              let string = String(data: normalizedData, encoding: .utf8)
        else {
            return "null"
        }

        return string
    }
}


/// Record-then-transcribe keeps microphone access and Apple speech entirely native.
/// No SFSpeechRecognizer network fallback is used.
@MainActor
private final class CrownKeepSpeechInput: NSObject {
    private var recorder: AVAudioRecorder?
    private var recordingURL: URL?
    private var analyzer: SpeechAnalyzer?
    private var epoch = 0
    private var capturing = false

    override init() {
        super.init()
        NotificationCenter.default.addObserver(self, selector: #selector(interrupted), name: UIApplication.willResignActiveNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(interrupted), name: AVAudioSession.interruptionNotification, object: nil)
    }
    deinit { NotificationCenter.default.removeObserver(self) }
    @objc private func interrupted() {
        // Permission sheets also resign active; only cancel an actual recording.
        if capturing || analyzer != nil { Task { await self.cancel() } }
    }
    private func failure(_ message: String) -> NSError {
        NSError(domain: "CrownKeepSpeech", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
    }
    private func installedLocale() async -> Locale? {
        guard SpeechTranscriber.isAvailable,
              let locale = await SpeechTranscriber.supportedLocale(equivalentTo: Locale.current)
        else { return nil }
        let installed = await SpeechTranscriber.installedLocales
        return installed.contains(where: { $0.identifier == locale.identifier }) ? locale : nil
    }
    func capability() async -> [String: Any] {
        let available = await installedLocale() != nil
        return ["available": available, "detail": available
            ? "Apple on-device dictation. Review text before sending. Record up to 60 seconds."
            : "Apple on-device speech or installed language assets are unavailable. Text chat remains available."]
    }
    func startCapture() async throws {
        guard !capturing, analyzer == nil else { throw failure("Dictation is already active.") }
        epoch += 1
        let requestEpoch = epoch
        let microphoneAllowed = await AVAudioApplication.requestRecordPermission()
        guard requestEpoch == epoch else { throw CancellationError() }
        guard microphoneAllowed else { throw failure("Microphone permission denied. Enable CrownKeep microphone access in Settings.") }
        let speechPermission = await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { continuation.resume(returning: $0) }
        }
        guard requestEpoch == epoch else { throw CancellationError() }
        guard speechPermission == .authorized else { throw failure("Speech permission denied. Enable CrownKeep speech access in Settings.") }
        guard await installedLocale() != nil else { throw failure("On-device speech assets are unavailable for this language.") }
        guard requestEpoch == epoch else { throw CancellationError() }
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.record, mode: .measurement)
            try session.setActive(true)
            let url = FileManager.default.temporaryDirectory.appendingPathComponent("crownkeep-dictation-\(UUID().uuidString).wav")
            recordingURL = url
            recorder = try AVAudioRecorder(url: url, settings: [
                AVFormatIDKey: kAudioFormatLinearPCM,
                AVSampleRateKey: 16000,
                AVNumberOfChannelsKey: 1,
                AVLinearPCMBitDepthKey: 16,
                AVLinearPCMIsFloatKey: false,
                AVLinearPCMIsBigEndianKey: false
            ])
            guard recorder?.record(forDuration: 60) == true else { throw failure("Could not start microphone capture.") }
            try FileManager.default.setAttributes([.protectionKey: FileProtectionType.complete], ofItemAtPath: url.path)
            capturing = true
        } catch { await cancel(); throw error }
    }
    func stopCapture() throws {
        guard recordingURL != nil else { throw failure("No recording is available.") }
        recorder?.stop(); recorder = nil; capturing = false
        try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
    func transcribe() async throws -> String {
        guard analyzer == nil, let url = recordingURL, let locale = await installedLocale() else {
            throw failure("No recording or local speech assets are ready.")
        }
        let requestEpoch = epoch
        let transcriber = SpeechTranscriber(locale: locale, preset: .transcription)
        let engine = SpeechAnalyzer(modules: [transcriber])
        analyzer = engine
        let timeout = Task { @MainActor in
            do { try await Task.sleep(for: .seconds(90)) } catch { return }
            await engine.cancelAndFinishNow()
        }
        defer { timeout.cancel(); analyzer = nil; removeRecording() }
        do {
            let file = try AVAudioFile(forReading: url)
            try await engine.start(inputAudioFile: file, finishAfterFile: true)
            var transcript = ""
            for try await result in transcriber.results {
                guard requestEpoch == epoch else { throw CancellationError() }
                transcript += String(result.text.characters)
            }
            guard requestEpoch == epoch else { throw CancellationError() }
            return transcript
        } catch { await engine.cancelAndFinishNow(); throw error }
    }
    func cancel() async {
        epoch += 1
        recorder?.stop(); recorder = nil; capturing = false
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        if let engine = analyzer { await engine.cancelAndFinishNow() }
        removeRecording()
    }
    private func removeRecording() {
        if let url = recordingURL { try? FileManager.default.removeItem(at: url) }
        recordingURL = nil
    }
}
