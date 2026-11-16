import UIKit
import WebKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        // The app keeps its paper colours when the device is set to dark:
        // status bar, keyboard and system sheets included.
        window?.overrideUserInterfaceStyle = .light
        window?.rootViewController = ShellViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

/// Keeps the launch view (paper, the small k) over the web view until the
/// first page has loaded, so the app never shows blank paper. If the page has
/// not arrived after twelve seconds it shows the "taking a while" page instead,
/// while the same load carries on underneath, and fades to the page when it
/// arrives. Thirty seconds after that the load is stopped and the page offers
/// "Try again", which starts a fresh one. A load that fails outright ends on
/// the no-connection page, which Capacitor loads from `server.errorPath`.
final class ShellViewController: CAPBridgeViewController {
    private let paper = UIColor(red: 0.9608, green: 0.9529, blue: 0.9255, alpha: 1)
    private var cover: UIView?
    private var slowPage: WKWebView?
    private var slowPageEvents: SlowPageEvents?
    private var loading: NSKeyValueObservation?
    private var slowTimer: Timer?
    private var stopTimer: Timer?
    /// True once the slow load has been stopped and the person is offered "Try again".
    private var stopped = false

    /// Seconds to wait for the first page. `-slowAfter 1` on the launch
    /// command shortens it so the slow page can be checked in a simulator.
    private var patience: TimeInterval {
        let asked = UserDefaults.standard.double(forKey: "slowAfter")
        return asked > 0 ? asked : 12
    }

    /// A web view ignores the page's own print command, so the shell answers
    /// it: `window.print()` asks here, and iOS shows its print sheet for the page.
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        guard let scripts = webView?.configuration.userContentController else { return }
        scripts.addUserScript(WKUserScript(
            source: "window.print = () => window.webkit.messageHandlers.kindHelpsPrint.postMessage(null);",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        scripts.add(PrintRequests { [weak self] in self?.printPage() }, name: "kindHelpsPrint")
        // In the app a long press brings up no web callout, a tap leaves no
        // grey flash, and a button's words are not selected by accident.
        // Giving stays on the web: the App Store does not allow it in an
        // app, so the link to give is not shown here on any page.
        scripts.addUserScript(WKUserScript(
            source: """
            const appFeel = document.createElement("style");
            appFeel.textContent = "*{-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}a,button,summary,label,nav,[role=button],[role=tab],[role=menuitem]{-webkit-user-select:none;user-select:none}a[href*='github.com/sponsors']{display:none!important}";
            document.documentElement.appendChild(appFeel);
            """,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true
        ))
    }

    private func printPage() {
        guard let webView else { return }
        let info = UIPrintInfo.printInfo()
        info.outputType = .general
        info.jobName = webView.title ?? "Kind Helps"
        let printer = UIPrintInteractionController.shared
        printer.printInfo = info
        printer.printFormatter = webView.viewPrintFormatter()
        printer.present(animated: true)
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        guard let webView else { return }
        clearTopEdge(of: webView)
        webView.allowsLinkPreview = false
        // A swipe from the left edge goes back, as in any app: from Privacy to sign-in, from a record to its list.
        webView.allowsBackForwardNavigationGestures = true
        // Paper, not white or black, when a page is pulled past its end.
        webView.underPageBackgroundColor = paper
        webView.scrollView.backgroundColor = paper
        if let launch = UIStoryboard(name: "LaunchScreen", bundle: nil).instantiateInitialViewController()?.view {
            place(launch)
            cover = launch
        }
        loading = webView.observe(\.isLoading, options: [.new]) { [weak self] _, change in
            guard change.newValue == false else { return }
            // A failed load is followed at once by the no-connection page, so
            // look again a moment later before lifting the cover.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { self?.revealIfLoaded() }
        }
        startSlowTimer()
        watchForFirstScreen()
    }

    /// The first real screen is often ready well before the last picture has
    /// arrived and the page counts as loaded. So the page is asked ten times a
    /// second whether it is past its skeleton, and the cover lifts the moment it is.
    private func watchForFirstScreen() {
        guard cover != nil, !stopped, let webView else { return }
        let ready = "!!document.querySelector('.live-app') && !document.querySelector('.paper-loading') && document.fonts.status === 'loaded'"
        webView.evaluateJavaScript(ready) { [weak self] result, _ in
            if result as? Bool == true { self?.reveal(whileLoading: true); return }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { self?.watchForFirstScreen() }
        }
    }

    private func place(_ layer: UIView) {
        guard let webView else { return }
        layer.frame = webView.bounds
        layer.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.addSubview(layer)
    }

    /// iOS lays a blurred strip under the status bar on scrolling content. The
    /// painting runs clean to the top edge, so the strip is switched off.
    private func clearTopEdge(of webView: WKWebView) {
        if #available(iOS 26.0, *) {
            webView.scrollView.topEdgeEffect.isHidden = true
        }
    }

    private func startSlowTimer() {
        slowTimer?.invalidate()
        slowTimer = Timer.scheduledTimer(withTimeInterval: patience, repeats: false) { [weak self] _ in
            self?.showSlowPage()
        }
    }

    /// The page counts as loaded while it still shows its own "checking your
    /// session" skeleton. The cover stays over that for up to four seconds, so
    /// the launch goes from the k straight to the first real screen.
    private func revealIfLoaded(waited: TimeInterval = 0) {
        guard let webView, !webView.isLoading, !stopped else { return }
        guard cover == nil || waited >= 4 else {
            webView.evaluateJavaScript("!!document.querySelector('.paper-loading')") { [weak self] result, _ in
                guard result as? Bool == true else { self?.reveal(); return }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { self?.revealIfLoaded(waited: waited + 0.1) }
            }
            return
        }
        reveal()
    }

    private func reveal(whileLoading: Bool = false) {
        guard let webView, whileLoading || !webView.isLoading, !stopped, cover != nil || slowPage != nil else { return }
        slowTimer?.invalidate()
        stopTimer?.invalidate()
        lift([cover, slowPage])
        cover = nil
        slowPage = nil
        slowPageEvents = nil
    }

    private func lift(_ layers: [UIView?]) {
        let layers = layers.compactMap { $0 }
        UIView.animate(withDuration: 0.3, animations: {
            layers.forEach { $0.alpha = 0 }
        }, completion: { _ in
            layers.forEach { $0.removeFromSuperview() }
        })
    }

    private func showSlowPage() {
        guard slowPage == nil, cover != nil, let webView, webView.isLoading,
              let page = Bundle.main.url(forResource: "slow", withExtension: "html", subdirectory: "public")
        else { return }
        let slow = WKWebView(frame: .zero)
        slow.isOpaque = false
        slow.backgroundColor = paper
        slow.scrollView.backgroundColor = paper
        slow.scrollView.contentInsetAdjustmentBehavior = .never
        // The scroll bar flashes when a scroll view first appears; this page does not scroll.
        slow.scrollView.showsVerticalScrollIndicator = false
        slow.scrollView.showsHorizontalScrollIndicator = false
        clearTopEdge(of: slow)
        slow.alpha = 0
        let events = SlowPageEvents(
            shown: { [weak self] in
                UIView.animate(withDuration: 0.3) { self?.slowPage?.alpha = 1 }
                self?.startStopTimer()
            },
            tryAgain: { [weak self] in self?.loadAfresh() }
        )
        slow.navigationDelegate = events
        slowPageEvents = events
        slowPage = slow
        place(slow)
        slow.loadFileURL(page, allowingReadAccessTo: page.deletingLastPathComponent())
    }

    private func startStopTimer() {
        stopTimer?.invalidate()
        stopTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: false) { [weak self] _ in
            self?.stopWaiting()
        }
    }

    /// Stopping the load makes Capacitor put the no-connection page in the web
    /// view underneath; `stopped` keeps the slow page on top of it, now with a
    /// "Try again" that does start a load.
    private func stopWaiting() {
        guard let webView, webView.isLoading, slowPage != nil else { return }
        stopped = true
        webView.stopLoading()
        slowPage?.evaluateJavaScript("document.body.classList.add('stopped')")
    }

    private func loadAfresh() {
        guard stopped, let webView, let bridge else { return }
        stopped = false
        slowPage?.evaluateJavaScript("document.body.classList.remove('stopped')")
        webView.load(URLRequest(url: bridge.config.appStartServerURL))
        startStopTimer()
    }
}

/// Listens to the slow page: when it has drawn, and when "Try again" is tapped.
private final class SlowPageEvents: NSObject, WKNavigationDelegate {
    private let shown: () -> Void
    private let tryAgain: () -> Void

    init(shown: @escaping () -> Void, tryAgain: @escaping () -> Void) {
        self.shown = shown
        self.tryAgain = tryAgain
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        shown()
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard navigationAction.navigationType == .linkActivated else { return decisionHandler(.allow) }
        decisionHandler(.cancel)
        tryAgain()
    }
}

/// Passes the page's print request to the shell.
private final class PrintRequests: NSObject, WKScriptMessageHandler {
    private let asked: () -> Void

    init(asked: @escaping () -> Void) {
        self.asked = asked
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        asked()
    }
}
