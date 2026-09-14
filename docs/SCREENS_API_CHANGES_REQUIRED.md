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
| Discover ("Find Your Perfect Match") | `src/screens/dating/DatingDiscoverScreen.tsx` | #6, #11, #22, #33 | Filter sheet needs server-side discover params (country/distance/age/gender/interests) — Apply currently filters only the loaded page client-side. Like / super-like limits: the app only learns one ran out from a refused swipe (live: a 400 whose message says "daily limit"); the admin-set numbers aren't exposed before the first swipe, so ♥/⭐ can't be dimmed up front ([BACKEND_LIKE_LIMITS.md](./BACKEND_LIKE_LIMITS.md)). Pseudonym banner (Figma pg 24) also needs #8. |
| Non-Spiritual Entry (profile setup) | `src/screens/dating/NonSpiritualEntryScreen.tsx` | #33 | The features card hardcodes "10 free swipes per day" and "1 super like per day". The real numbers are set in the admin panel and no endpoint returns them yet ([BACKEND_LIKE_LIMITS.md](./BACKEND_LIKE_LIMITS.md)). |
| My Matches | `src/screens/dating/DatingMatchesScreen.tsx` | #7 | "Likes Received" (premium) and "My Likes" tabs need endpoints for who-liked-me / who-I-liked. Both tabs currently show placeholder/locked states. |
| My Profile (bottom-nav Profile tab) | `src/screens/dating/DatingMyProfileScreen.tsx` | #8 | `POST /dating/profile` should accept pseudoName, dateOfBirth, country, city, state; auth user should expose gender for the avatar badge. Those fields are collected but NOT submitted (only bio/gallery save today). |
| Vetting Quiz | `src/screens/dating/VettingQuizScreen.tsx` | #9 | `POST /dating/vetting/submit` should return pass/fail so the "Congratulations! Profile Approved" screen (Figma pg 20) can show — currently every submission lands on the "Sorry" + mentors path. |
| Chat Detail | `src/screens/dating/DatingChatDetailScreen.tsx` | ~~#10~~, #14, #15, #16, #17 | ~~Sending image/voice messages~~ **shipped 2026-08-18** — photos, videos and voice notes all send (upload → `SendMessageWithAttachments`). Still waiting on: a **presence roster** so the header can show Online before the peer sends anything (#14); a **duration** on audio/video attachments so a voice bubble shows its length before playback (#15); `UserOnline`/`UserOffline` scoped to matches instead of broadcast (#16); a single-match endpoint for the header avatar (#17). |
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
