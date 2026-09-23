# Memory Log

A running log of notes, decisions, and context shared between you and me while
doing UI work on **AIFixitMobileApp**. Newest entries at the top.

---

## 2026-09-21 (later) — Matches carry block flags both ways

- **The backend added `isBlockedByMe` and `hasBlockedMe` to each
  `GET /dating/matches` row** (gap #29, now 🟡 Partly done). Typed on
  `DatingMatch`; read through `matchBlockState(match, blockedIds)` in
  `utils/blockedUsers.ts`, which also counts the `GET /blocks` list so a fresh
  block shows before the matches reload.
- **Matches grid:** a blocked match is hidden either way (before, only people
  the user blocked).
- **Chats list:** blocked rows stay, dimmed, reading "You blocked this user"
  or — new — "This user is unavailable" when the other person blocked the
  user (worded so as not to say who blocked whom); no unread badge, and live
  hub messages no longer move or re-preview a blocked row.
- **Chat Detail:** the flags come from the matches row it already loads for
  the header photo. Blocked by the other side → composer replaced with
  "{name} is unavailable. You can no longer message them.", no Opening Move,
  no read receipts or presence either way.
- Tests: `matchBlockState` cases added to `__tests__/blockedUsers.test.ts`.
  Not verified against the live response (sp4 has no matches).
- **Still to confirm with the backend:** the hub refusing messages across a
  block, uploads refused, and no push for them — the part QA reopened the
  ticket for.

---

## 2026-09-21 (later) — iOS: denied camera still opened a black viewfinder

- **Reported by the user (iOS):** Chat › Take Photo with camera access denied
  left the camera open on black, and a blank photo could be taken and sent.
  Same symptom as the Android ticket fixed 2026-09-10; the code assumed the
  library checked permission on iOS.
- **Cause:** `react-native-image-picker` 8.2.1 (still the latest release)
  defines `-checkPermission:` in `ImagePickerManager.mm` but **never calls
  it** — `launchCamera` presents `UIImagePickerController` regardless, and
  iOS shows a denied camera as a black preview with a working shutter.
- **Fix:** a patch, `patches/react-native-image-picker+8.2.1.patch`: for the
  camera target it runs `checkPermission:` first (the system prompt appears
  there the first time) and returns the library's `permission` error on a
  refusal, which `DatingChatDetailScreen` already turns into "Permission
  needed → Open Settings". **New dev dependency `patch-package@^8.0.1`** and a
  `postinstall: patch-package` script so every install re-applies it. The
  patch is limited to that one file (a first attempt swept in the package's
  Android `build/` artifacts).
- **Verified:** `xcodebuild` Debug for the Simulator → BUILD SUCCEEDED, the
  patched file compiled cleanly. **Not verified on a device:** the library
  answers `camera_unavailable` on the Simulator before this code runs, so the
  camera path can only be tested on a real iPhone (native rebuild needed).
- Asana `1218322747575659` (the camera ticket): the Asana MCP timed out, so
  no comment was posted.

---

## 2026-09-21 (later) — Chat: "Record Video" removed

- **Asked by the user.** The chat attach sheet now offers **Photos & Videos**
  (library — existing videos can still be sent) and **Take Photo** only.
  `PickSource` lost `'video'`, and `pickFromCamera()` in
  `services/chatAttachments.ts` is photo-only (its `mediaType` parameter is
  gone).

---

## 2026-09-21 (later) — Blocked users: messages still getting through (reopened)

- **Asana `1218323256400930`** (fixed app-side 2026-09-09) was **reopened by
  QA on 2026-09-21**: the blocked user is now gone from Matches and the chat
  shows the blocked notice, but *the blocked person can still send messages,
  and the blocker still receives them and gets notifications.*
- **That part is server-side** (gap #29 (c)/(d)): the hub still accepts and
  delivers messages between a blocked pair, and the backend still pushes a
  notification for each. The blocked person's app can't know it is blocked.
- **App side, done now (the blocker's device):**
  - `utils/blockedUsers.ts` keeps a module-level copy of `GET /blocks`
    (`loadBlockedUsers` / `isBlockedUser` / `clearBlockedUsers`), loaded when
    `MainNavigator` mounts (signed in) and cleared when it unmounts; the
    screens' hook refreshes it on focus as before.
  - Push: the foreground handler and the background data-only handler drop
    messages whose `data.senderId` is blocked. Notifications the OS draws
    itself from an FCM `notification` block (app backgrounded/closed) can
    only be stopped by the backend.
  - Chat detail: `isAfterBlock` hides the blocked person's messages sent
    after `blockedAt` — live from the hub, in the history and in older pages;
    the conversation before the block stays. No read receipt goes back for
    them, no "online" from them, and no Opening Move suggestions in a blocked
    chat.
- Tests: `__tests__/blockedUsers.test.ts` (hub `…Z` vs REST zone-less times,
  failed refresh keeps the list, sign-out clears it).
- Not tested end-to-end: needs two accounts with a match and a block (sp4
  has neither).

---

## 2026-09-21 (later) — Discover filter: distance starts at 10 km

- **Asked by the user:** a minimum of 10 km on the filter's distance range.
  The slider was 0–100 km; it is now **10–100 km** (`DISTANCE_MIN_KM` /
  `DISTANCE_MAX_KM` in `DatingDiscoverScreen`), labelled "10 km" at the left.
  The default (30 km, what Clear Filters restores) is unchanged, so nothing
  below 10 is ever sent as `distanceKm`.

---

## 2026-09-21 (later) — Login stuck on the button spinner (iOS)

- **Reported by the user:** the login API isn't called; the button just
  spins (seen live on the iPhone 17 Pro simulator with `nsp3@yopmail.com`).
- **Cause — `utils/location.ts` (added 2026-09-16):** sign-in awaits
  `getCurrentCoords()` before `POST /auth/login`, and that asked iOS for
  permission *every time its 5-minute cache was empty or stale*.
  `@react-native-community/geolocation`'s `requestAuthorization` queues its
  callback and fires it only from `locationManagerDidChangeAuthorization`
  (RNCGeolocation.mm) — the first call is answered (iOS reports the status
  when the manager is created), a repeat call never is. The 8-second ceiling
  covered only `getCurrentPosition`, not the permission step, so the promise
  hung forever: any sign-in more than 5 minutes after launch (or with no fix,
  e.g. a Simulator with location set to None) never reached the API. The
  2026-09-16 note "never awaited longer than its ceiling" was wrong for iOS.
  Sign-up and the auto sign-in after OTP had the same wait.
- **Fix:**
  - iOS permission is requested **once per run**; every caller shares that
    answer (a later refusal in Settings still surfaces as a
    `getCurrentPosition` error).
  - **One ceiling over the whole lookup**, permission included
    (`utils/withTimeout.ts`); a permission prompt still on screen keeps
    going in the background.
  - Sign-in, sign-up and OTP sign-in wait **3 s** at most for a fresh fix
    (was 8.5 s), same as Discover.
  - `getPushToken` gets a **5 s** cap on Firebase's `getToken` — also
    awaited before sign-in, optional, and able to hang on a Simulator whose
    APNs registration never completes.
- **Tests:** `__tests__/location.test.ts` mocks the library's real iOS
  behaviour (only the first request answered). The "asked twice" test hangs
  against the old code (verified by swapping it back in) and passes now;
  plus ceiling, refusal and cache cases, and `withTimeout.test.ts`.
- Not checked on the simulator: tapping Login. An app already stuck needs a
  reload — its hung promise doesn't recover.

---

## 2026-09-21 — iOS build broken by the Xcode 27 upgrade

- **Reported by the user:** the Xcode build fails. The Mac had moved to
  **macOS 27.0 / Xcode 27.0** since the last good build (2026-09-17).
- **Cause:** Xcode 27 turns "deployment target below the supported range"
  into an **error** (range now 15.0–27.0; older Xcode only warned). React
  Native's `react_native_post_install` raises each pod's *own* target to its
  minimum (15.1) but not the **resource bundle** targets CocoaPods creates
  beside them, which keep the podspec's number: `PromisesObjC` (9.0),
  `GoogleUtilities` / `GoogleDataTransport` / `nanopb` `_Privacy` (12.0) and
  `RNCAsyncStorage_resources` (13.4). Those five were the only errors.
- **Fix (Podfile `post_install`):** any Pods target below
  `min_ios_version_supported` is raised to it; higher ones are left alone.
  All 234 settings in the Pods project are now 15.1.
- **`pod install` gotcha after the OS upgrade:** it crashed with
  `Unicode Normalization not appropriate for ASCII-8BIT` — the shell had no
  UTF-8 locale. Run it as `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install`
  (or export those in the shell profile). Shared scheme untouched.
- **Verified:** `xcodebuild` Debug for the iPhone 17 Pro simulator →
  BUILD SUCCEEDED, 0 errors; installed and launched, and with Metro started
  (it had stopped with the restart) the app reaches the Welcome screen.

---

## 2026-09-17 (later) — Date of birth, one day behind (reported again)

- **The Asana ticket (`1218322034009733`, completed 2026-09-11) was raised
  again** with its original text. Sign-up has sent the picked local day since
  `toApiDate` (commit 32f51c9, 2026-09-14), and the API stores a plain date
  (`format: date`; `GET /users/me` returns `"2007-09-17"`), so a build older
  than that commit still shows the original bug.
- **What was still wrong:** the *read* side. `DatingMyProfileScreen` and
  `MentorProfileSetupScreen` prefilled the picker with
  `new Date("2000-08-27")` — UTC midnight, i.e. 26 Aug on any device west of
  Greenwich (verified with `TZ=America/New_York` / `Los_Angeles`; fine in
  Karachi and London). Saving the form then sent 26 Aug, which is what the
  admin panel showed. `DatingProfileDetailScreen.ageFromDob` had the same
  parse (age a year off on the birthday).
- **Fix:** `parseApiDateOnly` in `utils/datetime.ts` — the leading
  `YYYY-MM-DD` as local midnight, NaN for junk and impossible dates; the
  inverse of `toApiDate`. Used in all three places. Tests round-trip through
  `toApiDate` and pass under Karachi, London, New York, Los Angeles,
  Auckland and Honolulu.
- **Still open:** dates of birth saved before these fixes stay a day early
  (backend correction, as noted on the ticket). If a fresh build still shows
  a mismatch, compare `GET /users/me` with the panel — if the API has the
  right date, the panel's own display is shifting it for viewers west of UTC.

---

## 2026-09-17 (later) — Upload Certificate: PDFs, file checks, real error messages

- **Reported by the user:** no type/size validation, a bad image type ended in
  a generic "Submission failed", and PDFs couldn't be uploaded although the
  screen lists them.
- **Why PDFs failed:** the only picker was `launchImageLibrary`, which can't
  reach a PDF (and, with `mediaType: 'mixed'`, offered videos). Every upload
  was also named `certificate.pdf`, photos included.
- **New dependency: `@react-native-documents/picker@12.0.2`** (maintained
  successor of react-native-document-picker; RN ≥ 0.79, new-arch). `pod
  install` run (scheme untouched). ⚠️ Its JS calls
  `TurboModuleRegistry.getEnforcing` on import, so **any build made before
  this change shows a red screen on reload** — rebuild iOS and Android.
  Rebuilt and launched on the iPhone 17 Pro simulator from Xcode. Android not
  built. Only `package-lock.json` was updated (npm); `yarn.lock` is stale for
  this package.
- **Screen:** the dashed area now has **Photos** (photo library, photos only)
  and **Files** (document picker, import mode, PDF / JPEG / PNG) buttons, and
  shows the chosen file's name, type and size. No modal chooser — presenting
  a picker while a modal closes is unreliable on iOS.
- **`utils/certificateUpload.ts`** (tested): `checkCertificate` accepts
  PDF / JPEG / PNG up to 10 MB (type from the picker, else the extension;
  `image/jpg` → `image/jpeg`), and names the upload to match
  (`IMG_1.JPEG` → `IMG_1.jpg`). Refusals name the type ("GIF files aren't
  supported. Please choose a PDF, JPG or PNG.") or the size ("That file is
  12.4 MB…"). `certificateSubmitError` rewords the server's raw-MIME type
  refusal, turns the host's 413 into a size message, and passes any other
  server reason through. `datingApi.submitSpiritualRequest` now takes
  `{ uri, name, type }`.
- **Server rules (probed, gap #36):** accepts PDF, JPEG, PNG, DOC, DOCX by
  declared type; type is checked before size; 40 MB → host 413. The 10 MB
  limit is ours until the backend says otherwise.
- Checked on the simulator: the empty state with a refusal message, and a
  selected PDF (temporary harness, reverted). Not checked: opening either
  picker, or a real upload (can't tap; a real upload would also create a
  request on the test account).

---

## 2026-09-17 (later) — Vetting Quiz: every external mentor in "Choose a Mentor"

- **Reported by the user:** the result screen showed 5 mentors while
  `GET /external-mentors` has 6. The list was cut with `.slice(0, 5)`, and an
  empty or failed list fell back to five hardcoded names (Jason Taylor, …)
  that did nothing when tapped.
- **Now:** every mentor the API returns (skipping any `isActive: false`),
  three to a row, keyed by id. No mentors → the "Choose a Mentor" heading,
  grid and OR divider are hidden, leaving Request a Mentor. A photo that
  fails to load shows initials (emoji-safe). The fetch runs alongside the
  2-second reviewing pause instead of after it.
- Checked on the simulator (signed out; `/external-mentors` is public): all
  six render in two rows. Two photos 404 on the server and one is a 1×1 PNG —
  noted on gap #12.

---

## 2026-09-17 (later) — Assigned Mentor details screen

- **Asked by the user, with the Figma "Mentor Details" screenshot:** tapping
  the Mentor Assigned card on `SpiritualEntryScreen` opens the mentor's
  details. No such screen existed, so it's new:
  `screens/dating/AssignedMentorScreen.tsx`, route `AssignedMentor` in the
  dating stack, params `{ request: MentorRequest }` (the row
  `GET /mentor-request` already returned). The card now has a chevron; the
  pending card is unchanged.
- **Layout:** round photo, name (spiritual purple), title, a Registration Date |
  Assigned Date row, About {name}, Contact Details (email opens the mail app),
  and "Completed your course and" + Upload Certificate (same button as the
  entry screen, goes to `UploadCertificate`). The footer stays at the bottom.
- **Data (checked live with `sp4@yopmail.com`):** the response has name, photo,
  `assignedAt`, `createdAt` and nothing more. No member-callable endpoint has
  the mentor's profile (probed `Dating/user/{id}` 404, `Mentor/profile` 403,
  admin 403). So title / About / Contact Details are hidden until the backend
  adds `assignedMentorTagline` / `assignedMentorBio` / `assignedMentorEmail`
  (gap #35); the type already has them.
- **Registration Date = `createdAt`** (when the member asked for a mentor) —
  my reading of the design, flagged in #35.
- Checked on the simulator with sp4's real response, and with sample title /
  bio / email for the full layout (temporary harness, reverted).
- **Simulator note:** Fast Refresh stopped reaching the Xcode-launched app on
  the iPhone 17 Pro mid-session; `POST localhost:8081/reload` didn't help.
  Relaunching with `xcrun simctl launch` on the other simulator did.

---

## 2026-09-17 — Separate subscription products per module

- **Decided by the user** (replaces the 2026-08-27 "one shared product"): three
  products in two App Store groups.

  | Module | Product id | Group |
  |---|---|---|
  | Mentor | `com.monthly` (kept; can't be renamed) | Mentor |
  | Non-Spiritual dating | `com.nonspiritual.monthly` | Dating |
  | Spiritual dating | `com.spiritual.monthly` | Dating |

  A user is only ever one dating type, so both dating plans share a group.
  All three are $5.99/month.
- **`utils/subscriptionProducts.ts`** holds the ids and groups.
  `services/iap.ts` takes the product id on fetch / purchase, and restore
  looks only at one group's products. `IAP_PRODUCT_ID` is gone.
- **`useSubscription('mentor' | 'dating')`**: `isPremium` is now per group
  (`statusGrants`: active, and `status.productId` is in that group). A
  purchase waits for *its* group's entitlement, so a mentor's existing
  subscription doesn't count as the new dating one. A status with no
  `productId` still unlocks both, rather than locking out someone who paid.
  Mentor: `MentorNavigator`, `MentorProfileSetupScreen`,
  `MentorSubscriptionScreen`. Dating: `DatingPremiumScreen` (buys the product
  for its `datingType`), Discover, Matches.
- Fallback prices `$20` → `$5.99`. `ios/Fixit.storekit` now has both groups at
  5.99. Unit tests: `__tests__/subscriptionProducts.test.ts`.
- **Dating Premium feature list** (asked by the user): removed "See Everyone
  Who Likes You", "Ice Breaker questions setup" and "No ads". Left: Unlimited
  Likes, Advance Filters, Unlimited Matches, Priority Support.
- **Backend (gap #34):** map the products to modules, return entitlement per
  group (a mentor who also dates has two subscriptions, and `status` shows
  one), and count only dating products for dating premium.
- **Screenshots** for App Store Connect review in `docs/store-screenshots/`
  (iPhone 17 Pro, 1206×2622), prices read from the StoreKit config: the
  fallback was blanked while capturing, so $5.99 came from StoreKit. Captured
  signed-out by briefly swapping the Welcome route for each paywall (reverted).
  The Mentor one is the post-signup gate (Sign Out header). The purchase sheet
  itself wasn't opened — the simulator can't be tapped from here.
- **StoreKit gotcha:** the running app keeps the StoreKit config it launched
  with. Editing `Fixit.storekit` needs a fresh Run from Xcode (a Fast Refresh
  or relaunch from the simulator isn't enough).

---

## 2026-09-16 (later) — Likes Received: blurred locked tiles for free accounts

- **Asked by the user, with a design screenshot:** non-subscribers see blurred
  photo tiles with a white padlock and "Get a Premium Access" below.
- **Reverses the "backend is the single source of truth" decision** (2026-08-29
  entry). The endpoint still isn't gated (gap #23), so the tab now locks on
  `!isPremium` as well as on 402/403. While the first entitlement read is in
  flight with nothing cached, the tab shows a spinner rather than guessing.
- **Tiles:** up to two (`LOCKED_PREVIEW_COUNT`), squarer than the grid cards
  (1.15 vs 1.35, as in the design), the liker's photo at `blurRadius` 28 under a
  45% black scrim, soft shadow for the design's blurred edge. Tapping one opens
  Premium. A free account with no likes gets the normal empty state instead of
  tiles that promise likes. A 402/403 has no rows, so those tiles are plain.
- **`RemoteImage`** gained `blurRadius` and `onLoadEnd`. With a blur it sets
  `resizeMethod="resize"`: Android blurs the decoded bitmap, which is full size
  for a remote image unless it's resized, so the blur looked far weaker than on
  iOS. The padlock waits for `onLoadEnd` so it never sits on the spinner.
- Checked on the iPhone 17 simulator (free Non-Spiritual account, one like).
  Android not checked.

---

## 2026-09-16 (later) — Discover: filter indicator + Clear on Advance Filters

- **Asked by the user:** a clear option on the filter sheet and an indicator on
  the filter icon. The main Filter view already had Clear Filters | Apply
  (from 32f51c9); the Advance Filters view only had Apply, so it now has the
  same row. Both call `clearFilters`, which resets everything, interests
  included, and reloads an unfiltered deck.
- **Filter icon dot:** an accent-coloured dot while the deck on screen came
  from a filtered request (`filtersApplied`, set in `loadUsers` next to
  `filtersAppliedRef`). Apply turns it on, even when the values are the
  defaults, since age 18–26 / 30 km still narrows the deck. Clear turns it
  off. Screen readers hear "Filters, applied".

---

## 2026-09-16 — Current location on sign-up, sign-in and Discover

- Backend added `latitude` / `longitude` to `POST /auth/register` and
  `POST /auth/login` (nullable doubles), and `Latitude` / `Longitude` to
  `GET /dating/discover` — **typed as strings there**, so `datingApi.discover`
  stringifies them while every other query param stays a number.
- **New dependency: `@react-native-community/geolocation@3.4.0`.** React Native
  has no geolocation in core. `pod install` run for iOS; both platforms need a
  native rebuild.
- **`src/utils/location.ts`** — `getCurrentCoords()` asks for permission the
  first time (`PermissionsAndroid` on Android, `requestAuthorization` on iOS,
  with the library's own prompt turned off), caches the fix for 5 minutes, and
  returns null on refusal, timeout or location being off. It never throws and is
  never awaited longer than its ceiling, so callers just leave the fields out.
  A refusal is remembered for the session, so nothing re-prompts on every call.
- **Asked at launch** (the user's call, rather than at first sign-in):
  `primeLocation()` runs in `App.tsx` right after the notification prompt — one
  iOS dialog at a time — and warms the cache with a first fix, so sign-in,
  sign-up and Discover find coordinates ready instead of prompting mid-flow.
- Wired into both sign-in calls (`LoginScreen` and the auto sign-in after OTP),
  `RegisterScreen`, and the Discover deck load (3s ceiling there, then cached).
- **Native config:** Android gained `ACCESS_FINE_LOCATION` /
  `ACCESS_COARSE_LOCATION` (plus optional location hardware features, so the app
  still installs on devices without GPS). iOS had
  `NSLocationWhenInUseUsageDescription` present but **empty**, which App Store
  review rejects; it now explains the use.

---

## 2026-09-15 — Discover: swipe feedback (button spinner + toast)

- **Asked by the user:** feedback on ✕ / ⭐ / ♥. The deck still moves on
  straight away, but the button for that swipe now shows a spinner until
  `POST /dating/swipe` answers, and all three buttons plus the next card's drag
  wait until then. One swipe at a time also removes the old race of a refusal
  landing while the next card was mid-swipe.
- **Toast** (new `components/common/Toast.tsx`, navy like the penpal profile's
  inline one): "You liked / super liked / passed on {name}" on success; a match
  shows its screen instead. Any failure other than the daily limit now puts the
  card back and shows the server's message in a red toast — before, that swipe
  was quietly lost. The limit refusal keeps its cover / alert.
- If the deck reloads while a swipe is in flight (e.g. a tab switch), a failure
  no longer jumps the new deck back to an old index.
- Docs: BACKEND_LIKE_LIMITS.md / .xlsx and gap #22 note the new failure handling.

---

## 2026-09-14 (later) — Swipe counters verified and wired

- **Live test (`nons@yopmail.com`, free Non-Spiritual; beta limits 2 swipes /
  1 super like):** a super like → 200 with the new counters
  (`dailySuperLikeLimit`, `superLikesUsedToday`, `superLikesRemainingToday`)
  **and `resetsAt: "2026-09-15T00:00:00Z"`** (midnight UTC — it *is* there).
  A 2nd super like → still **400 with only a message, no `code`**. A pass →
  200, and `swipesUsedToday` went 1 → 2, so **a pass uses up a swipe**, against
  the requirement. The deck had 2 people, so the refusal after the swipe limit
  is still untested. Side effects: nons super-liked LisaD (73) and passed on
  Else (254).
- **`utils/swipeLimits.ts`:** limits now store their reset time (epoch ms)
  instead of a local day. `applyCounters` reads each successful swipe: no
  swipes left → ♥ and ⭐ dim; no super likes left → ⭐ dims; some left → the
  block lifts. The expiry is the last `resetsAt` seen, else the next midnight
  UTC. `SwipeResult` is typed with the verified fields.
- **Discover:** tapping ⭐ when the swipes (not just super likes) are gone shows
  the daily-limit cover instead of the super-like alert. Passes are still never
  blocked client-side; if the backend starts refusing them, they fail silently.
- Refusal detection is unchanged (402/403, or a 400 saying "daily limit"),
  since no error code shipped.
- Docs: BACKEND_LIKE_LIMITS.md and .xlsx rewritten around a status table;
  gap #22 back to 🔴 Open (no code); #33 updated.
- **Limit cover now survives tab switches** (reported by the user): the silent
  deck refresh on focus used to hide it, so coming back to Discover showed the
  dimmed buttons with no cover until the next attempt. It now stays until the
  user passes, super likes, taps Keep Browsing (premium), or the limit lifts —
  which also resets it, so the next limit starts uncovered.
- **…and survives relaunches** (reported next): the limits lived only in memory,
  and config has no usage, so a relaunch forgot them until a swipe was refused.
  `useSwipeLimits(isPremium, userId)` now saves `{ userId, like, superLike,
  premium }` (reset times in epoch ms) under `swipe_limits_v1` and reads it back
  on launch; other users' records and expired entries are ignored
  (`readStoredLimits`, tested). A restored like limit brings the cover back.
  Buying premium clears only limits reached on the free plan — otherwise the
  subscription status loading at every launch would wipe a premium user's own
  limit.
- **✕ is blocked at the limit too** (requested by the user): a pass uses up a
  swipe on the backend, so `limitFor('Ignore')` now returns `like` (the daily
  swipes). With no swipes left ✕ dims, a left swipe settles back, and a tap or
  swipe brings the cover back. With only the super likes gone, ✕ still works.
  This settles the open "should a pass count?" question in favour of what the
  backend already does.
- **Filter sheet sliders** (reported by the user): at the maximum the thumb was
  centred on the track's very end, so half of it — and the "100 km" / "80"
  label — was clipped by the sheet. `TrackSlider` now insets the track by the
  thumb's radius, keeps the value label inside both edges, and lets it stand in
  for the "0 km" / "18" label when the two would overlap.
- **Dating My Profile loading** (reported by the user): the first open replaced
  the whole screen — top bar and bottom bar included — with a white page and a
  centred spinner. The bars now always render, the avatar / name / email header
  shows straight away (it comes from the session), and a spinner stands in for
  the form only until `GET /dating/profile` returns. The form mounts after the
  load, so nothing typed early can be overwritten.
- **Same fix app-wide** (the user asked for the rest to be found): every screen
  that draws its own header or bars and returned a bare spinner while loading
  now keeps that chrome and shows the spinner in the content area only —
  Discover (first deck), Chat Detail (history; header and composer stay),
  Interest / Ice Breaker Selection (spinner inside the list; footer buttons
  stay), Premium, Non-Spiritual Entry, Spiritual Entry (both the boot and the
  loading phase), Vetting Quiz, Penpal My Profile, Penpal Setup and Mentor
  Subscription (Sign Out stays usable on the gate, with its alert). Dating
  Lobby's spinner only waited for a cached user it never used, so it's gone.
  Left alone: screens with a navigator header (Block List, External Mentors,
  FAQs, Edit Profile, Mentor Edit Profile), screens already loading inline
  (Chats, Matches, Notifications, Mentor Dashboard, Penpal Connections /
  Letters / Letter Detail, Upload Certificate, Profile Detail), PenpalHome (not
  in navigation), and the three navigator gates (app start, Home, Mentor), which
  run before any screen exists.

---

## 2026-09-14 — Like limits: config wired, new swipe response unverified

- **Backend reports** `POST /dating/swipe` now returns the shape proposed in
  [BACKEND_LIKE_LIMITS.md](./BACKEND_LIKE_LIMITS.md) (error code + super-like
  counters), **without `resetsAt`**. **Not verified:** sp3 has already swiped
  everyone in its deck, beta's limit is now 2 swipes (so a test needs 3+
  people), and the user chose to skip the swipe test. The app doesn't read
  those fields yet — it still relies on 402/403 or a 400 saying "daily limit".
- **`GET /dating/config` now returns the admin settings** (verified):
  `freeSwipesPerDay`, `freeSuperLikesPerDay`, `premiumSwipesPerDay`,
  `premiumSuperLikesPerDay` (beta: 2 / 1 / 2 / 5, lowered for testing), plus
  `maxGalleryImages`, `maxDatingImages`, `maxIceBreakers`, OTP and trial
  settings, `vettingPassScore` and `supportEmail`. Typed as `DatingConfig`,
  fetched with `datingApi.getConfig()`. Limits only, no usage.
- **`NonSpiritualEntryScreen`** shows the free numbers from config instead of
  the hardcoded "10 swipes / 1 super like". If config fails it leaves the
  numbers out rather than guess (`freeAllowanceLines` in `utils/swipeLimits.ts`,
  tested). The screen moved back to SCREENS_NO_API_CHANGES.
- Premium is capped on beta (2 swipes / 5 super likes), so the Figma
  "Unlimited Likes" copy is wrong there — still a client question.
- Docs: BACKEND_LIKE_LIMITS.md, gap #22 (🟡 Verify) and gap #33 (🟡 Partly
  done) updated.

---

## 2026-09-11 — Discover: like and super-like limits split

The admin panel sets separate daily allowances for **likes** and **super
likes**, with different numbers for free and premium. The app treated them as
one generic limit.

- **`src/utils/swipeLimits.ts` (new)** — `useSwipeLimits(isPremium)` tracks
  which allowance ran out and on which local day; `limitFor(action)` maps
  Like → likes, SuperLike → super likes, Ignore → none. Pure helpers tested in
  `__tests__/swipeLimits.test.ts`.
- A refused **Like** → card back, Figma "daily limit" cover, ♥ dimmed.
  A refused **SuperLike** → card back, "Out of Super Likes" alert, ⭐ dimmed;
  likes keep working. **Pass is never blocked**, and a pass or super like from
  the pill lifts the cover. A fresh deck (focus, filters) starts uncovered.
- **Premium users** who hit their own limit get "come back tomorrow" + Keep
  Browsing instead of "Subscribe To Premium".
- **Day reset:** Discover stays mounted in the drawer, so limits from an earlier
  local day are dropped on focus and when the app returns to the foreground.
  The server's reset rule isn't published — local midnight is a guess, and the
  server simply refuses again if it's early.
- **The overlay was drawn under the top card** (cards carry zIndex 8–10 /
  elevation 8; the overlay had neither). It now sits at 15 / 8.5, below the
  pill (20 / 9), and takes the measured card height instead of 56% of the
  screen.
- `SwipeCard.onSwipe` now returns false when the screen refuses a swipe, and
  the card springs back — covers a limit that lands while a card is mid-flight.
- Backend asks written up in [BACKEND_LIKE_LIMITS.md](./BACKEND_LIKE_LIMITS.md)
  (gap #33; #21, #22, #23, #28 updated), with an Excel copy for sharing in
  `BACKEND_LIKE_LIMITS.xlsx`. Update it when the md changes.
- **Live test (`sp3@yopmail.com`, free Spiritual):** limits *are* enforced, but
  a refusal is a **400** with only a message ("You have reached your daily
  limit of 1 super likes…"), not the agreed 402/403. So `isLimitRefusal` also
  accepts a 400 whose message says "daily limit" — a stopgap until an error
  code exists. Free = 10 swipes (super likes count toward them) + 1 super like;
  the swipe response carries `dailySwipeLimit` / `swipesUsedToday` /
  `swipesRemainingToday` / `isPremium`. A refused swipe doesn't count, and a
  like right after the super-like refusal went through. The deck had 2 people,
  so the 10-swipe limit, passes and the reset time are untested. Side effects
  on beta: sp3 super-liked Dev (84) and liked Sp1 (189) → match #26.
- Also seen live: `GET /Dating/likes/received` returns the full list to a
  **free** account (gap #23: not gated); `GET /Dating/config` returns
  `{ maxGalleryImages }` (gap #28's value is exposed); `GET /Subscription/status`
  returns `isEntitled`, `status`, `expirationDate`, `accessUntil`, … (gap #21).
- **Left for later:** the hardcoded "10 free swipes / 1 super like per day" on
  `NonSpiritualEntryScreen` (needs #33), and the Figma "Unlimited Likes" /
  "unlimited swaps" copy, which is only true if premium is uncapped (a client
  question).

---

## 2026-09-08 — Penpal "My Profile" + public profile header fixes

- **New screen `PenpalMyProfileScreen`** (drawer route `PenpalMyProfile`, menu
  item **Profile**). Penpal members had no way to change anything after
  sign-up: `PenpalSetupScreen` prefills from the profile and upserts, but it
  is only reachable before `PenpalMain` exists and ends in
  `replace('PenpalMain')`. The new screen edits the same field set —
  pen name (with the same availability check, skipping the member's own
  current name), letter type, mailing address + consent for Physical, and the
  disability-visibility answer — through `POST /penpal/profile`, and saves in
  place instead of navigating away. Own header (hamburger + bell) with
  `headerShown: false`, matching the Penpal Group screen.
  - **First/last name are editable** and save through `PATCH /users/me`, only
    sending the ones that actually changed. Email stays read-only. The avatar
    uploads via `POST /users/me/profile-image`.
  - Letter type, the address-sharing consent and the disability question are
    **commented out, not deleted** (per request). Their values are still
    loaded from the profile and re-sent on save, since `POST /penpal/profile`
    is an upsert that wants the whole record. The consent *validation* is
    commented out along with the checkbox — it would otherwise permanently
    block saving for anyone whose stored answer is `false`, with no way to
    tick it.
  - The **drawer avatar no longer uploads** — that moved here. The drawer
    still refetches the photo each time it opens.
- **`AuthContext.updateUser(patch)`** (new) — merges a patch into the
  signed-in user and rewrites the cached session (`saveUser` in `store/auth`,
  which leaves the tokens alone). Without it a name changed on the profile
  screen would keep showing the old value in every drawer and header until the
  next sign-in. `EditProfileScreen` still doesn't call it — worth wiring up
  when that screen is next touched.
- **`PenpalPublicProfileScreen`** — removed the dark 40 % scrim over the photo
  header; the top back/report buttons now sit on translucent circles so they
  keep contrast without it. The container also painted `Colors.navy`, which
  showed as black wedges through the photo's rounded bottom corners — it is
  now the page colour and rounded with `overflow: 'hidden'`. Location line
  shows the **country only** (was city, state, country).

## 2026-09-08 — Non-Spiritual members can reach the lobby to switch

Product rule restated: **Non-Spiritual → Spiritual is allowed, Spiritual →
Non-Spiritual is never**. The app enforced the second half already but gave a
Non-Spiritual member no way to exercise the first — `DatingNavigator` sends any
account with a dating profile straight to `DatingMain`, so the lobby was
unreachable after setup.

- **`HomeScreen`** — the Dating card now routes on `datingType`: a
  `NonSpiritual` account goes to `Dating → DatingLobby` (nested navigate, so
  back from the lobby exits to Home), Spiritual and profile-less accounts keep
  the old `navigate('Dating')`. The lobby is deliberately *not* the module's
  initial route: that would make every launch of a single-module account start
  on a "choose your path" screen.
- **`DatingLobbyScreen`** — tapping Non-Spiritual with a profile already in
  place now goes straight to `DatingMain` instead of bouncing through
  `NonSpiritualEntryScreen`'s load-then-replace. Disclaimer for that case warns
  the move to Spiritual is one-way.
- **`SpiritualEntryScreen`** — the real gap. `handleStartSpiritual` used to see
  *any* existing profile and just `navigate('DatingMain')`, so a vetted
  Non-Spiritual member pressing "Start Spiritual Dating" landed back in the
  Non-Spiritual feed and nothing changed. It now re-POSTs the profile with
  `datingType: 'Spiritual'`, sending back about / display image / pseudo name /
  DOB / country / city / state so the switch doesn't wipe them, then goes to
  Spiritual interest selection (`/dating/interests` is per dating type). The
  gender picker is prefilled from the existing profile on mount for the same
  reason. Only a profile that is *already* Spiritual short-circuits to
  `DatingMain`, and server errors now surface `response.data.message`.

Backend still to confirm that `POST /dating/profile` accepts the type change and
what it does with the old `interestIds` — logged as gap #27 in
[API_CHANGES_NEEDED.md](./API_CHANGES_NEEDED.md). (The `.xlsx` exports have been
stale since row 13; not regenerated here.)

## 2026-08-27 — iOS Debug builds fail to link (RN 0.85 prebuilt core)

**Not caused by the IAP work** — the core tarballs are dated 2026-06-04, and
`react-native-iap` is a Nitro module that defines no Fabric components, so it
never appears in the undefined-symbol list. Found while verifying the IAP
build.

**Symptom.** `xcodebuild -configuration Debug` fails at link:

```
Undefined symbols:
  facebook::react::Sealable::Sealable()          <- RNScreens, RNGestureHandler,
  facebook::react::ShadowNode::getDebugName()       RNDateTimePicker
  facebook::react::ShadowNode::getDebugValue()
```

**Cause.** RN 0.85 ships React Native core as a **prebuilt** xcframework
(`RCT_USE_PREBUILT_RNCORE` defaults to `1`) and downloads *both* a Debug and a
Release tarball into `ios/Pods/ReactNativeCore-artifacts/`. A script phase in
`React-Core-prebuilt.podspec` swaps in the right one at build time, deciding
from `ios/Pods/React-Core-prebuilt/.last_build_configuration`.

The trap is in `scripts/replace-rncore-version.js`:

```js
// Assumption: if there is no stored last build, we assume that it was build for debug.
if (!fileExists && configuration === 'Debug') return false;  // skips the swap
```

A fresh install extracts the **Release** framework, but with no marker present
the script assumes it is already Debug and skips the swap. Release core is
built with `NDEBUG`, which compiles out `Sealable`'s ctors and the
`getDebug*` family. Meanwhile RN only adds `-DNDEBUG` to pods in **Release**
configs (`cocoapods/utils.rb`, `add_ndebug_flag_to_pods_in_release`), so in
Debug the Fabric pods compile *expecting* those symbols. Hence the mismatch.

Verified with `nm`: the Release framework exports **0** `Sealable` symbols, the
Debug one exports 13 (arm64) / 15 (x86_64). Sizes give it away too — Release
binary 23.8 MB vs Debug 132 MB.

**Fix.** Seed the marker with the truth. Added to the Podfile's `post_install`:
writes `Release` into `.last_build_configuration` when the file is missing, so
the first Debug build performs the swap. The script maintains it after that.
In the Podfile so it survives `pod install`, which regenerates `Pods/`.

**Gotcha while diagnosing:** the swap replaces the framework *mid-build*, so
the build where it first runs can still fail — one arch links against the old
framework. Just build again; the second run is clean.

**Also worth knowing:** `pod install` once flipped the shared scheme's
`LaunchAction` from Debug to **Release**. Reverted — Release builds link fine
even with the wrong core, so if anyone "fixed" the build that way in the past,
this is why.

---

## 2026-08-27 — In-app purchases (iOS) wired end-to-end

Single auto-renewing product **`com.monthly`** behind every paid surface —
mentor programme and dating premium share **one** entitlement. iOS only;
Android deliberately keeps its existing stubs.

**Decisions taken with the client** (asked before starting, per `IAP Document.pdf`):

| Question | Decision |
|---|---|
| One product or per-flow? | **One** shared product, one entitlement |
| How does the backend learn about a purchase? | **Webhook only** — the app posts nothing, it polls `GET /subscription/status` |
| `appAccountToken` source | `identifier` on the login response (backend added it same day) |
| Free-swipe limit signal | **402/403 from `POST /dating/swipe`** |
| Android meanwhile | Keep the current stub (record call / "Coming Soon") |
| Mentor gate | **Hard** — no back button, only Subscribe / Restore / Sign Out |
| Free trial | None |
| Post-purchase UX | Spinner + 30s poll, then success; timeout → "taking longer" + Check Again |

**Library:** `react-native-iap@16.4.0` (StoreKit 2). Picked because it's built on
`react-native-nitro-modules ^0.36.5` — already a dependency here — so it fits
RN 0.85 without a version fight. Pods: `NitroIap 16.4.0` + `openiap 3.3.0`.

**New files**
- `src/services/iap.ts` — StoreKit wrapper. Connection, product fetch, purchase
  with `appAccountToken`, restore, replayed-transaction handler.
- `src/api/subscription.ts` — `GET /subscription/status`, `POST /subscription/restore`.
  Status response is untyped in Swagger, so `normalizeSubscriptionStatus`
  tolerates the likely field spellings (gap #21).
- `src/store/SubscriptionContext.tsx` — the one `isPremium` every gated surface reads.
- `src/utils/appAccountToken.ts` — backend GUID when present, else a
  deterministic derivation from the int user id (gap #20).
- `src/components/common/ActivatingSubscriptionModal.tsx`
- `src/components/dating/DailyLimitOverlay.tsx`

**Two decisions worth remembering**

1. **The StoreKit transaction is finished only after the backend grants
   entitlement.** Because the design is webhook-only, finishing on Apple's
   confirmation alone would drop the purchase entirely if the webhook never
   landed. Leaving it unfinished means StoreKit replays it on the next launch
   and `onReplayedPurchase` re-checks the status — the purchase self-heals.
2. **The backend stays the single source of truth for Likes Received.**
   _(Superseded 2026-09-16: the client now locks on `!isPremium` too.)_ The
   client does *not* pre-lock that tab from its own `isPremium`; it still calls
   the endpoint and locks on 402/403. It only reacts to the *moment* premium is
   bought, to swap the locked preview for the real list without a refresh.

**Not a real blur.** `DailyLimitOverlay` dims the card with a scrim rather than
blurring it — a true blur would mean pulling in a native blur module for one
screen. Flag if the design needs the real thing.

**tsconfig:** added a `paths` entry for `react-native-iap`. Its `exports` map
aims the `react-native` condition at raw TS source, which dragged the library's
own type errors into our build; the entry points the type checker at the
shipped declarations. Metro still bundles the source.

**Left for the account owner** (can't be done from here):
- Create `com.monthly` in App Store Connect for bundle `com.fixit.mobileapp`,
  submit for review, and create a Sandbox Tester.
- Enable App Store Server Notifications **v2** → point at the backend's
  `POST /api/Subscription/webhook/ios`.
- `ios/Fixit.storekit` exists for local testing but is **not** in the Xcode
  project — drag it in, then Edit Scheme → Run → Options → StoreKit
  Configuration to use it without App Store Connect.

**`appAccountToken` case trap (gap #20).** The backend's `identifier` is
upper-case (`CF5696FE-…`); StoreKit takes a `UUID` and Apple renders it
**lower-case** in the signed transaction the webhook receives. The app sends it
lower-cased so both ends use one spelling, but the webhook's lookup still has
to be **case-insensitive** — a naive `==` against the stored upper-case value
fails silently: the purchase goes through and entitlement never arrives.

Open backend gaps logged as #20–#24 in
[API_CHANGES_NEEDED.md](./API_CHANGES_NEEDED.md).

---

## 2026-08-20 — Firebase push notifications wired end-to-end

Full setup guide (including the bits only the account owner can do):
**[PUSH_NOTIFICATIONS.md](./PUSH_NOTIFICATIONS.md)**.

**Libraries:** `@react-native-firebase/app` + `@react-native-firebase/messaging`
v26.3.0. Note v26 is **modular-only** — the `messaging()` namespaced API the
old stubs referenced no longer exists, so everything uses
`getMessaging(...)` / `getToken(messaging)` style calls.

**The token path was already half-built.** `LoginRequest` and
`RegisterRequest` both accept `pushToken`, and the app already sent it — but
`getPushToken()` in `src/utils/device.ts` was a stub returning `null`, so it
never carried anything. Replaced by `src/services/pushNotifications.ts`
(moved rather than re-exported: the service needs `getDeviceId()` from
`device.ts`, so keeping it there would have been circular).

There's **no device-registration endpoint**, but `POST /auth/heartbeat`
accepts `{ deviceId, pushToken }` — that's the mid-session channel. So:
- sign-in → token rides along on login/register,
- after login → re-synced via heartbeat (catches a permission grant made
  during login),
- FCM rotation → `onTokenRefresh` → heartbeat,
- logout → `deleteToken()` so the device stops receiving the old account's
  notifications.

**Both native inits are deliberately guarded.** The google-services Gradle
plugin hard-fails a build when `google-services.json` is missing, and
`FirebaseApp.configure()` raises a fatal error without `GoogleService-Info.plist`
— and those files can only come from the Firebase console. Applying either
unconditionally would have broken the build for everyone until the files
landed. Instead both check for their file first, so **the app builds and runs
exactly as before today**, and push activates on the next rebuild after the
files are added.

**iOS Podfile took two fixes**, both scoped deliberately narrowly:
1. RNFB v26 defaults to SPM for Firebase, which is incompatible with this
   project's static linkage (`SPM + static linkage is not supported`). Set
   `$RNFirebaseDisableSPM = true` rather than switching the whole app to
   `use_frameworks! :dynamic`, which would have changed linkage for every
   other native module.
2. That exposed `FirebaseCoreInternal` (Swift) importing `GoogleUtilities`,
   which has no module map. Added `pod 'GoogleUtilities', :modular_headers =>
   true` rather than a global `use_modular_headers!`.

Firebase 12.18.0 also needs `pod install --repo-update` on a stale spec repo.
Pods now install clean (Firebase 12.18.0 + RNFB 26.3.0).

⏳ **Shelf life:** CocoaPods warns that FirebaseCore is deprecated and stops
publishing there after **October 2026** — SPM is the future, which is why RNFB
defaults to it. A migration to SPM (and therefore dynamic frameworks) will be
needed eventually.

**Also:** activated the deep-link block that was left commented in
`AppNavigator.tsx` (rewritten for the modular API) — a tap with `matchId` +
`senderId` in the payload's `data` opens that chat, anything else opens
Notifications; a cold-start tap is held until the navigator is ready. Fixed the
long-standing `getCurrentRoute()?.name` type error there while in the file, so
**`tsc` is now clean across the whole project** for the first time.

**Config files:** `ios/Fixit/GoogleService-Info.plist` was added during the
session but only *copied into the folder* — it was **not a member of the Xcode
target**, so the app would never have found it and Firebase would have stayed
silently uninitialised. Registered it in the *Fixit* Copy Bundle Resources
phase via CocoaPods' own `xcodeproj` gem (safer than hand-editing
`project.pbxproj`) and verified `BUNDLE_ID` matches the Xcode bundle id.
**`android/app/google-services.json` is still missing** — register the Firebase
Android app under `com.fixit.mobileapp` (see the rename below).

### Android package renamed `com.fixit.app` → `com.fixit.mobileapp`

Done everywhere, so both platforms now share one id:
- `android/app/build.gradle` — `applicationId` **and** `namespace`
- `android/settings.gradle` — `rootProject.name`
- `package.json` / `package-lock.json` — `name`
- `MainActivity.kt` / `MainApplication.kt` — `package` declaration, and the
  files moved to `android/app/src/main/java/com/fixit/mobileapp/`. That also
  fixes a pre-existing oddity: they were in a **literal directory named
  `com/com.fixit.app/`**, which Kotlin tolerates (it doesn't require dir to
  match package) but is wrong.

Nothing else referenced the old name — no manifest entries (the components use
the `.MainActivity` shorthand, which resolves through `namespace`), no
`BuildConfig`/`R` imports, and iOS was already `com.fixit.mobileapp`.

⚠️ A changed `applicationId` is a **different app** to Android: existing
`com.fixit.app` installs won't upgrade over it, they sit side by side.
Uninstall the old one, and `./gradlew clean` before the next build so stale
generated sources under the old namespace don't linger.

### Follow-up fixes

**Release-only AAPT failure: `resource color/notification_accent … not found`.**
Follow-on from the manifest fix below, and it only showed up on
`assembleRelease` — debug built fine. `firebase.json` values are substituted
into **RNFB's own manifest**, so a resource reference is resolved against the
*library's* resources, and RNFB messaging bundles its own `colors.xml` of CSS
colour names. `@color/notification_accent` lives in the app module, so the
library couldn't link it. The split that actually works:
- `messaging_android_notification_channel_id` → `firebase.json` (plain string,
  no resource lookup)
- `default_notification_color` → app `AndroidManifest.xml` with
  `tools:replace="android:resource"` (must resolve against app resources)

So the manifest-merger suggestion I dismissed as "fighting the library" was
right for the colour specifically. **Rule of thumb: `firebase.json` is only
for values that resolve inside RNFB's own resource namespace.** And: verify
`assembleRelease`, not just `assembleDebug` — this class of resource error is
release-only.

**Android manifest merger failure.** I'd added
`com.google.firebase.messaging.default_notification_channel_id` and
`…default_notification_color` meta-data to `AndroidManifest.xml`. RNFB
**already declares both** in its own manifest, filled from Gradle manifest
placeholders, so `:app:processDebugMainManifest` failed with duplicate
attributes. Removed them and configured the colour through **`firebase.json`**
at the repo root (`messaging_android_notification_color`), which is the
mechanism RNFB provides — `tools:replace` would have silenced the error but
fought the library instead of configuring it. Also dropped the
`default_notification_channel_id` string I'd added: setting a channel id
requires something to *create* that channel (native code or notifee), and an
id naming a non-existent channel just makes FCM fall back to its own default.
**Lesson: check whether a native lib already declares manifest entries before
adding them.**

**`messaging/registration-timeout` on iOS.** `getPushToken()` was calling
`registerDeviceForRemoteMessages()` as a belt-and-braces step. RNFB already
registers automatically, so that call was redundant — and it *blocks* waiting
on an APNs response, which never arrives on the Simulator. A "no token yet"
became a hard failure that aborted the whole fetch. Removed; the check is now
observational (log-only) and the catch prints an iOS checklist. Real point
worth remembering: **push tokens need a physical iOS device** — the Simulator
generally can't complete APNs registration at all.

**Permission moved to app launch.** It was requested inside the login/register
handlers, so the prompt appeared on pressing Login. Now asked once from
`App.tsx` on mount. This isn't only cosmetic: on iOS, APNs registration only
completes after notifications are allowed and `getToken()` fails until then —
so asking at the login button guaranteed the first sign-in sent `pushToken:
null`.

### Local notifications (`@notifee/react-native` v9.1.8)

Added `src/services/localNotifications.ts` — display now, schedule for later,
cancel, list scheduled ids, clear badge. This also closes the foreground gap:
FCM draws nothing while the app is open, so foreground messages are now
re-raised through notifee, which is the only reason they're visible.

**The trap here is double-display.** FCM draws `notification`-payload messages
itself when the app is backgrounded, so raising them again duplicates them.
The rule now encoded in `registerBackgroundHandler`:

| Message | State | Drawn by |
|---|---|---|
| has `notification` | foreground | notifee |
| has `notification` | background/quit | the OS |
| data-only | either | notifee |

Taps can't double-fire either — notifee-drawn notifications report through
notifee, OS-drawn ones through FCM, and `onNotificationTap` subscribes to
both, so a local notification deep-links exactly like a push.

Because notifee now *creates* the `fixit_default` channel at launch, the
channel id went back into `firebase.json` (it was removed earlier precisely
because nothing created it). `DEFAULT_CHANNEL_ID` and the `firebase.json` key
must stay in sync — **Android silently drops notifications naming a channel
that doesn't exist.**

`PushPayload` moved to `src/types/notifications.ts`: `pushNotifications` now
imports from `localNotifications`, so leaving the type in the former would
have been circular. Still re-exported from `pushNotifications` so existing
import sites keep working.

## 2026-08-18 — Chat: attachments, voice notes & the rest of the hub contract
Integrated `docs/CHAT_API.md` end-to-end. Gap **#10 → 🟢 Resolved**; four new
backend gaps opened (**#14–#17**).

**Bug found first:** `chatHub.ts` pointed at a hardcoded
`http://localhost:5143/hubs/chat` while `api/axios.ts` builds against
`https://beta.contentdevelopmentpros.com:4125`. Chat could not have connected
on beta at all. The hub URL is now derived from `API_ORIGIN`, so it follows
whichever environment axios is pointed at.

**SignalR (`src/services/chatHub.ts`)** — rewritten, same public shape:
- New invokes `SendMessageWithAttachments` and `SendChatFile` alongside
  `SendMessage` / `MarkAsRead`.
- New `Error` listener — a rejected invoke arrives as an event, not a thrown
  promise, so failures used to vanish silently. Now surfaced to the user.
- Sends **throw** when the socket is down instead of silently returning; the
  screen tells the user rather than pretending it sent.
- Connection state (`connecting`/`connected`/`reconnecting`/`disconnected`)
  is observable, and `UserOnline`/`UserOffline`/`MessagesRead` payloads are
  read defensively (bare number *or* `{userId}` / `{matchId}` object).
- Ref-counted connect/disconnect so the chats list and a chat detail screen
  can both hold the socket without one closing the other's connection.
- Falls back to a negotiated handshake if `skipNegotiation` WebSockets fail.

**Attachments** — `POST /dating/matches/{id}/uploads` (multi, key `files`,
max 10) wired in `src/services/chatAttachments.ts`: pick → stage in a tray →
upload → `SendMessageWithAttachments`. Text and files go as **one** message.
Photos/videos come from `react-native-image-picker` (`mediaType: 'mixed'`,
plus camera capture).

**Voice notes** — added **`react-native-nitro-sound`** (+ `react-native-nitro-modules`).
⚠️ Native dependency: `pod install` has been run, but **the app must be
rebuilt** (not just Metro-reloaded) before voice notes work. Added
`RECORD_AUDIO` + `CAMERA` to `AndroidManifest.xml` and
`NSMicrophoneUsageDescription` / `NSCameraUsageDescription` /
`NSPhotoLibraryUsageDescription` to `Info.plist`. Records AAC/MPEG-4 and
uploads as `.m4a` (`audio/m4a`) so the API classifies it `VoiceNote`.

**Timestamp bug:** hub payloads end in `Z`, REST history has **no zone marker**,
so `new Date()` was reading every historical message as local time — the whole
history was skewed by the device's UTC offset. All chat dates now go through
`parseChatDate` in `src/utils/chatMedia.ts`.

**Screen work (`DatingChatDetailScreen`)** — renders `attachments[]` (with the
legacy `fileUrl` fallback for pre-attachment messages), image/video grid with
a full-screen swipeable viewer, voice-note bubbles with a scrubbing waveform,
day separators, read receipts (✓/✓✓ off `isRead` + `MessagesRead`), history
pagination, and hub-error alerts. The header's "Online" no longer lies — it
used to show the *device's own* socket state; it now shows the peer's presence
only once an event proves it (see #14 — there's no roster to ask).

**Chats list** — rows update live from `ReceiveMessage` (preview, timestamp,
unread badge) and sort by recency, instead of waiting for a focus refetch.

### Follow-up: "Attachment type 'audio/x-m4a' is not allowed."

Every voice note sent from **iOS** was rejected. Two independent causes, both
now understood and pinned down empirically rather than guessed:

1. **RN discards the MIME type you declare on iOS.** For a `{uri, name, type}`
   form part, `RCTNetworking.mm` fetches the file via `RCTFileRequestHandler.mm`,
   derives a MIME from the **local file extension** through UTI, and
   *overwrites* the part's `content-type`. Confirmed with the same CoreServices
   call the handler uses: `.m4a → audio/x-m4a`, `.aac → audio/aac`,
   `.mp3 → audio/mpeg`, `.mp4 → video/mp4`. Android is unaffected —
   `NetworkingModule.constructMultipartBody` parses the declared type off the
   part headers, which is why this only ever failed on iPhone.
2. **The upload endpoint's allow-list is narrower than its docs.** Probed the
   live beta API across 22 MIME types (see gap #18 and the correction block in
   `CHAT_API.md`). `audio/m4a` is accepted; `audio/x-m4a` is not.

**Fix** (`src/utils/uploadPart.ts`): on iOS, audio parts are sent as a
`base64` form part instead of a `uri` part. That branch of
`processDataForHTTPQuery` returns no `contentType`, so the declared
`audio/m4a` survives and the API accepts it. Scoped to audio only — photos
already arrive as re-encoded `.jpg`/`.png` and videos as `.mp4`/`.mov`, all of
which derive an accepted type, and base64 costs memory proportional to file
size (fine for a voice note, not for a 50MB video).

Also added a **pick-time guard** (`isSupportedAttachment`) so choosing a GIF
or HEIC gives an immediate, specific message instead of a failed upload.

### Follow-up 2: "image/jpg can't be sent" on iOS

The guard above was written as an **allow-list**, and it wrongly blocked plain
JPEGs. `react-native-image-picker` builds its MIME by concatenating a *sniffed
extension* onto `"image/"` (`ImagePickerManager.mm`), so every JPEG is reported
as the non-standard **`image/jpg`**.

Probing the API showed this wasn't only a client bug — the server refuses
`image/jpg` too, and matches **case-sensitively** (`image/JPEG` is refused).
So on Android, where the declared type is what actually gets sent, ordinary
photo attachments would have failed as well.

Two changes:
- **`canonicalMime()`** maps the known bad spellings to what the API wants
  (`image/jpg`→`image/jpeg`, `video/mov`→`video/quicktime`,
  `audio/mp3`→`audio/mpeg`, …) and is applied in `assetToStaged`, so the
  *upload itself* is fixed, not just the check.
- The guard is now a **deny-list** of types verified to be refused, not an
  allow-list. Wrongly blocking a file the server would have accepted is worse
  than a late failure, and the server's own message still surfaces. Lesson:
  don't gate on a whitelist inferred from a sample.

Both lists live in one place in `src/services/chatAttachments.ts` —
**revisit them if the backend widens its allow-list (gap #18)**.

### Follow-up 3: picker never opened on iOS

Tapping "Photos & Videos" did nothing on iOS. The attach sheet is a RN
`Modal`, and the handler called `launchImageLibrary` in the same tick as
`setAttachMenuVisible(false)` — so the picker's native view controller tried to
present from a controller that was still dismissing, which iOS ignores
silently. (The app's other pickers are launched from plain buttons, which is
why only this screen was affected.)

Fixed by deferring: the chosen source is parked in `pendingPickRef` and run
from the Modal's **`onDismiss`**, which fires once the sheet is really gone.
`onDismiss` is iOS-only, so Android runs it immediately; a 700ms timer backs it
up, and `runPendingPick` clears the ref before acting so whichever fires first
wins and the other is a no-op. **Any native picker/camera launched from inside
a `Modal` needs this treatment.**

### Follow-up 4: "Vo" clipped in the voice-note bubble

The idle label read `"Voice note"`, but it sits in a slot sized for a `0:00`
timer, and 26 waveform bars (~115pt) pushed the bubble past its `maxWidth` —
so it rendered as "Vo". The label is now always timer-shaped (`--:--` until the
clip has been played once, since attachments carry no duration — gap #15), the
bar count is down to 20, and the waveform yields space before the timer does.

## 2026-08-17 — Integrated backend-delivered gaps #1,2,3,4,6,7,8
Backend shipped these; app side now wired (verified against the live Swagger):
- **#1** `GET /penpal/discover` returns `connectionStatus` → All-tab card shows
  green **Connected** / gray **Pending** badge instead of the Connect button.
  Discover also gained a `status` param (exposed in `penpalApi.discover`).
- **#2** discover returns `age` → passed through the route params to the public
  profile header ("Molly1522, 22"); the `--` placeholder is gone.
- **#3** `GET /penpal/letters?withUserId=` → public-profile thread now fetches
  the per-penpal conversation instead of filtering all letters client-side.
- **#4** `POST /mentor/profile` accepts firstName/lastName/phone/dateOfBirth/
  country/city/state → Mentor Profile Setup submits the whole form (photo still
  via `POST /users/me/profile-image`, fired after the save); Edit Profile also
  sends first/last name.
- **#6** `GET /dating/discover` accepts `Country/InterestedInGender/MinAge/
  MaxAge/DistanceKm/InterestIds` (PascalCase!) → Filter sheet "Apply" refetches
  server-side; the old client-side `filteredUsers` memo was removed.
- **#7** `GET /dating/likes/received` + `/sent` → both tabs render real photo
  grids; a **402/403** on likes-received shows the premium-locked preview.
  Response shape is untyped in Swagger, so rows are read defensively via
  `likeUserId/likeName/likeImage` helpers over a loose `DatingLike` type.
- **#8** `POST /dating/profile` accepts pseudoName/dateOfBirth/country/city/
  state, and `GET /users/me` exposes `gender` → My Profile loads + saves all
  fields and the avatar gender badge is real (male/female icon, person
  fallback).

Still open: **#5** (verify mentor IAP price), **#9** (vetting pass/fail in the
submit response), **#10** (chat attachments — upload endpoint exists, not yet
wired), **#11** (dating IAP + daily-swipe-limit signal; `GET /api/Dating/config`
may cover the limit).

## 2026-08-17 — Phase change: UI done → API integration
- UI phase declared **complete**; [INSTRUCTIONS.md](./INSTRUCTIONS.md)
  rewritten: API integration work is now allowed/expected (wiring existing
  endpoints, updating request/response handling). Flow changes may still come
  later. API_CHANGES_NEEDED stays the backend-gap tracker — resolve rows to 🟢
  rather than deleting; keep xlsx + screen lists in sync.
- Swagger confirmed available: `https://beta.contentdevelopmentpros.com:4125/swagger`
  (99 paths; request bodies typed, most responses untyped — verify via the dev
  API logger in `src/api/logging.ts`).

## 2026-07-06 — Screen inventory docs
- Added [SCREENS_NO_API_CHANGES.md](./SCREENS_NO_API_CHANGES.md) (screens fine
  on the current API) and [SCREENS_API_CHANGES_REQUIRED.md](./SCREENS_API_CHANGES_REQUIRED.md)
  (screens with pending gaps, mapped to API_CHANGES_NEEDED #1–#11). Keep both
  in sync when gaps are added/resolved.
- Welcome screen redesigned to the Figma: `intro.png` circular-people
  illustration (NOT homeGroup.png — that asset is still unused), mail-icon
  Login with Email button. Also: Notifications screen redesigned (pill tabs,
  card list, custom back header, accent follows datingType); spiritual-flow
  illustrations swapped from emoji to real assets (chinaHand/heartHand/
  faceFlower/screen/pathAlighnment/warning/hourglass/load-time/certificate/
  docDecline/document-upload/thumb-up/flower/circularHeart/crownSmall);
  Vetting "Sorry" result matched to Figma (centered, photo avatars);
  Let's Proceed button now scrolls with content; NonSpiritualEntry Male/Female
  pills ("Any" option removed, default Male) + custom back header, same for
  DatingInterestSelection and SpiritualEntry.

## 2026-07-03 — Dating module Figma redesign (Spiritual-Fixit-App Design.pdf, 55 pages)
- **Design source:** `~/Desktop/ReactNative/fixitdata/Spiritual-Fixit-App Design.pdf`
  (+ `Fixit – Complete Flow CR Document`). Rendered pages live in the session
  scratchpad. Per the CR doc, non-spiritual dating logic is unchanged — the
  shared screens now **theme by `datingType`** (`useModuleStatus()`):
  Spiritual → purple/lime, NonSpiritual → pink/amber.
- **Colors:** `Colors.spiritual` **#7B68EE → #624D95** (design purple),
  `spiritualLight` #EFEBF8, + new `spiritualLime` **#D0DF26** and
  `spiritualLimeLight` #F0F5BD (sampled from the PDF).
- **New shared components** (`src/components/dating/`):
  - `DatingTopBar` — hamburger + ⓘ (opens a Dating Tips modal) + bell
    (→ root Notifications), accent-aware.
  - `DatingBottomBar` — floating white pill tab bar (Home/Likes/Chats/Profile)
    per the Figma; navigates between the existing drawer routes (no navigator
    restructure). Active tab = filled accent circle.
- **New screen: `DatingMyProfileScreen`** (drawer route `DatingMyProfile`,
  Profile tab): avatar + badge, read-only names, pseudo name (spiritual only,
  UI-only), Spiritual Bio→`about` (saved), DOB/country/city/state (UI-only,
  gap #8), My Gallery (existing upload/delete image endpoints), Save Changes.
- **Discover:** "Discover & Find Your Perfect Match" heading + filter icon,
  swipe stack kept, action pill (✕ ★ ♥) overlapping card bottom, Figma match
  overlay ("Congratulations! It's a Match", tilted photos), empty state uses
  `spiritual.png` + "That's all for today!", **Filter bottom sheet** (country/
  distance/age sliders (custom, no lib)/gender/locked Advance Filters →
  Premium). Apply = client-side only (gap #6).
- **Matches:** purple/gray pill tabs, 2-col photo-card grid (flag=report,
  chat icon, name overlay), `noActiveUser.png` empty state, Likes Received =
  dark locked cards + "Get a Premium Access", My Likes = empty state (gap #7).
- **Chats:** "My Chats" + search bar (client-side), rows w/ lime "N new
  messages". **Chat detail:** custom header (avatar via getMatches + name +
  Online-when-connected + ⋯ menu w/ Report/Unmatch kept), Today label, Figma
  bubbles (accent right / gray left w/ avatar, time below), lime **Opening
  Move** card on empty chats (own ice-breakers via existing endpoints; tap
  sends it), input w/ attach + mic icons (visual-only, gap #10), image
  messages render from `fileUrl`.
- **Profile detail:** full-bleed rounded photo header (48% screen), back +
  flag → Block/Report popup (block uses existing `/blocks` API — newly wired),
  About/Interest chips/Ice Breakers/Gallery grid, action pill kept.
- **Premium:** full Figma plan card ($20/Month, crown.png, features list,
  Restore Purchases) + active state (My Plan Details, lime Cancel
  Subscription → existing cancel endpoint). Subscribe = "coming soon" alert
  until IAP exists (gap #11).
- **Interest selection** → "Discover Your Resonance": white emoji chips
  (emoji lookup map by name), lime selected. **Ice breakers** → "Configure Ice
  Breaker": checkbox rows, Submit; custom back header.
- **VettingQuiz:** lotus 🪷 step indicator (lime circles + connecting line)
  replaces the bar, pill options (lime selected), full-width Next/"Submit
  Assessment", top back arrow steps back through questions. headerShown:false.
- **Drawer** rebuilt like penpal/mentor: profile header, icon menu (lime/amber
  tint): Home, Penpal, My Subscription, Configure Ice Breaker, Block List,
  Dating Tips and Guidelines (modal), T&C/Privacy (modals), Contact Us/FAQs/
  Change Password (→ root Profile stack), Notifications; accent Logout.
  Old Discover/Matches/Chats menu items superseded by the bottom tab bar.
- **Navigator:** headers hidden for ChatDetail/ProfileDetail/Premium/
  IceBreaker/VettingQuiz; title '' for InterestSelection/SpiritualEntry/
  UploadCertificate. UploadCertificate pending state got a "Back To Home" btn.
- **TS cleanup:** fixed the 3 pre-existing dating TS errors
  (SpiritualEntry 203, VettingQuiz 91 & 225) — only `AppNavigator.tsx(72)`
  remains project-wide (untouched, not ours).
- API gaps logged: #6–#11 in [API_CHANGES_NEEDED.md](./API_CHANGES_NEEDED.md).
  Skipped (need API): daily-limit overlay (pg 26), pseudonym banner (pg 24),
  assigned-mentor detail page (pg 19 — needs mentor contact/dates fields).

## 2026-07-02 — Mentor module Figma redesign
- **MentorSubscription:** bordered plan card (crown medal, "Mentorship Program",
  **$20/Month**, "Subscribe To Become a Guide") + new **Congratulations** success
  state (congratulation.png → Continue). Active/manage state preserved. Native
  header hidden (custom back arrow). Price now $20 (was $9.99) — see
  API_CHANGES_NEEDED #5.
- **MentorDashboard:** custom header (menu + bell), **All/Active/Completed** pill
  tabs ("All" = getAssignedUsers with no status — no API change), photo rows with
  green ✓ (mark completed), **noActiveUser.png** empty state, custom "Are You
  Sure?" modal (lime Cancel / purple Confirm). Kept Remove (as a text link) +
  subscription-required gate. Uses `AssignedUser.profileImageUrl`.
- **MentorDrawerNavigator:** profile header + Ionicons icon menu (lime tint) +
  purple Logout; Terms/Privacy legal modals; hides dashboard native header.
  Kept all functional items (My Seekers, Notifications, etc.). Note: Figma's
  "Home"/"Penpal Group" labels look copy-pasted — used mentor-appropriate labels.
- **MentorProfileSetup:** full Figma form (avatar+camera badge, name+email,
  First/Last, Title, Phone, About, DOB w/ calendar.png + iOS Done bar, Country,
  City, State) + "Save and Subscribe". Char counts kept. **API gap #4**: only
  displayName(first+last)/tagline(title)/bio(about) are submitted; phone/DOB/
  country/city/state/photo are UI-only until the endpoint accepts them.
- All mentor screens type-clean. Icons = Ionicons (needs native rebuild).

## 2026-07-01 — Home + DatingLobby redesign
- **HomeScreen** ("What You Want To Do?") & **DatingLobbyScreen** ("Choose Your
  Path") restyled to the Figma: emoji illustrations replaced with the new PNG
  assets (`dating.png`, `penpal.png`, `nonSpiritual.png`, `spiritual.png`);
  header now uses Ionicons (`notifications-outline`, `log-out-outline`,
  `arrow-back`). Logout confirms then calls `useAuth().logout`. All logic
  preserved (module status, navigation, unread count).
  - Deviation: Figma home header shows only a logout icon; I **kept the
    notification bell** (+ unread badge) beside it to preserve notifications and
    the `fetchUnread` API call (no-remove-API rule).
  - ⚠️ Card labels ("Dating"/"Penpal"/…) use a **script/cursive font** in Figma —
    none exists in the app, so approximated with **bold-italic**. Add a script
    .ttf to assets/fonts + link (react-native-asset) to match exactly.
  - ⚠️ Illustration PNGs assumed transparent; if any has a white background it'll
    show a block on the colored card — verify.

## 2026-07-01 — Vector icons + auth field polish
- **Vector icons enabled (Ionicons).** `react-native-vector-icons` was installed
  but unlinked. Bundled `Ionicons.ttf` (assets/fonts + android assets), added to
  `ios/Fixit/Info.plist`, and ran `npx react-native-asset` to register it in the
  Xcode project. Added `src/types/vector-icons.d.ts` (no shipped types).
  `AppInput` password toggle now uses Ionicons `eye-outline` / `eye-off-outline`.
  ⚠️ **Requires a native rebuild** (iOS + Android) to bundle the font — a Metro
  reload alone won't load it.
  - **iOS:** the RNVectorIcons **pod already bundles all `Fonts/*.ttf`** (podspec
    `s.resources`). So DO NOT manually add the font to the Xcode project /
    assets/fonts — that causes "Multiple commands produce Ionicons.ttf". Only add
    the font name to `ios/Fixit/Info.plist` UIAppFonts so iOS registers it.
    (Initial manual link was removed on 2026-07-01 to fix this build error.)
  - **Android:** keep the `.ttf` in `android/app/src/main/assets/fonts/` (that's
    how it's bundled), or apply vector-icons' `fonts.gradle`.
  - To add another icon set later: add its font name to Info.plist (iOS) + copy
    the .ttf into android assets/fonts (Android). No Xcode/react-native-asset link.
- **RegisterScreen:** DOB & "Where do you live?" select fields restyled to match
  the borderless gray inputs; DOB calendar icon now uses `assets/calendar.png`.
- **DOB date picker fix:** iOS spinner had no dismiss control (stayed open). Added
  a "Done" bar for iOS; Android dialog auto-closes on select.

## 2026-07-01 — Auth (Sign Up / Login) redesign
- **RegisterScreen** restyled to the Figma: "Sign Up" title (logo removed),
  horizontal "Upload Photo" avatar row, relabeled fields ("Email Address",
  "Where do you live?", "Your Gender?"), placeholders ("Enter …"), DOB with red
  calendar icon + red 18+ helper text, gender as radio buttons, "By continuing…"
  T&C checkbox. All register logic/validation/API untouched. **Character counts
  preserved** (AppInput shows charCount/maxLength; kept every field's maxLength).
- **AppInput (SHARED `src/components/common/AppInput.tsx`)** updated to match:
  borderless gray-filled field (border only on error) + password toggle is now an
  **eye icon** (👁, muted→primary when revealed) instead of "Show/Hide" text.
  ⚠️ This restyles inputs **app-wide** (Login, ForgotPassword, Otp, EditProfile,
  etc.) — intended for design consistency.
- **LoginScreen** input fields use the same AppInput; relabeled to "Email
  Address" / "Enter your email address" / "Enter your password".

## 2026-07-01 — Penpal Figma adjustments (round 2)
- **Requests tab:** ✕/✓ buttons changed from circles → red/green rounded squares.
- **Accept-confirm modal (merged screen):** buttons now Cancel (navy, dismiss) /
  Confirm (blue, accept); physical variant shows a consent checkbox that gates Confirm.
- **Public Profile restructured by state** (photo header keeps name+age, location,
  and Remove[red]+pen for connected / pen only otherwise):
  - connected+digital, has letters → Letters Exchanged thread
  - connected+digital, no letters → empty state + "Exchange Letter Now!"
  - connected+physical → "Send Letter To" address
  - received → illustration + "Be Friends And Start Sending Letters" + Decline/Accept
  - sent → "Request Pending" + Cancel Request
  - none/inactive → "Add {name} as a Friend" + Add Friend button
  - ⚠️ Empty-state **illustrations are emoji placeholders** (📭/✍️/📨) — the real
    Figma illustration assets were not in src/assets. Marked with TODO; drop the
    assets in and swap the `illustration` prop.
- **ReportModal (SHARED component, `src/components/common/ReportModal.tsx`)**
  redesigned: radio reason list + "Describe here" (Other) + "Report {Name}" title
  + Report button. Accent is module-aware (Penpal→blue, Dating→dating red), so
  **this also changes the Dating report UI**. Still uses the same `reportUser`
  API (reason string) — no API change. Added optional `reportedName` prop.

## 2026-06-30 — Penpal Figma redesign (kickoff)
- Reviewed 12 Figma screens for the Penpal module. ~90% UI-only; data gaps
  logged in [API_CHANGES_NEEDED.md](./API_CHANGES_NEEDED.md) (#1 connection
  status, #2 age, #3 optional letter-thread endpoint).
- **Decisions made by user:**
  1. **Merge** Discover + Connections into ONE "Find a Kindred Spirit" screen
     with 3 tabs: **All / Requests / Connected** (updates drawer nav).
     Supersedes the earlier "keep 2 tabs" choice.
  2. **Connected badge (All tab):** build UI but show everyone as "Connect" —
     green "Connected" badge waits for API field (gap #1).
  3. **Age:** build "Name, Age" layout but leave age as placeholder until the
     API provides it (gap #2).
- **Per Figma:** the Connected photo-card has only flag + pen (NO remove);
  Remove moves to the public-profile detail screen. (Earlier on-card Remove
  button to be removed.)
- **Handwriting font — decided:** SKIP it. Compose (#10) and letter-detail (#11)
  will use the normal app font (Gilroy/Lexend), not a handwriting/cursive font.
- **Progress — Penpal Figma redesign COMPLETE (all 12 screens):**
  - ✅ Merged "Find a Kindred Spirit" 3-tab screen (`PenpalConnectionsScreen.tsx`),
    nav rewired, `PenpalDiscoverScreen.tsx` deleted.
  - ✅ Public Profile (`PenpalPublicProfileScreen.tsx`): photo header, name+age
    (age placeholder "--" pending gap #2), Letters Exchanged thread (client-side
    filter of `getLetters`), physical "Send Letter To" address, +
    connected/received/sent/none action variants. Added Remove. Fixed the 2
    pre-existing TS errors here.
  - ✅ Compose (`PenpalComposeScreen.tsx`): minimal Title/message, header Send.
  - ✅ Letter detail (`PenpalLetterDetailScreen.tsx`): minimal title/body, header Reply.
  - ✅ Drawer (`PenpalDrawerNavigator.tsx`): profile header (name/email from
    `useAuth`), icon menu (Home, Penpal Group, T&C, Privacy, Contact Us, FAQs,
    Change Password), blue Logout. T&C/Privacy = legal modals (reuse app text);
    Contact/FAQs/ChangePassword → root `Profile` stack.
  - Letters use NORMAL font (handwriting skipped per decision).
  - Penpal module is type-clean. 4 remaining TS errors are PRE-EXISTING in
    non-penpal files (`AppNavigator.tsx`, dating screens) — untouched.

## 2026-06-29
- **Penpal accent color → blue `#3351FD`.** (Supersedes the pink note below.)
  Set the module token `Colors.penpal = '#3351FD'`; also updated
  `penpalLight`→`#EEF1FF`, `penpalSecondary`→`#5B6EF5`, and added
  `penpalMuted`→`#AEB8FB`. Repointed all penpal screens + `PenpalNavigator`
  from `Colors.primary*` → `Colors.penpal*` (7 screens + nav). Other modules
  (auth/dating/main/common) still use `Colors.primary` pink — unchanged.
  - Note: `PenpalEntryScreen` uses a local `const ACCENT = '#4361EE'` (slightly
    different blue) for its title accent + Continue button. Not unified with the
    `#3351FD` token yet — flag if it should be.
  - Pre-existing TS errors in `PenpalPublicProfileScreen` (`cancelActionBtnText`,
    `declineBtnText` style names missing) — unrelated to color work, left as-is.
- **PenpalConnectionsScreen – tab restyle.** Converted the Pending/Accepted
  tabs from an underline style to **pill buttons** (gray inactive, filled
  active) per the new screenshot. Kept 2 tabs with the same labels (user's
  choice). Pure style change.
  - 🎨 **Accent-color note:** the design screenshots use **blue**, but the app's
    brand `Colors.primary` is **pink (#E8386D)**. Defaulted to the app's pink
    for the active pill (and the photo-card buttons) to stay consistent. If the
    app is meant to move to a blue accent, that's a global theme change to
    confirm — flag it and we'll update `Colors`.
- **PenpalConnectionsScreen – Accepted tab redesign.** Reworked the Accepted
  cards into a 2-column photo-card grid matching the new design screenshot:
  report (🚩) top-left, write (🪶) top-right (digital only), username
  bottom-left, and a new **Remove (🗑️)** button bottom-right. Uses the existing
  `receiverImageUrl`/`requesterImageUrl` from the API (no API change). All
  handlers (write/remove/report) untouched.
  - ⚠️ **Open UX question:** the old card showed the **mailing address** for
    *Physical* penpals. The new photo-card design has no room for it, so it's
    currently not shown. Need to decide how to surface the address (e.g. tap
    card → details screen). Not an API issue — data is already returned.
- Created `docs/` with [INSTRUCTIONS.md](./INSTRUCTIONS.md),
  [API_CHANGES_NEEDED.md](./API_CHANGES_NEEDED.md), and this log.
- Confirmed scope: **UI changes only** — no API integration code is to be
  modified. API-related change requests get logged in `API_CHANGES_NEEDED.md`.

<!-- Add new dated sections above this line. -->
