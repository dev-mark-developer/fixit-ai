# Memory Log

A running log of notes, decisions, and context shared between you and me while
doing UI work on **AIFixitMobileApp**. Newest entries at the top.

---

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
