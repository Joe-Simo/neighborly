import UIKit
import WebKit
import CoreText
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
/// room is whole, so the app never shows a half-drawn room. It follows the wait
/// rule: after 400ms one still line, "Opening…", sits under the k; at ten seconds
/// it says the wait is longer than usual and offers one "Try again", which starts
/// a fresh load. There is no ceiling that lifts the sheet early. A load that fails
/// outright ends on the no-connection page, which Capacitor loads from
/// `server.errorPath`.
final class ShellViewController: CAPBridgeViewController {
    private let paper = UIColor(red: 0.9608, green: 0.9529, blue: 0.9255, alpha: 1)
    private var cover: UIView?
    private var statusStrip: UIView?
    /// The top bar's paper, and the lighter paper of the sign-in sheet.
    private let barPaper = UIColor(red: 0.9686, green: 0.9569, blue: 0.9294, alpha: 1)
    private let sheetPaper = UIColor(red: 0.9843, green: 0.9804, blue: 0.9647, alpha: 1)
    /// True while the page shown is the way in (`.entry`).
    private var onSignIn = false
    private let refresh = UIRefreshControl()
    /// The one still line under the k, and the one act once the wait is long.
    private var waitLine: UILabel?
    private var tryAgain: UIButton?
    private var lineTimer: Timer?
    private var firstScreenWatch: Timer?
    private var loading: NSKeyValueObservation?
    private var slowTimer: Timer?

    /// Seconds before the wait counts as long. `-slowAfter 1` on the launch
    /// command shortens it so the long wait can be checked in a simulator.
    private var patience: TimeInterval {
        let asked = UserDefaults.standard.double(forKey: "slowAfter")
        return asked > 0 ? asked : 10
    }
    /// The wait's words, in the device's language: Spanish or English.
    private var spanish: Bool { Locale.preferredLanguages.first?.hasPrefix("es") == true }

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
        // The page can tell it is inside the app: `:root[data-shell="ios"]`,
        // set before its first paint. The way in leaves its own status strip
        // out under that mark, and says here when it is the page shown, so the
        // app's strip holds the status area for as long as it is. The door's
        // sweep (`data-door="sweeping"`) counts as having left: its colour
        // covers the status area as one sheet, so the strip is gone at once.
        scripts.addUserScript(WKUserScript(
            source: "document.documentElement.dataset.shell = 'ios';",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        scripts.addUserScript(WKUserScript(
            source: """
            (() => {
              let shown = null;
              const tell = () => {
                const now = !!document.querySelector(".entry") && document.documentElement.dataset.door !== "sweeping";
                if (now === shown) return;
                shown = now;
                window.webkit.messageHandlers.kindHelpsSignIn.postMessage(now);
              };
              new MutationObserver(tell).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-door"] });
              tell();
            })();
            """,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true
        ))
        scripts.add(SignInShown { [weak self] shown in self?.signIn(shown: shown) }, name: "kindHelpsSignIn")
        // A save the page makes is felt here: it says "saved" or "decided" (use-save.ts). Nothing else is felt.
        scripts.add(Felt { [weak self] what in self?.tap(for: what) }, name: "kindHelpsFelt")
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
        refresh.tintColor = UIColor(red: 0.157, green: 0.235, blue: 0.196, alpha: 1)
        refresh.addTarget(self, action: #selector(pulled), for: .valueChanged)
        // Capacitor turns bouncing off; without it a page cannot be pulled down to refresh.
        webView.scrollView.bounces = true
        webView.scrollView.refreshControl = refresh
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
        let keyboard = NotificationCenter.default
        keyboard.addObserver(self, selector: #selector(keyboardComing), name: UIResponder.keyboardWillShowNotification, object: nil)
        keyboard.addObserver(self, selector: #selector(keyboardGoing), name: UIResponder.keyboardWillHideNotification, object: nil)
        keyboard.addObserver(self, selector: #selector(keyboardGone), name: UIResponder.keyboardDidHideNotification, object: nil)
    }

    @objc private func pulled() {
        // Under the launch cover or the slow page there is nothing to refresh yet.
        guard let webView, cover == nil, !onSignIn else { return refresh.endRefreshing() }
        webView.callAsyncJavaScript("return typeof window.kindHelpsPulled === 'function' && (await window.kindHelpsPulled()) === true", arguments: [:], in: nil, in: .page) { [weak self] result in
            guard let self else { return }
            self.refresh.endRefreshing()
            if case .success(let current) = result, current as? Bool == true {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                return
            }
            webView.reload()
        }
    }

    private func tap(for what: String) {
        guard cover == nil else { return }
        if what == "decided" { UINotificationFeedbackGenerator().notificationOccurred(.success) }
        else if what == "saved" { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
    }

    override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        statusStrip?.frame.size.height = view.safeAreaInsets.top
    }

    private func layStrip(_ colour: UIColor) {
        guard statusStrip == nil else { return }
        let strip = UIView(frame: CGRect(x: 0, y: 0, width: view.bounds.width, height: view.safeAreaInsets.top))
        strip.backgroundColor = colour
        strip.autoresizingMask = [.flexibleWidth]
        strip.isUserInteractionEnabled = false
        if let cover { view.insertSubview(strip, belowSubview: cover) } else { view.addSubview(strip) }
        statusStrip = strip
    }

    /// On the way in the strip is there from the first frame, so nothing has
    /// to arrive when the keyboard does. Leaving for a room, it is gone in the
    /// same frame, out of the way of the door's sweep: a room draws its own
    /// bar there at rest.
    private func signIn(shown: Bool) {
        guard shown != onSignIn else { return }
        onSignIn = shown
        webView?.scrollView.refreshControl = shown ? nil : refresh
        if shown {
            statusStrip?.removeFromSuperview()
            statusStrip = nil
            layStrip(barPaper)
        } else {
            statusStrip?.removeFromSuperview()
            statusStrip = nil
        }
    }

    /// On a phone the keyboard slides the sign-in sheet up under the clock, so
    /// the strip turns to the sheet's paper in step with the keyboard and
    /// turns back as it leaves. On an iPad the sheet stays clear of the clock.
    private func tintStrip(_ colour: UIColor, with note: Notification) {
        guard onSignIn, view.bounds.width < 700 else { return }
        let time = note.userInfo?[UIResponder.keyboardAnimationDurationUserInfoKey] as? TimeInterval ?? 0.25
        UIView.animate(withDuration: time) { self.statusStrip?.backgroundColor = colour }
    }

    /// While the keyboard slides, iOS moves the page under the clock for a few
    /// frames before the page's own top bar can follow. In a room, a strip of
    /// the bar's paper covers the status area for as long as the keyboard is up.
    /// Not over a sheet: there the page behind is dimmed, and the strip would glare.
    @objc private func keyboardComing(_ note: Notification) {
        guard !onSignIn else { return tintStrip(sheetPaper, with: note) }
        guard statusStrip == nil, view.safeAreaInsets.top > 0, let webView else { return }
        webView.evaluateJavaScript("!!document.querySelector('.live-header') && !document.querySelector('[role=dialog], dialog[open]')") { [weak self] result, _ in
            guard let self, result as? Bool == true, !self.onSignIn else { return }
            self.layStrip(self.barPaper)
        }
    }

    @objc private func keyboardGoing(_ note: Notification) {
        tintStrip(barPaper, with: note)
    }

    @objc private func keyboardGone() {
        guard !onSignIn else { return }
        lift([statusStrip])
        statusStrip = nil
    }

    /// Asks the page whether its first screen is whole. A room says so itself
    /// with `.live-app[data-room-in]`, set once its sheet has arrived and its
    /// head picture is in. Sign-in and the other screens without a room are
    /// whole as soon as the waiting screen (`.paper-loading`) is gone.
    private static let firstScreenWhole = """
        !document.querySelector('.paper-loading') && document.fonts.status === 'loaded' && \
        (!!document.querySelector('.live-app[data-room-in]') || \
        (!!document.querySelector('.live-app') && !document.querySelector('.live-room, .live-header')))
        """

    /// The first screen is often whole well before the last picture has arrived
    /// and the page counts as loaded. So the page is asked ten times a second,
    /// and the cover lifts the moment it says yes.
    ///
    /// The asking runs on its own clock, not from each answer: an answer that never comes (the page was replaced
    /// while it was being asked, as when the first page takes over from the blank one) must not end the watch.
    private func watchForFirstScreen() {
        firstScreenWatch?.invalidate()
        firstScreenWatch = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] watch in
            guard let self, self.cover != nil, let webView = self.webView else { return watch.invalidate() }
            webView.evaluateJavaScript(Self.firstScreenWhole) { [weak self] result, _ in
                if result as? Bool == true { self?.reveal(whileLoading: true) }
            }
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
        lineTimer?.invalidate()
        lineTimer = Timer.scheduledTimer(withTimeInterval: 0.4, repeats: false) { [weak self] _ in self?.sayOpening() }
        slowTimer = Timer.scheduledTimer(withTimeInterval: patience, repeats: false) { [weak self] _ in self?.sayLongWait() }
    }

    /// The site's text face, Source Sans 3 (OFL), from the font file the app already carries for its own pages
    /// (public/fonts). The system's face stands in only if the file cannot be read.
    private static let sourceSans: CTFontDescriptor? = {
        guard let file = Bundle.main.url(forResource: "source-sans-3-latin-variable", withExtension: "woff2", subdirectory: "public/fonts"),
              let data = try? Data(contentsOf: file),
              let faces = CTFontManagerCreateFontDescriptorsFromData(data as CFData) as? [CTFontDescriptor]
        else { return nil }
        return faces.first
    }()

    private static func textFace(_ size: CGFloat, weight: CGFloat = 400) -> UIFont {
        guard let face = sourceSans else { return UIFont.systemFont(ofSize: size, weight: weight > 500 ? .semibold : .regular) }
        // The file is a variable font: its weight is chosen on the 'wght' axis.
        let wght = NSNumber(value: 0x7767_6874)
        let weighted = CTFontDescriptorCreateCopyWithAttributes(face, [kCTFontVariationAttribute: [wght: weight]] as CFDictionary)
        return CTFontCreateWithFontDescriptor(weighted, size, nil) as UIFont
    }

    /// After 400ms: one still line under the k. It does not move, pulse or count.
    private func sayOpening() {
        guard let cover else { return }
        tryAgain?.removeFromSuperview()
        tryAgain = nil
        let line = waitLine ?? {
            let line = UILabel()
            line.translatesAutoresizingMaskIntoConstraints = false
            line.font = UIFontMetrics(forTextStyle: .body).scaledFont(for: Self.textFace(17))
            line.adjustsFontForContentSizeCategory = true
            line.textColor = UIColor(red: 0.408, green: 0.443, blue: 0.373, alpha: 1)
            line.textAlignment = .center
            line.numberOfLines = 0
            cover.addSubview(line)
            NSLayoutConstraint.activate([
                line.centerXAnchor.constraint(equalTo: cover.centerXAnchor),
                line.topAnchor.constraint(equalTo: cover.centerYAnchor, constant: 64),
                line.widthAnchor.constraint(lessThanOrEqualTo: cover.widthAnchor, constant: -64),
            ])
            waitLine = line
            return line
        }()
        line.text = spanish ? "Abriendo…" : "Opening…"
        UIAccessibility.post(notification: .announcement, argument: line.text)
    }

    /// At ten seconds: the line says the wait is long, and one act, "Try again", in ochre, starts a fresh load.
    private func sayLongWait() {
        guard let cover, let webView, webView.isLoading else { return }
        sayOpening()
        guard let line = waitLine else { return }
        line.text = spanish ? "Esto está tardando más de lo normal." : "This is taking longer than usual."
        var look = UIButton.Configuration.plain()
        look.title = spanish ? "Intentar de nuevo" : "Try again"
        look.baseForegroundColor = UIColor(red: 0.553, green: 0.388, blue: 0.106, alpha: 1)
        look.contentInsets = NSDirectionalEdgeInsets(top: 12, leading: 16, bottom: 12, trailing: 16)
        look.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { words in
            var words = words
            words.font = UIFontMetrics(forTextStyle: .body).scaledFont(for: Self.textFace(17, weight: 600))
            words.underlineStyle = .single
            return words
        }
        let act = UIButton(configuration: look, primaryAction: UIAction { [weak self] _ in self?.loadAfresh() })
        act.translatesAutoresizingMaskIntoConstraints = false
        cover.addSubview(act)
        NSLayoutConstraint.activate([
            act.centerXAnchor.constraint(equalTo: cover.centerXAnchor),
            act.topAnchor.constraint(equalTo: line.bottomAnchor, constant: 12),
            act.heightAnchor.constraint(greaterThanOrEqualToConstant: 44),
        ])
        tryAgain = act
        UIAccessibility.post(notification: .layoutChanged, argument: line)
    }

    /// The page counts as loaded before its first screen is whole. The cover
    /// stays for up to four seconds more, then lifts whatever the page says. The
    /// no-connection page cannot answer and is shown at once.
    private func revealIfLoaded(waited: TimeInterval = 0) {
        guard let webView, !webView.isLoading else { return }
        guard cover != nil, waited < 4 else { reveal(); return }
        webView.evaluateJavaScript("!!document.querySelector('.live-app') && !(\(Self.firstScreenWhole))") { [weak self] result, _ in
            guard result as? Bool == true else { self?.reveal(); return }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { self?.revealIfLoaded(waited: waited + 0.1) }
        }
    }

    private func reveal(whileLoading: Bool = false) {
        guard let webView, whileLoading || !webView.isLoading, cover != nil else { return }
        slowTimer?.invalidate()
        lineTimer?.invalidate()
        firstScreenWatch?.invalidate()
        lift([cover])
        cover = nil
        waitLine = nil
        tryAgain = nil
    }

    /// The cover leaves as the site's opening does: a sheet of paper lifted up off the page, whole from the first
    /// frame, its knife-cut edge (the site's) casting a shadow on the room beneath until it is gone. Nothing fades. With Reduce Motion
    /// it is one cut.
    private func lift(_ layers: [UIView?]) {
        let layers = layers.compactMap { $0 }
        guard !UIAccessibility.isReduceMotionEnabled else { return layers.forEach { $0.removeFromSuperview() } }
        var shades: [UIView] = []
        for sheet in layers {
            // The sheet runs on below the screen by the depth of its cut, as the site's does, so the cut is never seen
            // until the sheet moves: a strip of the same paper hangs under it, and the mask is the site's knife cut.
            let wide = sheet.bounds.width, tall = sheet.bounds.height
            let edge = min(120, max(52, wide * 0.075))
            let strip = UIView(frame: CGRect(x: 0, y: tall, width: wide, height: edge))
            strip.backgroundColor = sheet.backgroundColor ?? paper
            sheet.addSubview(strip)
            sheet.clipsToBounds = false
            let cut = Self.knifeCut(wide: wide, tall: tall, edge: edge)
            let mask = CAShapeLayer()
            mask.path = cut.cgPath
            sheet.layer.mask = mask
            // The shadow follows the cut, laid on the room under the sheet's edge.
            let shade = UIView(frame: sheet.frame)
            shade.isUserInteractionEnabled = false
            shade.layer.shadowPath = cut.cgPath
            shade.layer.shadowColor = UIColor(red: 0.18, green: 0.141, blue: 0.086, alpha: 1).cgColor
            shade.layer.shadowOpacity = 0.42
            shade.layer.shadowRadius = 9
            shade.layer.shadowOffset = CGSize(width: 0, height: 6)
            sheet.superview?.insertSubview(shade, belowSubview: sheet)
            shades.append(shade)
        }
        let away = UIViewPropertyAnimator(
            duration: 0.6,
            timingParameters: UICubicTimingParameters(controlPoint1: CGPoint(x: 0.3, y: 0.6), controlPoint2: CGPoint(x: 0.25, y: 1))
        )
        away.addAnimations {
            for sheet in layers + shades { sheet.transform = CGAffineTransform(translationX: 0, y: -(sheet.bounds.height + 140)) }
        }
        away.addCompletion { _ in (layers + shades).forEach { $0.removeFromSuperview() } }
        away.startAnimation()
    }

    /// The site's knife cut (cut-edges.css, viewBox 1000×60): the sheet is whole down to a wavy edge in its last
    /// `edge` points, below `tall`.
    private static func knifeCut(wide: CGFloat, tall: CGFloat, edge: CGFloat) -> UIBezierPath {
        let at = { (x: CGFloat, y: CGFloat) in CGPoint(x: x / 1000 * wide, y: tall + y / 60 * edge) }
        let cut = UIBezierPath()
        cut.move(to: CGPoint(x: 0, y: 0))
        cut.addLine(to: at(0, 30))
        cut.addCurve(to: at(560, 26), controlPoint1: at(200, 18), controlPoint2: at(380, 38))
        cut.addCurve(to: at(1000, 34), controlPoint1: at(740, 14), controlPoint2: at(860, 20))
        cut.addLine(to: CGPoint(x: wide, y: 0))
        cut.close()
        return cut
    }

    private func loadAfresh() {
        guard cover != nil, let webView, let bridge else { return }
        webView.stopLoading()
        webView.load(URLRequest(url: bridge.config.appStartServerURL))
        startSlowTimer()
        watchForFirstScreen()
    }
}

/// Hears from the page when the way in is shown, and when it is left.
private final class Felt: NSObject, WKScriptMessageHandler {
    private let felt: (String) -> Void
    init(felt: @escaping (String) -> Void) { self.felt = felt }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if let what = message.body as? String { felt(what) }
    }
}

private final class SignInShown: NSObject, WKScriptMessageHandler {
    private let changed: (Bool) -> Void

    init(changed: @escaping (Bool) -> Void) {
        self.changed = changed
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        changed(message.body as? Bool == true)
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
