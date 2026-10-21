import UIKit
import WebKit

final class TouchlineViewController: UIViewController, WKScriptMessageHandlerWithReply, WKScriptMessageHandler, WKNavigationDelegate {
    private let audio = DuckingAudio()
    private var webView: WKWebView!
    private var wantsAwake = false
    private let loadError = UIStackView()
    private var observers: [NSObjectProtocol] = []
    private var webRoot: URL { Bundle.main.resourceURL!.appendingPathComponent("Web", isDirectory: true) }

    override func viewDidLoad() {
        super.viewDidLoad()
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.userContentController.addUserScript(WKUserScript(source: """
            window.addEventListener('error', event => {
              window.webkit.messageHandlers.touchlineHost.postMessage({diagnostic: String(event.message || 'Resource load error')});
            });
            window.addEventListener('unhandledrejection', event => {
              window.webkit.messageHandlers.touchlineHost.postMessage({diagnostic: String(event.reason)});
            });
            """, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        configuration.userContentController.addScriptMessageHandler(self, contentWorld: .page, name: "touchlineAudio")
        configuration.userContentController.add(self, name: "touchlineHost")
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.isInspectable = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isOpaque = false
        view.backgroundColor = UIColor(red: 0.957, green: 0.953, blue: 0.922, alpha: 1)
        webView.backgroundColor = view.backgroundColor
        view.addSubview(webView)
        webView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor), webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor), webView.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])
        print("Touchline: bundled page exists: \(FileManager.default.fileExists(atPath: webRoot.appendingPathComponent("index.html").path))")
        loadPage()
        for name in [UIApplication.willResignActiveNotification, UIApplication.didBecomeActiveNotification] {
            observers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                guard let self else { return }
                let active = UIApplication.shared.applicationState == .active
                UIApplication.shared.isIdleTimerDisabled = active && self.wantsAwake
                if !active { self.audio.stop() }
            })
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        guard message.frameInfo.isMainFrame, isBundledURL(message.frameInfo.request.url),
              let command = message.body as? [String: Any] else { replyHandler(nil, "Invalid audio request"); return }
        do { replyHandler(try audio.handle(command), nil) }
        catch { replyHandler(nil, error.localizedDescription) }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, isBundledURL(message.frameInfo.request.url),
              let command = message.body as? [String: Any] else { return }
        if let diagnostic = command["diagnostic"] as? String { print("Touchline page error: \(diagnostic)"); return }
        guard let keepAwake = command["keepAwake"] as? Bool else { return }
        wantsAwake = keepAwake
        UIApplication.shared.isIdleTimerDisabled = keepAwake && UIApplication.shared.applicationState == .active
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        let allowed = isBundledURL(url)
        print("Touchline navigation: bundled=\(allowed), original-path-match=\(url.standardizedFileURL.path.hasPrefix(webRoot.path + "/"))")
        if allowed { decisionHandler(.allow); return }
        decisionHandler(.cancel)
        if action.navigationType == .linkActivated, ["https", "http"].contains(url.scheme ?? "") { UIApplication.shared.open(url) }
    }

    // iPadOS may present the same container as /var/... or /private/var/....
    // Compare resolved paths rather than cancelling the initial local navigation.
    private func isBundledURL(_ url: URL?) -> Bool {
        guard let url, url.isFileURL else { return false }
        let root = webRoot.resolvingSymlinksInPath().standardizedFileURL.path
        let path = url.resolvingSymlinksInPath().standardizedFileURL.path
        return path.hasPrefix(root + "/")
    }

    @objc private func loadPage() {
        loadError.removeFromSuperview()
        webView.loadFileURL(webRoot.appendingPathComponent("index.html"), allowingReadAccessTo: webRoot)
    }

    private func showLoadError(_ error: Error?) {
        print("Touchline load failed: \(error?.localizedDescription ?? "Web content process stopped")")
        guard loadError.superview == nil else { return }
        loadError.axis = .vertical; loadError.spacing = 18; loadError.alignment = .center
        loadError.backgroundColor = view.backgroundColor
        loadError.isLayoutMarginsRelativeArrangement = true
        loadError.layoutMargins = UIEdgeInsets(top: 28, left: 28, bottom: 28, right: 28)
        if loadError.arrangedSubviews.isEmpty {
            let label = UILabel(); label.text = "Touchline couldn’t open. Please try again."; label.numberOfLines = 0; label.textAlignment = .center
            let retry = UIButton(type: .system); retry.setTitle("Try again", for: .normal); retry.addTarget(self, action: #selector(loadPage), for: .touchUpInside)
            retry.heightAnchor.constraint(greaterThanOrEqualToConstant: 48).isActive = true
            loadError.addArrangedSubview(label); loadError.addArrangedSubview(retry)
        }
        view.addSubview(loadError); loadError.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([loadError.centerXAnchor.constraint(equalTo: view.centerXAnchor), loadError.centerYAnchor.constraint(equalTo: view.centerYAnchor), loadError.widthAnchor.constraint(lessThanOrEqualTo: view.widthAnchor, constant: -40)])
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { showLoadError(error) }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { showLoadError(error) }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { showLoadError(nil) }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        webView.evaluateJavaScript("JSON.stringify({ready:document.readyState,teams:document.querySelectorAll('[data-teams]').length,visible:document.querySelector('#setup')?.hidden === false})") { result, error in
            print("Touchline page loaded: \(result ?? "unavailable") \(error?.localizedDescription ?? "")")
        }
    }

    deinit { observers.forEach(NotificationCenter.default.removeObserver) }
}
