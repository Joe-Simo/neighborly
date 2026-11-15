# The iPhone and iPad app

A Capacitor shell that opens the signed-in side of the site, `https://kindhelps.com/app`, full screen. It has its own packages and nothing in the web build reads this folder.

## Build

```sh
cd apple
bun install
bunx cap sync ios
bun run open        # opens the Xcode project
```

Unsigned simulator build from the repo root:

```sh
xcodebuild -project apple/ios/App/App.xcodeproj -scheme App -sdk iphonesimulator \
  -configuration Debug -derivedDataPath apple/ios/DerivedData CODE_SIGNING_ALLOWED=NO build
```

## Things to know

- **The first build can hang with no error.** `xcodebuild` waits on a macOS keychain lookup for a github.com credential while it fetches Capacitor's two public framework zips. Allow or deny the keychain prompt once and it continues.
- **Load only `https://kindhelps.com/app`.** Sign-in keys work on that address alone, and the session lives in cookies in the web view's default data store. Do not point the shell at a preview address.
- **`web/offline.html`** is the page the shell shows when the site cannot be reached (`server.errorPath`). It carries its own copies of two fonts and the painting, because it must work with no network.
- **`ios/App/App/public/` and the copy of `capacitor.config.json` beside it are generated** by `cap sync` and are not committed.
- Signing, archives and anything sent to Apple are done by the account owner in Xcode.

## While the first page loads

`ShellViewController` (in `ios/App/App/SceneDelegate.swift`) keeps the launch
view, paper with the small k, over the web view until the first page has
loaded, then fades it away. After twelve seconds without the page it shows
`web/slow.html` ("This is taking a while.") while the same load carries on
underneath. A load that fails outright ends on `web/offline.html`. Both pages
share `web/shell.css`.

To see the slow page in a simulator, shorten the wait on the launch command:
`xcrun simctl launch booted com.kindhelps.app -slowAfter 0.3`.

The simulator draws the launch screen only for a signed app. For a test build,
pass `CODE_SIGN_IDENTITY=-` ("Sign to Run Locally") on the build command; it
uses no Apple account and is not a project setting.
