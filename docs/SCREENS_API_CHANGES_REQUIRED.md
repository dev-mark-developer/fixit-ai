# Screens — API Changes Required

These screens have UI built to the Figma, but parts of them are **waiting on
backend/API changes**. The UI works today with the existing API; the listed
gap explains what's missing or collected-but-not-saved.

Each gap number (#) refers to the corresponding row in
[API_CHANGES_NEEDED.md](./API_CHANGES_NEEDED.md), which has the full detail.

> Counterpart file: [SCREENS_NO_API_CHANGES.md](./SCREENS_NO_API_CHANGES.md)

## Dating
| Screen | File | Gap # | What's waiting on the API |
|--------|------|-------|---------------------------|
| Discover ("Find Your Perfect Match") | `src/screens/dating/DatingDiscoverScreen.tsx` | #6, #11 | Filter sheet needs server-side discover params (country/distance/age/gender/interests) — Apply currently filters only the loaded page client-side. Daily-swipe-limit overlay needs a limit signal from the API. Pseudonym banner (Figma pg 24) also needs #8. |
| My Matches | `src/screens/dating/DatingMatchesScreen.tsx` | #7 | "Likes Received" (premium) and "My Likes" tabs need endpoints for who-liked-me / who-I-liked. Both tabs currently show placeholder/locked states. |
| My Profile (bottom-nav Profile tab) | `src/screens/dating/DatingMyProfileScreen.tsx` | #8 | `POST /dating/profile` should accept pseudoName, dateOfBirth, country, city, state; auth user should expose gender for the avatar badge. Those fields are collected but NOT submitted (only bio/gallery save today). |
| Vetting Quiz | `src/screens/dating/VettingQuizScreen.tsx` | #9 | `POST /dating/vetting/submit` should return pass/fail so the "Congratulations! Profile Approved" screen (Figma pg 20) can show — currently every submission lands on the "Sorry" + mentors path. |
| Chat Detail | `src/screens/dating/DatingChatDetailScreen.tsx` | #10 | Sending image/voice messages needs an upload endpoint or SignalR support. Attach + mic icons are visual-only; incoming image messages already render. |
| Profile Detail (opened from Likes) | `src/screens/dating/DatingProfileDetailScreen.tsx` | #13 | Needs a "get another user's dating profile" endpoint. From swiping the screen is complete (discover carries About/interests/gallery); from My Likes / Likes Received only summary fields exist, so those sections are hidden. |
| Any screen showing profile photos | `src/components/common/RemoteImage.tsx` | #12 | `profileImageUrl` paths (e.g. `/profiles/{id}/{guid}.png`) 404 on the API host — static hosting not configured or files missing. Cards fall back to initials. |
| Premium ("Subscription Plan") | `src/screens/dating/DatingPremiumScreen.tsx` | #11 | Dating IAP product doesn't exist yet — "Subscribe Now!" shows a coming-soon alert. Status/cancel already use the existing subscription endpoints. |

## Penpal
| Screen | File | Gap # | What's waiting on the API |
|--------|------|-------|---------------------------|
| Find a Kindred Spirit (All tab) | `src/screens/penpal/PenpalConnectionsScreen.tsx` | #1 | Discover response needs a per-user `connectionStatus` so the green "Connected" badge can show (everyone renders as "Connect" today). |
| Public Profile | `src/screens/penpal/PenpalPublicProfileScreen.tsx` | #2, #3 | Age missing from penpal responses (header shows "--"). Optional: dedicated per-penpal conversation endpoint (currently client-side filter of `getLetters`). |

## Mentor
| Screen | File | Gap # | What's waiting on the API |
|--------|------|-------|---------------------------|
| Mentor Profile Setup ("Ready To Begin?") | `src/screens/mentor/MentorProfileSetupScreen.tsx` | #4 | `mentorApi.saveProfile` only accepts displayName/bio/tagline — firstName/lastName/title/phone/DOB/country/city/state/photo are collected but NOT saved. |
| Mentor Subscription | `src/screens/mentor/MentorSubscriptionScreen.tsx` | #5 | Verify the $20/Month label matches the real store IAP product price. |

<!-- Keep in sync with API_CHANGES_NEEDED.md — when a gap is resolved (🟢),
     move the screen to SCREENS_NO_API_CHANGES.md if no other gaps remain. -->
