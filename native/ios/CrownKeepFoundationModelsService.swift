import Foundation
import FoundationModels

/// Native on-device model service for the CrownKeep iPhone host.
///
/// This file intentionally contains no WKWebView/JavaScript transport code.
/// The web/native bridge should translate these values to the contract in
/// src/native/NativeAIHost.ts.
@available(iOS 26.0, *)
actor CrownKeepFoundationModelsService {
    struct AvailabilitySnapshot: Sendable {
        enum State: String, Sendable {
            case available
            case deviceNotEligible
            case appleIntelligenceNotEnabled
            case modelNotReady
            case unknown
        }

        let state: State
        let detail: String
        let contextSize: Int?
    }

    struct GenerationResult: Sendable {
        let content: String
        let elapsedMilliseconds: Double
    }

    private let model = SystemLanguageModel.default

    func availability() -> AvailabilitySnapshot {
        switch model.availability {
        case .available:
            return AvailabilitySnapshot(
                state: .available,
                detail: "Apple on-device Foundation Model is ready.",
                contextSize: model.contextSize
            )

        case .unavailable(.deviceNotEligible):
            return AvailabilitySnapshot(
                state: .deviceNotEligible,
                detail: "This device does not support Apple Intelligence.",
                contextSize: nil
            )

        case .unavailable(.appleIntelligenceNotEnabled):
            return AvailabilitySnapshot(
                state: .appleIntelligenceNotEnabled,
                detail: "Apple Intelligence is not enabled on this device.",
                contextSize: nil
            )

        case .unavailable(.modelNotReady):
            return AvailabilitySnapshot(
                state: .modelNotReady,
                detail: "The Apple on-device model is not ready yet.",
                contextSize: nil
            )

        @unknown default:
            return AvailabilitySnapshot(
                state: .unknown,
                detail: "The Apple on-device model is currently unavailable.",
                contextSize: nil
            )
        }
    }

    func generate(
        instructions: String,
        prompt: String
    ) async throws -> GenerationResult {
        let session = LanguageModelSession(
            model: model,
            instructions: instructions
        )

        let clock = ContinuousClock()
        let started = clock.now
        let response = try await session.respond(to: prompt)
        let elapsed = started.duration(to: clock.now)

        let components = elapsed.components
        let milliseconds =
            Double(components.seconds) * 1_000 +
            Double(components.attoseconds) / 1_000_000_000_000_000

        return GenerationResult(
            content: response.content,
            elapsedMilliseconds: milliseconds
        )
    }
}
