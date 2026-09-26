import SwiftUI
import WebKit

struct CrownKeepWebView: UIViewRepresentable {
    final class Coordinator {
        let schemeHandler = CrownKeepBundleSchemeHandler()
        let nativeAIController = CrownKeepNativeAIController()
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.setURLSchemeHandler(
            context.coordinator.schemeHandler,
            forURLScheme: "crownkeep"
        )

        let userContentController = WKUserContentController()
        userContentController.addUserScript(
            WKUserScript(
                source: CrownKeepNativeAIController.injectedBridgeScript,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
        )
        userContentController.add(
            context.coordinator.nativeAIController,
            name: CrownKeepNativeAIController.messageHandlerName
        )
        configuration.userContentController = userContentController

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.03, green: 0.08, blue: 0.07, alpha: 1)
        webView.scrollView.backgroundColor = webView.backgroundColor
        webView.allowsBackForwardNavigationGestures = false

        if #available(iOS 16.4, *) {
            webView.isInspectable = true
        }

        context.coordinator.nativeAIController.webView = webView

        if let url = URL(string: "crownkeep://app/index.html") {
            webView.load(URLRequest(url: url))
        }

        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
