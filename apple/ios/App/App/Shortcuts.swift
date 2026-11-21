import AppIntents
import UIKit

/// Siri, Spotlight and the Shortcuts app: "Open This week" and "Log a call", each opening the app into the room as a
/// link to it would. Log a call then presses the help line's own "Log a call", as the n key does on the page, so the
/// same sheet opens and nothing is written without the person. Nothing here reads or keeps a neighbor's details.
@available(iOS 16.0, *)
struct OpenThisWeekIntent: AppIntent {
    static var title: LocalizedStringResource = "Open This week"
    static var openAppWhenRun = true
    @MainActor func perform() async throws -> some IntentResult {
        ShortcutRoom.go("week", press: false)
        return .result()
    }
}

@available(iOS 16.0, *)
struct LogACallIntent: AppIntent {
    static var title: LocalizedStringResource = "Log a call"
    static var openAppWhenRun = true
    @MainActor func perform() async throws -> some IntentResult {
        ShortcutRoom.go("help-line", press: true)
        return .result()
    }
}

@available(iOS 16.0, *)
struct KindHelpsShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: LogACallIntent(), phrases: ["Log a call in \(.applicationName)", "\(.applicationName) log a call"], shortTitle: "Log a call", systemImageName: "phone")
        AppShortcut(intent: OpenThisWeekIntent(), phrases: ["Open This week in \(.applicationName)", "\(.applicationName) this week"], shortTitle: "This week", systemImageName: "calendar")
    }
}

/// Takes the app to a room once the workspace is on screen, and optionally presses that room's head button. Signed
/// out, the sign-in sheet stays: the page sends a visitor without a session there, and the press finds no button.
@MainActor
enum ShortcutRoom {
    static func go(_ room: String, press: Bool) {
        let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
        guard let shell = SceneDelegate.shell(in: scene?.windows.first?.rootViewController) else {
            // Not drawn yet: the first page chosen is the room (the press waits for a later launch).
            ShellViewController.launchRoom = room
            return
        }
        Task { @MainActor in
            // Wait up to 20 seconds for the workspace, then go as a link to the room would.
            var ready = false
            for _ in 0..<40 {
                ready = (try? await shell.webView?.evaluateJavaScript("!!document.querySelector('.live-app')")) as? Bool ?? false
                if ready { break }
                try? await Task.sleep(nanoseconds: 500_000_000)
            }
            guard ready else { return }
            shell.open(room: room)
            guard press else { return }
            // The room's own head button, once the room is the one on screen and the button can be pressed.
            _ = try? await shell.webView?.evaluateJavaScript("""
                (() => { let tries = 0; const t = setInterval(() => {
                  const b = location.pathname === '/app/\(room)' && document.querySelector('#workspace-content .live-head-actions button:not(:disabled)');
                  if (b && !document.querySelector('[role=dialog][data-state=open]')) { clearInterval(t); b.click(); }
                  else if (++tries > 40) clearInterval(t);
                }, 250); })()
                """)
        }
    }
}
