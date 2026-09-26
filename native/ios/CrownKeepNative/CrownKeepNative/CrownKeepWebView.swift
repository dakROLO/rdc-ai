import SwiftUI
import WebKit

struct CrownKeepWebView: UIViewRepresentable {
    final class Coordinator: NSObject, WKUIDelegate {
        let schemeHandler = CrownKeepBundleSchemeHandler()
        let nativeAIController = CrownKeepNativeAIController()

        func webView(
            _ webView: WKWebView,
            runJavaScriptAlertPanelWithMessage message: String,
            initiatedByFrame frame: WKFrameInfo,
            completionHandler: @escaping () -> Void
        ) {
            let alert = UIAlertController(
                title: "CrownKeep",
                message: message,
                preferredStyle: .alert
            )
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
                completionHandler()
            })
            present(alert, from: webView, fallback: completionHandler)
        }

        func webView(
            _ webView: WKWebView,
            runJavaScriptConfirmPanelWithMessage message: String,
            initiatedByFrame frame: WKFrameInfo,
            completionHandler: @escaping (Bool) -> Void
        ) {
            let alert = UIAlertController(
                title: "CrownKeep",
                message: message,
                preferredStyle: .alert
            )
            alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in
                completionHandler(false)
            })
            alert.addAction(UIAlertAction(title: "Confirm", style: .default) { _ in
                completionHandler(true)
            })
            present(alert, from: webView) {
                completionHandler(false)
            }
        }

        func webView(
            _ webView: WKWebView,
            runJavaScriptTextInputPanelWithPrompt prompt: String,
            defaultText: String?,
            initiatedByFrame frame: WKFrameInfo,
            completionHandler: @escaping (String?) -> Void
        ) {
            let alert = UIAlertController(
                title: "CrownKeep",
                message: prompt,
                preferredStyle: .alert
            )
            alert.addTextField { textField in
                textField.text = defaultText
                textField.clearButtonMode = .whileEditing
                textField.autocorrectionType = .yes
                textField.returnKeyType = .done
            }
            alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in
                completionHandler(nil)
            })
            alert.addAction(UIAlertAction(title: "Save", style: .default) { _ in
                completionHandler(alert.textFields?.first?.text)
            })
            present(alert, from: webView) {
                completionHandler(nil)
            }
        }

        private func present(
            _ alert: UIAlertController,
            from webView: WKWebView,
            fallback: @escaping () -> Void
        ) {
            guard let presenter = topPresenter(from: webView) else {
                fallback()
                return
            }
            presenter.present(alert, animated: true)
        }

        private func topPresenter(from webView: WKWebView) -> UIViewController? {
            var presenter = webView.window?.rootViewController

            while let presented = presenter?.presentedViewController {
                presenter = presented
            }

            return presenter
        }
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
        webView.uiDelegate = context.coordinator
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
