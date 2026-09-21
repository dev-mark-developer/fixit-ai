# Like & Super Like Daily Limits — Backend Changes

**For:** backend team · **Raised:** 2026-09-11 · **Updated:** 2026-09-14 ·
**Tracker:** gaps #22 and #33 in [API_CHANGES_NEEDED.md](./API_CHANGES_NEEDED.md) ·
**Excel copy:** [BACKEND_LIKE_LIMITS.xlsx](./BACKEND_LIKE_LIMITS.xlsx) (keep it in
sync with this file)

## The requirement

On Discover a user can **Like**, **Super Like** or **Pass** on a profile. The
admin panel sets how many likes and how many super likes a user gets per day,
with **different numbers for free and premium** users. Passing was not meant to
be limited, but a pass uses up a swipe, and as of 2026-09-14 the app blocks
passes too once the swipes are gone.

## Where things stand (2026-09-14)

| # | Change | Status |
|---|---|---|
| 1 | The limit refusal carries an error code | 🔴 **Not done** — tested: still a 400 with only a message |
| 2 | The swipe response returns super-like counters and `resetsAt` | 🟢 **Done** — tested |
| 3 | `GET /api/Dating/config` returns the limits and today's usage | 🟡 **Partly done** — limits yes, usage no |
| 4 | The swipe response, refusal and config are documented in Swagger | 🔴 **Not done** |
| 5 | Test data | 🟡 Still need a free account with 3+ people in its deck, and a premium account |

**Passes:** a pass uses up a swipe (tested). Decided 2026-09-14 to keep it that
way — the app now blocks ✕ once the swipes are gone, along with ♥ and ⭐.

## What the API does today

### Live test on beta (2026-09-14)

Account `nons@yopmail.com`: free, Non-Spiritual, no swipes before the test. Beta
limits for free accounts: 2 swipes and 1 super like a day. Its Discover deck had
only two people, so the refusal for the swipe *after* the limit couldn't be
tested.

| # | Request | Result |
|---|---|---|
| 1 | `SuperLike` user 73 | **200** — `{ "isMatch": false, "matchId": null, "isPremium": false, "dailySwipeLimit": 2, "swipesUsedToday": 1, "swipesRemainingToday": 1, "dailySuperLikeLimit": 1, "superLikesUsedToday": 1, "superLikesRemainingToday": 0, "resetsAt": "2026-09-15T00:00:00Z" }` |
| 2 | `SuperLike` user 254 | **400** — `{ "success": false, "message": "You have reached your daily limit of 1 super likes. Upgrade to Premium for more.", "errors": null }` |
| 3 | `Ignore` user 254 | **200** — as step 1, but `"swipesUsedToday": 2, "swipesRemainingToday": 0` |

What that shows:

- **Change 2 is done.** The response carries the super-like counters and
  `resetsAt`, which is midnight UTC.
- **Change 1 isn't.** The refusal is still a 400 with only a message and no
  `code`, so the app still has to recognise it by its wording.
- **A Pass uses up a swipe.** Step 3 took `swipesUsedToday` from 1 to 2.
- **A super like uses up a swipe too** (step 1), and the refused super like in
  step 2 wasn't counted or saved.

### `GET /api/Dating/config` (2026-09-14)

It returns the admin limits, but not today's usage. The `data` it returned:

```json
{
  "freeSuperLikesPerDay": 1,
  "freeSwipesPerDay": 2,
  "maxDatingImages": 6,
  "maxGalleryImages": 5,
  "maxIceBreakers": 1,
  "otpExpiryMinutes": 10,
  "otpLength": 6,
  "premiumSuperLikesPerDay": 5,
  "premiumSwipesPerDay": 2,
  "supportEmail": "support@email.com",
  "trialDays_DatingNonSpiritual": 3,
  "trialDays_DatingSpiritual": 3,
  "vettingPassScore": 10
}
```

The swipe limits are lowered on beta for testing.

### Swagger (checked 2026-09-11, unchanged on 2026-09-14)

| Endpoint | What Swagger documents |
|---|---|
| `POST /api/Dating/swipe` | Body `RecordSwipeRequest { swipedUserId: int, action: string }`. Response: **200 OK only**, untyped |
| `GET /api/Dating/config` | "200 OK", untyped |
| `GET /api/admin/settings` · `PUT /api/admin/settings/{key}` | Body `{ settingValue: string }`. Setting keys aren't listed |

### First live test (2026-09-11)

Account `sp3@yopmail.com`: free, Spiritual profile. At the time free accounts got
10 swipes and 1 super like a day.

| # | Request | Result |
|---|---|---|
| 1 | `SuperLike` user 84 | **200** — `{ "isMatch": false, "matchId": null, "dailySwipeLimit": 10, "swipesUsedToday": 1, "swipesRemainingToday": 9, "isPremium": false }` |
| 2 | `SuperLike` user 189 | **400** — `{ "success": false, "message": "You have reached your daily limit of 1 super likes. Upgrade to Premium for more.", "errors": null }` |
| 3 | `Like` user 189 | **200** — `{ "isMatch": true, "matchId": 26, "dailySwipeLimit": 10, "swipesUsedToday": 2, "swipesRemainingToday": 8, "isPremium": false }` |

That showed the limits are enforced, a refused swipe isn't counted, and running
out of super likes doesn't block likes. At the time the response had only the
swipe counters, and `GET /api/Dating/config` returned only
`{ "maxGalleryImages": 4 }`.

Also seen in that session: `GET /api/Dating/likes/received` returned the full
list to this **free** account (200 with data), so the premium gate on Likes
Received isn't enforced (gap #23).

## What the app does now

Updated 2026-09-14 (`DatingDiscoverScreen`, `NonSpiritualEntryScreen`,
`src/utils/swipeLimits.ts`).

- **After each successful swipe** the app reads the counters. No swipes left →
  ♥, ✕ and ⭐ are dimmed. No super likes left → ⭐ is dimmed. Some left → the block
  lifts. It remembers `resetsAt` and lifts the block then.
- **Before any counters have come back** (the first swipe of a session), a
  refused swipe counts as "that allowance is spent" when it is a **402/403**, or
  a **400 whose `message` contains "daily limit"**. The wording match is a
  stopgap until change 1 ships.
- **Trying to like or pass with no swipes left** puts the card back and shows
  the "You Have Reached Your Daily Limit!" cover. A super like does the same once
  the swipes are gone.
- **Trying to super like with only the super likes gone** puts the card back and
  shows an "Out of Super Likes" alert. Likes keep working.
- **Passes are blocked once the swipes are gone** (since 2026-09-14), because a
  pass uses up a swipe.
- **Any other failure** puts the card back and shows the server's `message` in a
  toast (since 2026-09-15), so a readable message matters.
- The block is saved on the device with its reset time, so it survives the app
  being closed and reopened. It lifts at `resetsAt`, or at the next midnight UTC
  when no `resetsAt` has been seen, which matches the server.
- The Non-Spiritual entry screen shows the free numbers from
  `GET /api/Dating/config`.

## Changes needed

### 1. Give the refusal an error code — not done

Tested 2026-09-14: the refusal is still a 400 with only a message. Keep the
message, but add a machine-readable code, and preferably use **403** as agreed
with the client. For example:

```json
HTTP 403
{
  "success": false,
  "message": "You have reached your daily limit of 1 super likes. Upgrade to Premium for more.",
  "data": {
    "code": "SUPERLIKE_LIMIT_REACHED",
    "limit": 1,
    "resetsAt": "2026-09-15T00:00:00Z"
  }
}
```

- `code` is `SWIPE_LIMIT_REACHED` (the daily swipes) or
  `SUPERLIKE_LIMIT_REACHED`. Nothing else should use these codes.
- Add the error response to Swagger.

### 2. Return super-like counters and the reset time — done

Tested 2026-09-14: the swipe response carries `dailySuperLikeLimit`,
`superLikesUsedToday`, `superLikesRemainingToday` and `resetsAt`
(`"2026-09-15T00:00:00Z"`). Only the Swagger documentation is left (change 4).

### 3. Return today's usage from `GET /api/Dating/config` — partly done

The limits are there (`freeSwipesPerDay`, `freeSuperLikesPerDay`,
`premiumSwipesPerDay`, `premiumSuperLikesPerDay`). Add the usage fields the swipe
response already has (`swipesUsedToday`, `swipesRemainingToday`,
`superLikesUsedToday`, `superLikesRemainingToday`, `resetsAt`), so the app knows
where the user stands before their first swipe of a session and can dim ♥/⭐
straight away. Use `null` for unlimited.

### 4. Document the responses in Swagger — not done

The swipe response, the limit refusal and `GET /api/Dating/config` are all still
documented as a bare "200 OK".

### 5. Test data

- A **free** account with at least 3 people in its Discover deck, to test the
  refusal for the swipe after the limit. (`sp3@yopmail.com` and
  `nons@yopmail.com` have now swiped everyone in theirs.)
- A **premium** account with a dating profile, to check the premium values.
- For reference: `chat.michael@yopmail.com` in [CHAT_API.md](./CHAT_API.md) is
  deactivated, and `sp2@yopmail.com` has no dating profile.

## Questions for the backend

- ~~Should a Pass use up a swipe?~~ Decided 2026-09-14: yes, as the backend
  already does. The app blocks passes once the swipes are gone.
- **Is a Pass refused once the swipes run out?** Not tested yet. The app no
  longer sends one when it knows the swipes are gone, but it should get the same
  refusal as a like if it does.
- Do Spiritual and Non-Spiritual dating share the same limits?
- Which admin setting keys hold these values, and does a change apply
  immediately?
- ~~When does the count reset?~~ Answered: midnight UTC (`resetsAt`, tested
  2026-09-14).

## Questions for the client

- **Is premium ever unlimited?** The Figma copy says "Unlimited Likes" (Premium
  screen) and "Try Premium subscription for unlimited swaps and filters" (limit
  cover). If premium has a cap, both need new wording. On beta, config currently
  gives premium 2 swipes and 5 super likes a day, so that wording is wrong there.
- ~~Should a Pass count toward the daily limit?~~ Decided 2026-09-14: yes.

## Acceptance checklist

- [x] Free user: the 2nd super like of the day is refused, and likes still work afterwards (verified 2026-09-11).
- [x] A refused swipe doesn't use up allowance (verified 2026-09-11 and 2026-09-14).
- [x] `GET /api/Dating/config` returns the free and premium limits (verified 2026-09-14).
- [x] The swipe response carries super-like counters and `resetsAt` (verified 2026-09-14).
- [ ] Refusals carry a `code` and are documented in Swagger.
- [ ] Free user: the swipe after the daily limit is refused with `SWIPE_LIMIT_REACHED`.
- [x] A pass uses up a swipe (verified 2026-09-14).
- [ ] A pass after the daily limit is refused the same way as a like.
- [ ] A premium user gets the premium values.
- [ ] `GET /api/Dating/config` includes today's usage.

## What the app will do once this ships

- Read `code` instead of matching the message text.
- Read today's usage from `GET /api/Dating/config` on Discover focus, and dim
  ♥/⭐ before the first swipe of a session.
