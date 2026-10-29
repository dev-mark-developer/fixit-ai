import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import FirebaseCore

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  // Owned by SceneDelegate; mirrored here because some native libraries
  // (RNFB messaging) still read `UIApplication.shared.delegate.window`.
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?
  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Firebase must be configured before React Native starts, or the messaging
    // module has no default app to attach to.
    //
    // Guarded on the plist existing: FirebaseApp.configure() raises a fatal
    // error when GoogleService-Info.plist is missing, and that file can only
    // come from the Firebase console. This way the app still launches without
    // it and push activates as soon as it's added to the Xcode project.
    // See docs/PUSH_NOTIFICATIONS.md.
    if FirebaseApp.app() == nil,
       Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil {
      FirebaseApp.configure()
    }

    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    self.launchOptions = launchOptions

    // The window is created in SceneDelegate: apps built with the iOS 27 SDK
    // must adopt the UIScene lifecycle, or UIKit refuses to launch them.
    return true
  }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let factory = appDelegate.reactNativeFactory else { return }

    let window = WindowControlsAwareWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window

    factory.startReactNative(
      withModuleName: "Fixit",
      in: window,
      launchOptions: appDelegate.launchOptions
    )
  }
}

// On iPadOS 26+ the app can run in a resizable window whose close/minimize/
// zoom controls sit over the top-left corner. Plain safe-area insets don't
// account for them (the top inset is often 0 there, with no status bar), so
// React Native headers rendered under the controls. This pushes the root
// view's safe area down by however much UIKit says is needed to clear them,
// which every SafeAreaView / useSafeAreaInsets consumer picks up for free.
class WindowControlsAwareWindow: UIWindow {
  override func layoutSubviews() {
    super.layoutSubviews()
    updateWindowControlsInset()
  }

  private func updateWindowControlsInset() {
    guard #available(iOS 26.0, *), let root = rootViewController else { return }
    // Measured on the window, not the root view: the window's own safe area
    // isn't affected by the root's additionalSafeAreaInsets, so this can't loop.
    let cleared = edgeInsets(for: .safeArea(cornerAdaptation: .vertical)).top
    let extra = max(0, cleared - safeAreaInsets.top)
    if root.additionalSafeAreaInsets.top != extra {
      root.additionalSafeAreaInsets.top = extra
    }
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
