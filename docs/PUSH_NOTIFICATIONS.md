# Push Notifications (Firebase Cloud Messaging)

Everything on the app side is wired. What's left needs a Firebase console and
an Apple developer account, so it can only be done by you.

**Until the two config files below are added, push is simply inert** — the app
builds and runs exactly as before, `getPushToken()` returns `null`, and the
login/register payloads carry `pushToken: null`. Nothing crashes and no build
breaks. The moment the files are dropped in and the app is rebuilt, everything
below activates on its own.

---

## 1. What you need to do

### Firebase console

> Both platforms now use the id **`com.fixit.mobileapp`**, but Firebase still
> needs **two separate apps** (one Android, one iOS) inside the same project —
> each platform gets its own config file.
>
> | Platform | Id | Where it's set |
> |---|---|---|
> | Android | `com.fixit.mobileapp` | `android/app/build.gradle` → `applicationId` (and `namespace`) |
> | iOS | `com.fixit.mobileapp` | Xcode → *Fixit* → Bundle Identifier |

1. Create (or open) a Firebase project at <https://console.firebase.google.com>.
2. ⬜ **Android — still to do.** Add an Android app with package name
   **`com.fixit.mobileapp`**, download **`google-services.json`**, and put it
   at **`android/app/google-services.json`**. Until then the Gradle plugin
   stays unapplied and Android push is inert.
3. ✅ **iOS — done.** `ios/Fixit/GoogleService-Info.plist` is present
   (`BUNDLE_ID` verified to match the Xcode bundle id) and has been registered
   in the *Fixit* target's **Copy Bundle Resources** phase.

   Note for next time: copying the plist into the folder is **not** enough —
   it has to be a member of the target, or the app can't find it at runtime
   and Firebase silently never initialises. Add it by dragging into the
   `Fixit` group in Xcode with "Copy items if needed" and the target ticked.

### Apple (iOS only — push does not work on the Simulator)
4. In the [Apple Developer portal](https://developer.apple.com/account/resources/authkeys/list),
   create an **APNs Auth Key** (`.p8`), and note the Key ID and Team ID.
5. Upload it in Firebase → Project settings → **Cloud Messaging** → *APNs
   Authentication Key*.
6. In Xcode → *Fixit* target → **Signing & Capabilities**, add:
   - **Push Notifications**
   - **Background Modes** → tick *Remote notifications*

### Rebuild
```bash
npm install
cd ios && pod install && cd ..
npx react-native run-ios      # and/or
npx react-native run-android
```
A JS reload is not enough — this adds native code.

---

## 2. What's already done

| Area | File |
|---|---|
| Libraries | `@react-native-firebase/app` + `/messaging` v26.3.0, `@notifee/react-native` v9.1.8 |
| Local notifications | `src/services/localNotifications.ts` |
| Android plugin | `android/build.gradle` (classpath) · `android/app/build.gradle` (applied **only if** `google-services.json` exists) |
| Android permission | `POST_NOTIFICATIONS` in `AndroidManifest.xml` |
| Android notification defaults | `firebase.json` at the repo root — **not** the manifest, see below |
| iOS init | `FirebaseApp.configure()` in `AppDelegate.swift`, guarded on the plist existing |
| iOS pods | `$RNFirebaseDisableSPM = true` in `ios/Podfile` — see note below |
| Core service | `src/services/pushNotifications.ts` |
| Backend sync | `src/api/auth.ts` → `POST /auth/heartbeat` |
| Background handler | `index.js` |
| Tap → deep link | `src/navigation/AppNavigator.tsx` |
| Permission prompt | `App.tsx`, once at launch |
| Login / register | token sent in the existing `pushToken` field |
| Logout | token deleted so the device stops receiving the old account's pushes |

Both native guards are deliberate: the google-services Gradle plugin
hard-fails a build without its JSON, and `FirebaseApp.configure()` raises a
fatal error without its plist. Guarding them is what keeps the app building
before step 1 is done.

### Android notification defaults go in `firebase.json`, not the manifest

react-native-firebase **already declares** the
`com.google.firebase.messaging.default_notification_channel_id` and
`…default_notification_color` meta-data in its own manifest, filled from
Gradle manifest placeholders. Declaring them again in
`android/app/src/main/AndroidManifest.xml` fails the merge:

```
Attribute meta-data#…default_notification_color@resource
value=(@color/notification_accent) … is also present at
[:react-native-firebase_messaging] value=(@color/white)
```

The supported way is a `firebase.json` at the repo root, which RNFB's Gradle
script reads and feeds into those placeholders:

```json
{
  "react-native": {
    "messaging_android_notification_channel_id": "fixit_default"
  }
}
```

### …but the colour is the exception, and must go in the manifest

`firebase.json` values are substituted into **react-native-firebase's own
manifest**, so a resource reference there is resolved against the *library's*
resources — and RNFB messaging bundles its own `colors.xml` of CSS colour
names (`white`, `crimson`, `hotpink`…). Naming an app colour breaks the
library's resource linking, and only on a **release** build:

```
AAPT: error: resource color/notification_accent
(aka io.invertase.firebase.messaging:color/notification_accent) not found
```

So the split is:

| Setting | Where | Why |
|---|---|---|
| `..._channel_id` | `firebase.json` | plain string, no resource lookup |
| `..._color` | `AndroidManifest.xml` with `tools:replace="android:resource"` | must resolve against **app** resources |

`tools:replace` is required because RNFB declares that meta-data itself
(defaulting to `@color/white`); the app's override wins at merge time while
the library keeps linking against its own default.

The other way to satisfy this is to pick a colour RNFB already bundles
(`@color/crimson` is nearest to our `#E8386D`) and keep it in `firebase.json`
— but that gives up the exact brand tint, so the manifest override wins.

The channel id is set to **`fixit_default`**, which notifee creates at launch
(`ensureNotificationChannel()` in `App.tsx`). Both halves are required —
Android silently drops a notification naming a channel that was never created,
so the id in `firebase.json` and the `createChannel` call must stay in sync.
`DEFAULT_CHANNEL_ID` in `src/services/localNotifications.ts` is the other end
of that pair.

---

## 3. How the token reaches the backend

There is no dedicated device-registration endpoint, so two existing ones carry
the token:

Permission is requested **once at app launch** (`App.tsx`), not at sign-in.
On iOS that ordering is load-bearing, not cosmetic: APNs registration only
completes after notifications are allowed, and `getToken()` fails until it has
— so asking at the login button meant the first sign-in always sent `null`.

1. **At sign-in** — `POST /auth/login` and `POST /auth/register` already accept
   a `pushToken` field, and the app already sent it (it was always `null`
   because the old `getPushToken()` was a stub). It now carries a real token.
2. **Any time after** — `POST /auth/heartbeat { deviceId, pushToken }`. This is
   the only endpoint that takes a token mid-session, so it's used for:
   - a re-sync right after login (catches a permission grant made during login),
   - FCM rotating the token (`onTokenRefresh` → `watchPushToken`).

`deviceId` is the stable per-install UUID from `src/utils/device.ts`, so the
backend can key tokens per device rather than per user.

---

## 4. Sending a test notification

Firebase console → **Messaging** → *Create your first campaign* → *Firebase
Notification messages*, then target the app.

To hit one device you need its token — it's **printed to Metro** on every
fetch, so just sign in and look for:

```
🔔 [Push] FCM token (163 chars):
fyz8k…
```

Other lines from the same logger tell you why there's no token:

| Line | Meaning |
|---|---|
| `no Firebase app — add the config file` | config file missing or not in the build |
| `APNs registration has not completed yet` | iOS hasn't got an APNs token — see below |
| `FCM returned an empty token` | no Play Services, or APNs not ready on iOS |
| `could not get an FCM token — …` | the SDK threw; message included |
| `token synced to backend for device …` | heartbeat accepted it |
| `token sync FAILED — …` | heartbeat rejected it |
| `FCM token refreshed …` | FCM rotated the token |

### `messaging/registration-timeout` on iOS

```
could not get an FCM token — [messaging/registration-timeout]
registerDeviceForRemoteMessages timed out waiting for APNs device registration
```

**Use a real device.** The iOS Simulator generally cannot complete APNs
registration, so no FCM token can ever be issued there — the same code that
times out in the Simulator works on hardware. Everything else (SignalR chat,
uploads, the rest of the app) still works in the Simulator; only push doesn't.

If it happens on a real device, work down this list:

1. Notifications were **allowed** when the launch prompt appeared.
   Re-check under Settings → Fixit → Notifications.
2. **Push Notifications** capability is on the *Fixit* target in Xcode.
3. An **APNs auth key** is uploaded in Firebase → Cloud Messaging.
4. `GoogleService-Info.plist`'s `BUNDLE_ID` matches the Xcode bundle id.

The app no longer calls `registerDeviceForRemoteMessages()` itself — RNFB
registers automatically, and driving it manually is what turned a
"no token yet" into a hard, blocking timeout.

All of it is behind `__DEV__`, so release builds print nothing. The token is
logged unmasked on purpose — that's what makes it copy-pasteable into the
console above — which is exactly why it must not ship in release.

For deep-linking into a chat, the payload needs these **data** keys:

```json
{
  "notification": { "title": "Jessica", "body": "Hey there" },
  "data": {
    "matchId": "15",
    "senderId": "143",
    "senderName": "Jessica"
  }
}
```

`matchId` + `senderId` opens that conversation. Anything else opens the
Notifications screen. FCM data values must be **strings**.

---

## 5. Note on the iOS Podfile

RNFB v26 resolves the Firebase SDK through **Swift Package Manager** by
default. Those SPM products are automatic (non-dynamic) libraries, so under
this project's static linkage every RNFB pod embeds its own copy of Firebase
and they collide as duplicate symbols — `pod install` refuses outright:

```
[!] [react-native-firebase] SPM + static linkage is not supported (target(s): Pods-Fixit).
```

RNFB offers two ways out. We took the second:

- ~~`use_frameworks! :linkage => :dynamic`~~ — would change linkage for
  *every* pod in the app (nitro-sound, reanimated, vector-icons, gesture
  handler …). Too large a blast radius for one dependency.
- **`$RNFirebaseDisableSPM = true`** — puts Firebase back on ordinary
  CocoaPods, which works with static linkage. One line, scoped to Firebase.

That surfaced a second, related problem: `FirebaseCoreInternal` is a Swift pod
that imports `GoogleUtilities`, which ships no module map — and Swift can't
import a module-less pod under static linking. Fixed with a targeted

```ruby
pod 'GoogleUtilities', :modular_headers => true
```

rather than a global `use_modular_headers!`, which would change header
generation for every dependency in the project.

Firebase 12.18.0 is newer than a stale local spec repo will have, so the first
install may need `pod install --repo-update`.

> ⏳ **This workaround has a shelf life.** CocoaPods emits:
> *"FirebaseCore has been deprecated in favor of the Firebase Apple SDK via
> Swift Package Manager … new versions will no longer be published to
> CocoaPods after October 2026."*
> That's the direction RNFB's SPM default is already moving in. Before then
> the app will need to migrate to SPM, which means adopting
> `use_frameworks! :linkage => :dynamic` and re-testing every other native
> module. Not urgent, but don't be surprised by it.

---

## 6. Local notifications

`src/services/localNotifications.ts` wraps notifee. It backs two things: the
app raising its own notifications, and making **foreground pushes visible at
all** — FCM draws nothing while the app is open, so each foreground message is
re-raised through here.

```ts
import {
  displayLocalNotification,
  scheduleLocalNotification,
  cancelLocalNotification,
  cancelAllLocalNotifications,
  getScheduledNotificationIds,
  clearNotificationBadge,
} from '../services/localNotifications';

// Now
await displayLocalNotification({
  title: 'Jessica sent you a message',
  body: 'Hey there',
  data: { matchId: '15', senderId: '143', senderName: 'Jessica' },
});

// Later — returns the id, keep it to cancel
const id = await scheduleLocalNotification(
  { title: 'Your match expires soon', body: 'Say hello before tomorrow' },
  new Date(Date.now() + 6 * 60 * 60 * 1000),
);
await cancelLocalNotification(id);
```

`data` uses the same keys as an FCM payload, so a local notification
deep-links exactly like a remote one — `matchId` + `senderId` opens that chat.

Scheduling uses an **inexact** trigger: Android may defer it by a few minutes
under Doze. Exact timing needs the `SCHEDULE_EXACT_ALARM` permission, which
Play treats as a sensitive permission and isn't worth it for reminders.

### Who draws what

This matters because getting it wrong shows the same notification twice:

| Message | App state | Drawn by |
|---|---|---|
| has `notification` | foreground | **notifee** (FCM draws nothing) |
| has `notification` | background / quit | **the OS**, automatically |
| data-only | foreground | **notifee** |
| data-only | background / quit | **notifee**, from the background handler |

So the background handler only draws data-only messages — a `notification`
payload has already been drawn by the system. Taps route the same either way:
notifee-drawn notifications report through notifee, OS-drawn ones through FCM,
and `onNotificationTap` subscribes to both.

---

## 7. Known gaps

- **No custom notification icon on Android.** It falls back to `ic_launcher`,
  which Android renders as a white square on some versions. A monochrome
  `ic_notification` drawable in `android/app/src/main/res/drawable-*` and a
  `smallIcon` change in `localNotifications.ts` would fix it.
- **`POST /auth/logout` is never called.** Logout deletes the FCM token
  locally, which stops delivery, but the backend keeps a stale row (gap #19).
