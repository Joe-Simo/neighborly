import UIKit
import WebKit
import WidgetKit
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
        // Opened from a Home Screen quick action: the app opens straight into that room.
        ShellViewController.launchRoom = QuickRoom.room(for: connectionOptions.shortcutItem) ?? Self.widgetRoom(connectionOptions.urlContexts.first?.url)
        // From iOS 18 the system's tab bar and sidebar stand in for the page's; before it, the page keeps its own.
        if #available(iOS 18.0, *) { window?.rootViewController = ShellTabs() } else { window?.rootViewController = ShellViewController() }
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        // The Home Screen widget's own link (`kindhelps://help-line`): the room is opened as a link to it would be.
        if let room = Self.widgetRoom(URLContexts.first?.url), let shell = Self.shell(in: window?.rootViewController) {
            shell.open(room: room)
            return
        }
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }

    /// A quick action while the app is already open: the room is opened as a link to it would be, with its page turn.
    func windowScene(_ windowScene: UIWindowScene, performActionFor shortcutItem: UIApplicationShortcutItem, completionHandler: @escaping (Bool) -> Void) {
        guard let room = QuickRoom.room(for: shortcutItem), let shell = Self.shell(in: window?.rootViewController) else { return completionHandler(false) }
        shell.open(room: room)
        completionHandler(true)
    }

    /// A room the app's own link names (`kindhelps://<room>`), only one of the rooms the Home Screen offers.
    private static func widgetRoom(_ url: URL?) -> String? {
        guard let url, url.scheme == "kindhelps", let room = url.host, QuickRoom.rooms.contains(where: { $0.room == room }) else { return nil }
        return room
    }

    private static func shell(in root: UIViewController?) -> ShellViewController? {
        if #available(iOS 18.0, *), let tabs = root as? ShellTabs { return tabs.shell }
        return root as? ShellViewController
    }
}

/// The Home Screen quick actions: three rooms, named in the device's language, with the system's own symbols.
enum QuickRoom {
    static let rooms: [(type: String, room: String, title: (NativeWords) -> String, symbol: String)] = [
        ("com.kindhelps.app.week", "week", \.quickWeek, "calendar"),
        ("com.kindhelps.app.help-line", "help-line", \.quickHelpLine, "phone"),
        ("com.kindhelps.app.visits", "visits", \.quickVisit, "shoeprints.fill"),
    ]

    static func room(for item: UIApplicationShortcutItem?) -> String? {
        guard let item else { return nil }
        return rooms.first { $0.type == item.type }?.room
    }

    static func offer() {
        let words = NativeWords.current
        UIApplication.shared.shortcutItems = rooms.map {
            UIApplicationShortcutItem(type: $0.type, localizedTitle: $0.title(words), localizedSubtitle: nil, icon: UIApplicationShortcutIcon(systemImageName: $0.symbol), userInfo: nil)
        }
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
    /// The room a quick action opened the app into, read once as the first page is chosen.
    static var launchRoom: String?

    override func instanceDescriptor() -> InstanceDescriptor {
        let descriptor = super.instanceDescriptor()
        if let room = Self.launchRoom, let server = descriptor.serverURL, var parts = URLComponents(string: server) {
            parts.path = "/app/\(room)"
            descriptor.serverURL = parts.string
        }
        Self.launchRoom = nil
        return descriptor
    }

    /// Opens a room in the page already open, as its link in the bar would.
    func open(room: String) {
        webView?.evaluateJavaScript("(() => { const a = document.createElement('a'); a.href = '/app/\(room)'; document.body.append(a); a.click(); a.remove(); })()")
    }

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
            // The app draws the system's tab bar, and on iPad its sidebar, in place of the page's (`:root[data-native-tabs]`, `:root[data-native-sidebar]`, ShellTabs).
            source: "document.documentElement.dataset.shell = 'ios';\(nativeBars)",
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
        // What the page asks to be felt: a committed page turn (room-sheet.tsx), a decision going through and a
        // refused save (use-save.ts). See tap(for:).
        scripts.add(Felt { [weak self] what in self?.tap(for: what) }, name: "kindHelpsFelt")
        // A kept room opened with no connection asks to be opened again once the connection returns (live-app.tsx).
        scripts.add(ReloadRequest { [weak self] in self?.reloadUnderStill() }, name: "kindHelpsReload")
        // The page says the moment its first screen is whole, so the launch cover lifts in that frame's turn instead
        // of at the next of the watch's tenth-of-a-second looks (on average 50 ms sooner). The same test as the watch's
        // (firstScreenWhole), asked again whenever the marks it reads change and when the fonts arrive; the watch stays
        // as the fallback. It says so once per page.
        scripts.addUserScript(WKUserScript(
            source: """
            (() => {
              let said = false;
              const look = () => {
                if (said || !document.documentElement || !(\(Self.firstScreenWhole))) return;
                said = true;
                watch.disconnect();
                window.webkit.messageHandlers.kindHelpsWhole.postMessage(null);
              };
              const watch = new MutationObserver(look);
              watch.observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "data-room-in"] });
              document.fonts.addEventListener("loadingdone", look);
              document.fonts.ready.then(look);
            })();
            """,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        scripts.add(ReloadRequest { [weak self] in
            guard let self, self.cover != nil else { return }
            self.reveal(whileLoading: true)
        }, name: "kindHelpsWhole")
        // At the accessibility text sizes the bar's words stay small; held, a tab shows its name large, as any iOS
        // tab bar does. The page says where its tabs are (shell.tsx); iOS turns the viewer on only at those sizes.
        scripts.add(BarTabs { [weak self] state in self?.barChanged?(state) }, name: "kindHelpsBar")
        scripts.add(UndoSlips { [weak self] label in self?.undoSlip(label) }, name: "kindHelpsUndo")
        // A row's long-press actions are the system's context menu (the page's paper sheet only on the website).
        scripts.add(MenuRequests(named: { [weak self] row, actions, kinds in self?.rowMenuRow = row; self?.menuActions = actions; self?.menuKinds = kinds }), name: "kindHelpsMenu")
        // The first screen of the last room, kept on the device (KeptRoom) so the next launch draws it at once while
        // the session and the live data catch up. It is handed to the page before its scripts run; a page that has
        // let it go since (a sign-out, then a reload) says so in its session, and is not handed it again.
        if let kept = KeptRoom.read() {
            scripts.addUserScript(WKUserScript(source: "try { if (!sessionStorage.getItem('kind-helps:kept-gone')) window.kindHelpsKept = \(kept); } catch {}", injectionTime: .atDocumentStart, forMainFrameOnly: true))
            // The help line's, only beside the week's (the page uses it only when they are the same member's).
            if let help = KeptRoom.read(.helpLine) {
                scripts.addUserScript(WKUserScript(source: "try { if (!sessionStorage.getItem('kind-helps:kept-gone')) window.kindHelpsKeptHelpLine = \(help); } catch {}", injectionTime: .atDocumentStart, forMainFrameOnly: true))
            }
        }
        scripts.add(KeptRoomRequests(host: bridge?.config.serverURL.host), name: "kindHelpsKeep")
        // In a room the page takes the left edge itself: its step back is the page turn the finger holds
        // (room-sheet.tsx, useEdgeTurn). Anywhere else, a record or the way in, the app's own swipe back is the step back.
        scripts.add(EdgeOwner { [weak self] pageOwns in self?.webView?.allowsBackForwardNavigationGestures = !pageOwns }, name: "kindHelpsEdge")
        // In the app a long press brings up no web callout, a tap leaves no
        // grey flash, a button's words are not selected by accident, and what is
        // pressed answers from touch-down.
        // Giving stays on the web: the App Store does not allow it in an
        // app, so the link to give is not shown here on any page.
        scripts.addUserScript(WKUserScript(
            source: """
            const appFeel = document.createElement("style");
            appFeel.textContent = "*{-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}a,button,summary,label,nav,[role=button],[role=tab],[role=menuitem]{-webkit-user-select:none;user-select:none}a[href*='github.com/sponsors']{display:none!important}";
            document.documentElement.appendChild(appFeel);
            // A touch listener makes WebKit hold :active from touch-down, so what is pressed answers at once.
            document.addEventListener("touchstart", () => {}, { passive: true });
            """,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true
        ))
    }

    /// The page's print command opens the system's share sheet with the page as it prints (its print styles, on
    /// US Letter) as a PDF named for it, so it can be printed, saved to Files, mailed or sent; Print is one of the
    /// sheet's own actions.
    private func printPage() {
        guard let webView else { return }
        let name = (webView.title ?? "Kind Helps").replacingOccurrences(of: "/", with: "-")
        let pages = UIPrintPageRenderer()
        pages.addPrintFormatter(webView.viewPrintFormatter(), startingAtPageAt: 0)
        let paper = CGRect(x: 0, y: 0, width: 612, height: 792)
        pages.setValue(paper, forKey: "paperRect")
        pages.setValue(paper.insetBy(dx: 36, dy: 36), forKey: "printableRect")
        let pdf = NSMutableData()
        UIGraphicsBeginPDFContextToData(pdf, paper, nil)
        pages.prepare(forDrawingPages: NSRange(location: 0, length: pages.numberOfPages))
        for page in 0..<pages.numberOfPages {
            UIGraphicsBeginPDFPage()
            pages.drawPage(at: page, in: UIGraphicsGetPDFContextBounds())
        }
        UIGraphicsEndPDFContext()
        let file = FileManager.default.temporaryDirectory.appendingPathComponent("\(name).pdf")
        guard (try? pdf.write(to: file, options: .atomic)) != nil else { return }
        let sheet = UIActivityViewController(activityItems: [file], applicationActivities: nil)
        sheet.popoverPresentationController?.sourceView = view
        sheet.popoverPresentationController?.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 0, height: 0)
        sheet.popoverPresentationController?.permittedArrowDirections = []
        present(sheet, animated: true)
    }

    /// Under iOS 18 the page keeps its own bar and side menu; from it, the system's stand in (ShellTabs).
    private var nativeBars: String {
        guard #available(iOS 18.0, *) else { return "" }
        return " document.documentElement.dataset.nativeTabs = '';" + (UIDevice.current.userInterfaceIdiom == .pad ? " document.documentElement.dataset.nativeSidebar = '';" : "")
    }

    /// A row's long-press actions as the system's context menu (Liquid Glass): as a finger comes down on a row, the
    /// page names the row's place and its actions in its own words; if the finger stays, the system lifts the row as
    /// its preview and shows them, and the one chosen runs on the page (`window.kindHelpsMenuChose(index)`).
    fileprivate var rowMenuRow: CGRect = .zero
    fileprivate var menuActions: [String] = []
    fileprivate var menuKinds: [String] = []
    fileprivate var lifted: UIView?

    fileprivate func chose(_ index: Int) {
        webView?.evaluateJavaScript("window.kindHelpsMenuChose?.(\(index))")
    }

    /// The page's undo slip: while it shows, the same undo is the system's own, so Shake to Undo (and an iPad's
    /// keyboard Command-Z) runs the inverse the slip's Undo runs. Its showing is felt as one light tap.
    override var canBecomeFirstResponder: Bool { true }

    fileprivate func undoSlip(_ label: String?) {
        undoManager?.removeAllActions(withTarget: self)
        guard let label else { return }
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        becomeFirstResponder()
        undoManager?.registerUndo(withTarget: self) { shell in
            shell.webView?.evaluateJavaScript("window.kindHelpsUndo?.()")
        }
        undoManager?.setActionName(label)
    }

    /// Told whenever the page's bar, its rooms, or what lies over them change (ShellTabs follows it).
    var barChanged: ((BarState) -> Void)?

    /// Presses the page's own link to a room, or its Menu, so a change of room is still the page's turn.
    func press(room: String) {
        let js = room == "menu"
            ? "document.querySelector('.live-tab-bar button.live-tab')?.click()"
            : "document.querySelector('.live-tab-bar a[href=\"/app/\(room)\"], .live-nav a[href=\"/app/\(room)\"]')?.click()"
        webView?.evaluateJavaScript(js)
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        guard let webView else { return }
        clearTopEdge(of: webView)
        webView.allowsLinkPreview = false
        webView.addInteraction(UIContextMenuInteraction(delegate: self))
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

    /// Only what is real is felt, and iOS's own System Haptics setting turns all of it off: a page turn that commits
    /// (`turned`, soft), a decision whose corner lays green (`decided`, light), a save the server refused
    /// (`refused`, the system's warning), and a row's long-press sheet opening (`selected`, the selection tap).
    /// Anything else the page says is not felt.
    private func tap(for what: String) {
        guard cover == nil else { return }
        switch what {
        case "turned": UIImpactFeedbackGenerator(style: .soft).impactOccurred()
        case "decided", "creased": UIImpactFeedbackGenerator(style: .light).impactOccurred()
        case "refused": UINotificationFeedbackGenerator().notificationOccurred(.warning)
        case "selected": UISelectionFeedbackGenerator().selectionChanged()
        default: break
        }
    }

    /// The launch cover is the room's own head: the bar's paper with the wordmark where the room draws it
    /// (LaunchScreen.storyboard). The cover lies in the web view, whose safe area comes and goes while it is laid, so
    /// its head is held from the cover's own top by the window's safe area instead. A wide iPad, laid out as a desk
    /// (landscape), draws its head with the wordmark at the edge and a little larger; the cover follows it there, so
    /// the wordmark does not move when the cover lifts.
    private var coverHead: [NSLayoutConstraint] = []

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        guard let cover, let mark = cover.viewWithTag(7), let bar = cover.subviews.first(where: { $0 !== mark }) else { return }
        let desk = view.bounds.width >= 1024
        let top = max(view.window?.safeAreaInsets.top ?? 0, view.safeAreaInsets.top)
        if coverHead.isEmpty {
            // The storyboard's own ties to the safe area are let go, and the cover's top holds the head instead.
            cover.constraints.filter { ["wrd-top-005", "bar-bot-004"].contains($0.identifier) }.forEach { $0.isActive = false }
            coverHead = [mark.topAnchor.constraint(equalTo: cover.topAnchor), bar.bottomAnchor.constraint(equalTo: cover.topAnchor)]
            NSLayoutConstraint.activate(coverHead)
        }
        coverHead[0].constant = top + (desk ? 22 : 14)
        coverHead[1].constant = top + (desk ? 81 : 60)
        for constraint in cover.constraints + mark.constraints {
            switch constraint.identifier {
            case "wrd-min-008": constraint.constant = desk ? 33 : 19
            case "wrd-mid-009": constraint.constant = desk ? 33 - view.bounds.width / 2 : -341
            case "wrd-wid-006": constraint.constant = desk ? 137 : 120
            case "wrd-hei-007": constraint.constant = desk ? 37 : 32
            default: break
            }
        }
    }

    /// The page is opened again under a still picture of itself: the picture stays until the page says its first screen
    /// is whole again (the same kept room, drawn at once), and goes in one frame, so no white or half-drawn page is seen.
    /// It goes after eight seconds at the most, whatever the page says.
    private func reloadUnderStill() {
        guard let webView, let still = webView.snapshotView(afterScreenUpdates: false) else { webView?.reload(); return }
        still.frame = webView.bounds
        still.isUserInteractionEnabled = false
        webView.addSubview(still)
        webView.reload()
        let began = Date()
        Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self, weak webView] watch in
            guard let webView, Date().timeIntervalSince(began) < 8 else { watch.invalidate(); still.removeFromSuperview(); return }
            // Asked of the new page only: one opened since the reload began, not the one it replaces.
            let since = Int(Date().timeIntervalSince(began) * 1000) + 300
            webView.evaluateJavaScript("(\(Self.firstScreenWhole)) && performance.now() < \(since)") { result, _ in
                guard result as? Bool == true, still.superview != nil else { return }
                watch.invalidate()
                still.removeFromSuperview()
                _ = self
            }
        }
    }

    override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        statusStrip?.frame.size.height = view.safeAreaInsets.top
        // The cover's head is set from the screen's safe area, which can arrive after the first layout.
        view.setNeedsLayout()
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
        line.text = NativeWords.current.opening
        UIAccessibility.post(notification: .announcement, argument: line.text)
    }

    /// At ten seconds: the line says the wait is long, and one act, "Try again", in ochre, starts a fresh load.
    private func sayLongWait() {
        guard let cover, let webView, webView.isLoading else { return }
        sayOpening()
        guard let line = waitLine else { return }
        line.text = NativeWords.current.slow
        var look = UIButton.Configuration.plain()
        look.title = NativeWords.current.tryAgain
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
        holdHead()
        lift([cover])
        cover = nil
        waitLine = nil
        tryAgain = nil
    }

    /// The cover's head (the bar's paper and the wordmark) stays where it is while the sheet under it is lifted away:
    /// the room's own head lies beneath, the same in every pixel, so the wordmark never moves. It goes once the sheet
    /// has gone.
    private func holdHead() {
        guard let cover, let bar = cover.subviews.first(where: { $0.tag != 7 }) else { return }
        let head = CGRect(x: 0, y: 0, width: cover.bounds.width, height: bar.frame.maxY)
        guard let still = cover.resizableSnapshotView(from: head, afterScreenUpdates: false, withCapInsets: .zero) else { return }
        still.frame = cover.convert(head, to: cover.superview)
        still.isUserInteractionEnabled = false
        cover.superview?.insertSubview(still, aboveSubview: cover)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.65) { still.removeFromSuperview() }
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
extension ShellViewController: UIContextMenuInteractionDelegate {
    func contextMenuInteraction(_ interaction: UIContextMenuInteraction, configurationForMenuAtLocation location: CGPoint) -> UIContextMenuConfiguration? {
        guard !menuActions.isEmpty, rowMenuRow.contains(location) else { return nil }
        let actions = zip(menuActions, menuKinds + Array(repeating: "", count: max(0, menuActions.count - menuKinds.count)))
        return UIContextMenuConfiguration(identifier: "row" as NSString, previewProvider: nil) { _ in
            UIMenu(children: actions.enumerated().map { index, action in
                UIAction(title: action.0, image: UIImage(systemName: Self.symbol(forAction: action.1))) { [weak self] _ in self?.chose(index) }
            })
        }
    }

    /// The system's marks for the row's actions: call, open, and the room's own.
    private static func symbol(forAction kind: String) -> String {
        switch kind {
        case "call": "phone"
        case "open": "arrow.up.right"
        default: "checkmark"
        }
    }

    /// The row itself lifts: a picture of the whole row on its own paper, laid exactly over it, so the page stays in
    /// place under the dim. It is drawn once the press is the system's and the page has let go of the touch, so the
    /// row is at rest, not in its pressed tint.
    private func rowPreview() -> UITargetedPreview? {
        guard let webView, let first = webView.resizableSnapshotView(from: rowMenuRow, afterScreenUpdates: true, withCapInsets: .zero) else { return nil }
        lifted?.removeFromSuperview()
        let picture = UIView(frame: rowMenuRow)
        first.frame = picture.bounds
        picture.addSubview(first)
        webView.addSubview(picture)
        lifted = picture
        // The page lets go of the press a moment after the system takes it: the row is drawn again then, at rest.
        let row = rowMenuRow
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { [weak self, weak picture] in
            guard let picture, let rest = self?.webView?.resizableSnapshotView(from: row, afterScreenUpdates: true, withCapInsets: .zero) else { return }
            rest.frame = picture.bounds
            picture.subviews.forEach { $0.removeFromSuperview() }
            picture.addSubview(rest)
        }
        let shape = UIPreviewParameters()
        shape.backgroundColor = UIColor(red: 0xfb / 255, green: 0xfa / 255, blue: 0xf5 / 255, alpha: 1)
        shape.visiblePath = UIBezierPath(roundedRect: picture.bounds, cornerRadius: 4)
        return UITargetedPreview(view: picture, parameters: shape)
    }

    func contextMenuInteraction(_ interaction: UIContextMenuInteraction, willEndFor configuration: UIContextMenuConfiguration, animator: (any UIContextMenuInteractionAnimating)?) {
        let picture = lifted
        lifted = nil
        if let animator { animator.addCompletion { picture?.removeFromSuperview() } } else { picture?.removeFromSuperview() }
    }

    func contextMenuInteraction(_ interaction: UIContextMenuInteraction, configuration: UIContextMenuConfiguration, highlightPreviewForItemWithIdentifier identifier: any NSCopying) -> UITargetedPreview? {
        rowPreview()
    }

    /// Before iOS 16 the system asks for the lifted row this way.
    func contextMenuInteraction(_ interaction: UIContextMenuInteraction, previewForHighlightingMenuWithConfiguration configuration: UIContextMenuConfiguration) -> UITargetedPreview? {
        if #available(iOS 16.0, *) { return nil }
        return rowPreview()
    }
}

/// The page's undo slip: `{ label }` while it shows, `null` when it goes.
private final class UndoSlips: NSObject, WKScriptMessageHandler {
    private let changed: (String?) -> Void
    init(changed: @escaping (String?) -> Void) { self.changed = changed }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame else { return }
        changed((message.body as? [String: Any])?["label"] as? String)
    }
}

/// The page names the row under a finger: `{ x, y, width, height, actions: [title], kinds: ["call" | "open" | "own"] }` in web view points, or no actions.
private final class MenuRequests: NSObject, WKScriptMessageHandler {
    private let named: (CGRect, [String], [String]) -> Void
    init(named: @escaping (CGRect, [String], [String]) -> Void) { self.named = named }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, let body = message.body as? [String: Any] else { return }
        let number = { (key: String) in body[key] as? Double ?? 0 }
        named(CGRect(x: number("x"), y: number("y"), width: number("width"), height: number("height")), body["actions"] as? [String] ?? [], body["kinds"] as? [String] ?? [])
    }
}

struct BarPlace: Equatable { let name: String; let room: String; let current: Bool }
struct BarState: Equatable { let covered: Bool; let tabs: [BarPlace]; let rooms: [BarPlace] }

/// The page tells its bar and rooms: `{ covered, tabs: [{ name, room, current }], rooms: [...] }`.
private final class BarTabs: NSObject, WKScriptMessageHandler {
    private let changed: (BarState) -> Void
    init(changed: @escaping (BarState) -> Void) { self.changed = changed }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, let body = message.body as? [String: Any] else { return }
        let places = { (key: String) in (body[key] as? [[String: Any]] ?? []).compactMap { place -> BarPlace? in
            guard let name = place["name"] as? String, let room = place["room"] as? String else { return nil }
            return BarPlace(name: name, room: room, current: place["current"] as? Bool ?? false)
        } }
        changed(BarState(covered: body["covered"] as? Bool ?? false, tabs: places("tabs"), rooms: places("rooms")))
    }
}

private final class ReloadRequest: NSObject, WKScriptMessageHandler {
    private let asked: () -> Void
    init(asked: @escaping () -> Void) { self.asked = asked }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame else { return }
        asked()
    }
}

private final class Felt: NSObject, WKScriptMessageHandler {
    private let felt: (String) -> Void
    init(felt: @escaping (String) -> Void) { self.felt = felt }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if let what = message.body as? String { felt(what) }
    }
}

/// The first screen of the room the member last saw: names, counts and row status only (the page chooses what is
/// in it, src/lib/kept-room.ts). One file in the app's own storage, protected so it cannot be read while the device
/// is locked; never in the web view's storage. It is let go at sign-out, when the member or conference changes, and
/// once it is a day old.
enum KeptRoom {
    private static let day: TimeInterval = 86_400
    /// This week's first screen, and the help line's (its callers' names and numbers): each the app's own file, with
    /// complete protection, gone after a day and on sign-out.
    enum Kind: String { case week = "kept-room.json", helpLine = "kept-help-line.json" }
    private static func file(_ kind: Kind) -> URL? {
        guard let support = try? FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true) else { return nil }
        return support.appendingPathComponent(kind.rawValue)
    }

    /// The kept room as JSON, if there is one under a day old; an older one is let go here.
    static func read(_ kind: Kind = .week) -> String? {
        guard let file = file(kind), let made = (try? FileManager.default.attributesOfItem(atPath: file.path))?[.modificationDate] as? Date else { return nil }
        guard Date().timeIntervalSince(made) < day, let text = try? String(contentsOf: file, encoding: .utf8),
              (try? JSONSerialization.jsonObject(with: Data(text.utf8))) is [String: Any] else {
            try? FileManager.default.removeItem(at: file)
            return nil
        }
        return text
    }

    /// The page's JSON: the help line's comes as `{ helpLine: {...} }`, the week's as the room itself.
    static func keep(_ json: String) {
        guard let object = (try? JSONSerialization.jsonObject(with: Data(json.utf8))) as? [String: Any] else { return }
        if let help = object["helpLine"] as? [String: Any] {
            guard let file = file(.helpLine), let data = try? JSONSerialization.data(withJSONObject: help) else { return }
            try? data.write(to: file, options: [.atomic, .completeFileProtection])
        } else {
            guard let file = file(.week) else { return }
            try? Data(json.utf8).write(to: file, options: [.atomic, .completeFileProtection])
            shareWeek(object)
        }
    }

    /// The week's counts for the Home Screen widget, when this person may see them (the kept room says so).
    private static func shareWeek(_ kept: [String: Any]) {
        let room = kept["room"] as? [String: Any]
        let note = room?["weekNote"] as? [String: Any]
        let count = { (key: String) in (note?[key] as? NSNumber)?.intValue ?? 0 }
        let figures = kept["allowed"] as? Bool == true && note != nil
            ? WeekFigures(callsWaiting: count("callsWaiting"), oldestWaitingDays: count("oldestWaitingDays"), visitsPlanned: count("visitsPlanned"),
                          requestsOpen: count("requestsOpen"), sample: (room?["church"] as? [String: Any])?["sample"] as? Bool == true)
            : nil
        guard figures != WeekFigures.read() else { return }
        WeekFigures.write(figures)
        WidgetCenter.shared.reloadAllTimelines()
    }

    /// Both are let go together: sign-out, or a room that is no longer this member's.
    static func forget() {
        for kind in [Kind.week, .helpLine] { if let file = file(kind) { try? FileManager.default.removeItem(at: file) } }
        // The widget's counts go with them.
        if WeekFigures.read() != nil {
            WeekFigures.write(nil)
            WidgetCenter.shared.reloadAllTimelines()
        }
    }
}

/// The page keeps its first screen (a JSON string) or lets it go (`null`). Only the app's own site is heard.
private final class KeptRoomRequests: NSObject, WKScriptMessageHandler {
    private let host: String?
    init(host: String?) { self.host = host }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, message.frameInfo.securityOrigin.host == host else { return }
        if let json = message.body as? String { KeptRoom.keep(json); return }
        // Let go (sign-out, or the room is another member's): the kept rooms, and the tab's own session storage, where
        // unsaved typing is kept (kh-typed), are wiped from the web view's store as well as by the page.
        KeptRoom.forget()
        let store = message.webView?.configuration.websiteDataStore
        store?.removeData(ofTypes: [WKWebsiteDataTypeSessionStorage], modifiedSince: .distantPast) {}
    }
}

/// The page says whether it takes the left edge's swipe itself (true in a room).
private final class EdgeOwner: NSObject, WKScriptMessageHandler {
    private let changed: (Bool) -> Void
    init(changed: @escaping (Bool) -> Void) { self.changed = changed }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame else { return }
        changed(message.body as? Bool == true)
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

/// The system's tab bar and, on iPad, its sidebar (Liquid Glass, `.tabSidebar`), standing in for the page's own bar and
/// side menu. There is one page: each tab's controller is an empty holder, and the shell (with its one web view) is
/// moved into the holder of the tab that is current, in the same frame, never reloaded. A tab pressed presses the
/// page's own link, so the change of room is the page's turn; the tab shown as current only ever follows the page.
/// The rooms in the sidebar are the page's own menu, as it lists them. VoiceOver, the large-name viewer, Reduce
/// Transparency and Increase Contrast are the system's; the one colour of its own is the selected item's ink green.
@available(iOS 18.0, *)
final class ShellTabs: UITabBarController, UITabBarControllerDelegate {
    let shell = ShellViewController()
    private var laid: BarState?
    private var sidebarName: String?

    private final class Holder: UIViewController {
        override func loadView() {
            view = UIView()
            view.backgroundColor = UIColor(red: 0xf5 / 255, green: 0xf3 / 255, blue: 0xec / 255, alpha: 1)
        }
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        delegate = self
        mode = .tabSidebar
        tabBar.tintColor = UIColor { $0.userInterfaceStyle == .dark ? UIColor(red: 0.62, green: 0.75, blue: 0.66, alpha: 1) : UIColor(red: 0x28 / 255, green: 0x3c / 255, blue: 0x32 / 255, alpha: 1) }
        view.tintColor = tabBar.tintColor
        // Until the page lists its tabs there is one holder, the page in it, and no bar or sidebar.
        tabs = [UITab(title: "", image: nil, identifier: "page") { _ in Holder() }]
        setTabBarHidden(true, animated: false)
        sidebar.isHidden = true
        shell.barChanged = { [weak self] state in self?.follow(state) }
        hold()
    }

    /// The marks of the page's own tabs and rooms, in the system's symbols.
    private static func symbol(for room: String) -> String {
        switch room {
        case "week": "calendar"
        case "team": "person.3"
        case "people": "person"
        case "commitments": "heart.circle"
        case "mine": "checkmark"
        case "time-off": "umbrella"
        case "tasks": "list.clipboard"
        case "help-line": "phone"
        case "neighbors": "house"
        case "visits": "shoeprints.fill"
        case "treasury": "building.columns"
        case "reports": "chart.bar"
        case "tools": "folder"
        default: "line.3.horizontal"
        }
    }

    private func follow(_ state: BarState) {
        let pad = traitCollection.userInterfaceIdiom == .pad
        let names = { (places: [BarPlace]) in places.map { "\($0.room)=\($0.name)" } }
        if laid.map({ names($0.tabs) != names(state.tabs) || names($0.rooms) != names(state.rooms) }) ?? true, !state.tabs.isEmpty {
            // On iPhone the bar's tabs. On iPad every room of the menu, in its order, then the Menu: the bar's rooms
            // are also kept in the tab bar the sidebar becomes when narrow, the rest in the sidebar alone.
            let barRooms = Set(state.tabs.map(\.room))
            let places = pad && !state.rooms.isEmpty ? state.rooms + state.tabs.filter { $0.room == "menu" } : state.tabs
            let next: [UITab] = places.map { place in
                let tab = UITab(title: place.name, image: UIImage(systemName: Self.symbol(for: place.room)), identifier: "tab:\(place.room)") { _ in Holder() }
                // Fixed where they are, so there is nothing to rearrange and no Edit.
                tab.preferredPlacement = barRooms.contains(place.room) ? .fixed : .sidebarOnly
                return tab
            }
            tabs = next
        }
        let before = laid
        laid = state
        // With the sidebar's rooms, the room itself is current (Treasury, say), not the bar's Menu that stands for it.
        let roomNow = pad ? state.rooms.first(where: \.current)?.room : nil
        let current = roomNow ?? state.tabs.first(where: \.current)?.room ?? state.rooms.first(where: \.current)?.room
        if let current, let tab = tab(forIdentifier: "tab:\(current)"), selectedTab !== tab {
            selectedTab = tab
        }
        hold()
        // Present or not, in one frame: the bar never shows half there.
        setTabBarHidden(state.tabs.isEmpty || state.covered, animated: false)
        // The sidebar is the person's to show or hide. Only with no rooms is it put away; and where it lies over the
        // room (an upright iPad) it is put away once a room is chosen from it, as a sidebar over content is.
        if !pad || state.rooms.isEmpty {
            sidebar.isHidden = true
        } else if before.map({ $0.rooms.isEmpty }) ?? true {
            // The rooms have just arrived: the sidebar opens beside the room where the window is wide enough for both.
            sidebar.isHidden = view.bounds.width < view.bounds.height
        } else if let before, before.rooms.first(where: \.current)?.room != state.rooms.first(where: \.current)?.room,
                  view.bounds.width < view.bounds.height {
            sidebar.isHidden = true
        }
        nameSidebar()
    }

    /// The sidebar's head names the conference, as the page's side menu does (its own line, read from the page).
    private func nameSidebar() {
        shell.webView?.evaluateJavaScript("document.querySelector('.live-nav .live-church-name')?.textContent?.trim() ?? ''") { [weak self] name, _ in
            guard let self, let name = name as? String, !name.isEmpty, name != self.sidebarName else { return }
            self.sidebarName = name
            var head = UIListContentConfiguration.header()
            head.text = name
            self.sidebar.headerContentConfiguration = head
        }
    }

    /// The page goes into the current tab's holder, in this frame: it is moved, never made again.
    private func hold() {
        guard let holder = selectedTab?.viewController ?? selectedViewController, shell.parent !== holder else { return }
        holder.loadViewIfNeeded()
        if shell.parent != nil {
            shell.willMove(toParent: nil)
            shell.view.removeFromSuperview()
            shell.removeFromParent()
        }
        holder.addChild(shell)
        shell.view.translatesAutoresizingMaskIntoConstraints = false
        holder.view.addSubview(shell.view)
        // Beside the sidebar on iPad, the room takes the width that is left; elsewhere, the whole screen.
        let leading = traitCollection.userInterfaceIdiom == .pad ? holder.view.safeAreaLayoutGuide.leadingAnchor : holder.view.leadingAnchor
        NSLayoutConstraint.activate([
            shell.view.leadingAnchor.constraint(equalTo: leading),
            shell.view.trailingAnchor.constraint(equalTo: holder.view.trailingAnchor),
            shell.view.topAnchor.constraint(equalTo: holder.view.topAnchor),
            shell.view.bottomAnchor.constraint(equalTo: holder.view.bottomAnchor),
        ])
        shell.didMove(toParent: holder)
    }

    func tabBarController(_ tabBarController: UITabBarController, shouldSelectTab tab: UITab) -> Bool {
        go(to: tab)
        return false
    }

    /// A tab chosen: its room, by the page's own link. The tab already open goes back to its top, as every tab does.
    private func go(to tab: UITab) {
        let id = tab.identifier
        guard let colon = id.firstIndex(of: ":") else { return }
        let room = String(id[id.index(after: colon)...])
        if tab === selectedTab, room != "menu", let scroll = shell.webView?.scrollView {
            scroll.setContentOffset(CGPoint(x: 0, y: -scroll.adjustedContentInset.top), animated: true)
            return
        }
        shell.press(room: room)
    }

    /// With a keyboard, Command and a number opens that room, in the order they stand (the iPad sidebar's, or the
    /// iPhone bar's), each named in the Command-held list by its own name, as an app's sections are.
    override var keyCommands: [UIKeyCommand]? {
        tabs.prefix(9).enumerated().map { index, tab in
            let command = UIKeyCommand(title: tab.title, action: #selector(goByKey(_:)), input: "\(index + 1)", modifierFlags: .command)
            command.discoverabilityTitle = tab.title
            return command
        }
    }

    @objc private func goByKey(_ command: UIKeyCommand) {
        guard let input = command.input, let number = Int(input), tabs.indices.contains(number - 1) else { return }
        go(to: tabs[number - 1])
    }
}
