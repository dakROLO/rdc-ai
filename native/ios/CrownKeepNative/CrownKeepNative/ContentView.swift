import SwiftUI
import FoundationModels

struct ContentView: View {
    private let model = SystemLanguageModel.default

    @State private var availabilityText = "Checking Apple on-device model…"
    @State private var response = ""
    @State private var isGenerating = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    HStack(spacing: 12) {
                        Image(systemName: "lock.shield.fill")
                            .font(.system(size: 30))
                            .foregroundStyle(.mint)

                        VStack(alignment: .leading, spacing: 2) {
                            Text("CrownKeep")
                                .font(.title2.bold())
                            Text("Private by default. Powerful by choice.")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }

                    GroupBox("Apple On-Device AI") {
                        VStack(alignment: .leading, spacing: 10) {
                            Text(availabilityText)
                                .frame(maxWidth: .infinity, alignment: .leading)

                            if model.isAvailable {
                                Label("Inside the Keep", systemImage: "checkmark.seal.fill")
                                    .foregroundStyle(.green)
                            }
                        }
                        .padding(.vertical, 4)
                    }

                    Button {
                        Task { await askAnne() }
                    } label: {
                        HStack {
                            if isGenerating {
                                ProgressView()
                            } else {
                                Image(systemName: "sparkles")
                            }
                            Text(isGenerating ? "Anne is thinking…" : "Ask Anne on this iPhone")
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(!model.isAvailable || isGenerating)

                    if !response.isEmpty {
                        GroupBox("Anne") {
                            Text(response)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .textSelection(.enabled)
                        }
                    }

                    Text("Phase 3 native-device proof: this screen calls Apple's on-device Foundation Model directly on the iPhone. No CrownKeep cloud service is involved.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding()
            }
            .navigationTitle("Inside the Keep")
        }
        .task {
            updateAvailability()
        }
    }

    private func updateAvailability() {
        switch model.availability {
        case .available:
            availabilityText = "Apple Foundation Model is ready on this iPhone."

        case .unavailable(.deviceNotEligible):
            availabilityText = "This iPhone is not eligible for Apple Intelligence."

        case .unavailable(.modelNotReady):
            availabilityText = "Apple's on-device model is not ready yet."

        case .unavailable(let reason):
            availabilityText = "Apple on-device AI is unavailable: \(String(describing: reason))"
        }
    }

    @MainActor
    private func askAnne() async {
        guard model.isAvailable else { return }

        isGenerating = true
        response = ""

        do {
            let session = LanguageModelSession(
                model: model,
                instructions: """
                You are Anne, the local assistant inside CrownKeep.
                CrownKeep is private by default and this test is running on-device.
                Respond briefly and naturally.
                """
            )

            let result = try await session.respond(
                to: "Say hello and confirm that this response was generated locally on this iPhone."
            )

            response = result.content
        } catch {
            response = "Local generation failed: \(error.localizedDescription)"
        }

        isGenerating = false
    }
}

#Preview {
    ContentView()
}
