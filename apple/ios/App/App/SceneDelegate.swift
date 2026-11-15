import UIKit
import WebKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
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
/// arrives. A load that fails outright ends on the no-connection page, which
/// Capacitor loads from `server.errorPath`.
final class ShellViewController: CAPBridgeViewController {
    private let paper = UIColor(red: 0.9608, green: 0.9529, blue: 0.9255, alpha: 1)
    private var cover: UIView?
    private var slowPage: WKWebView?
    private var slowPageEvents: SlowPageEvents?
    private var loading: NSKeyValueObservation?
    private var slowTimer: Timer?

    /// Seconds to wait for the first page. `-slowAfter 1` on the launch
    /// command shortens it so the slow page can be checked in a simulator.
    private var patience: TimeInterval {
        let asked = UserDefaults.standard.double(forKey: "slowAfter")
        return asked > 0 ? asked : 12
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        guard let webView else { return }
        clearTopEdge(of: webView)
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

    private func revealIfLoaded() {
        guard let webView, !webView.isLoading else { return }
        slowTimer?.invalidate()
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
        clearTopEdge(of: slow)
        slow.alpha = 0
        let events = SlowPageEvents(
            shown: { [weak self] in
                UIView.animate(withDuration: 0.3) { self?.slowPage?.alpha = 1 }
            },
            tryAgain: { [weak self] in self?.waitAgain() }
        )
        slow.navigationDelegate = events
        slowPageEvents = events
        slowPage = slow
        place(slow)
        slow.loadFileURL(page, allowingReadAccessTo: page.deletingLastPathComponent())
    }

    /// The first load is still running underneath, so "Try again" goes back to
    /// the k and gives it another wait. Starting a second load here would
    /// cancel the first, which Capacitor reads as a failure.
    private func waitAgain() {
        lift([slowPage])
        slowPage = nil
        slowPageEvents = nil
        startSlowTimer()
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
