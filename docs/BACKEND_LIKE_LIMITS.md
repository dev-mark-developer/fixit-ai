# Like & Super Like Daily Limits — Backend Changes

**For:** backend team · **Raised:** 2026-09-11 · **Tracker:** gaps #22 and #33 in
[API_CHANGES_NEEDED.md](./API_CHANGES_NEEDED.md) · **Excel copy:**
[BACKEND_LIKE_LIMITS.xlsx](./BACKEND_LIKE_LIMITS.xlsx) (keep it in sync with this file)

## The requirement

On Discover a user can **Like**, **Super Like** or **Pass** on a profile. The
admin panel sets how many likes and how many super likes a user gets per day,
with **different numbers for free and premium** users. Passing is not limited.

## What the API does today

### Swagger (checked 2026-09-11)

| Endpoint | What Swagger documents |
|---|---|
| `POST /api/Dating/swipe` | Body `RecordSwipeRequest { swipedUserId: int, action: string }`. Response: **200 OK only**, untyped |
| `GET /api/Dating/config` | "200 OK", untyped |
| `GET /api/admin/settings` · `PUT /api/admin/settings/{key}` | Body `{ settingValue: string }`. Setting keys aren't listed |

### Live test on beta (2026-09-11)

Account `sp3@yopmail.com`: free, Spiritual profile, no swipes before the test.
Its Discover deck had only two people, so the 10-swipe limit couldn't be reached.

| # | Request | Result |
|---|---|---|
| 1 | `SuperLike` user 84 | **200** — `{ "isMatch": false, "matchId": null, "dailySwipeLimit": 10, "swipesUsedToday": 1, "swipesRemainingToday": 9, "isPremium": false }` |
| 2 | `SuperLike` user 189 | **400** — `{ "success": false, "message": "You have reached your daily limit of 1 super likes. Upgrade to Premium for more.", "errors": null }` |
| 3 | `Like` user 189 | **200** — `{ "isMatch": true, "matchId": 26, "dailySwipeLimit": 10, "swipesUsedToday": 2, "swipesRemainingToday": 8, "isPremium": false }` |

What that shows:

- **The limits are enforced.** Free users get 1 super like and 10 swipes a day.
- **A super like also counts as a swipe.** Step 1 took `swipesUsedToday` from 0 to 1.
- **The refused super like didn't count.** The count only moved to 2 with the like in step 3.
- **Running out of super likes doesn't block likes** (step 3).
- **The refusal is a 400 with no error code.** The contract agreed with the
  client was 402/403. The API also uses 400 for other failures (e.g.
  `GET /api/Dating/discover` answers 400 "Please set up your dating profile
  before discovering."), so the app can only recognise a limit by the wording
  of `message`.
- **The swipe response already carries swipe counters** (`dailySwipeLimit`,
  `swipesUsedToday`, `swipesRemainingToday`, `isPremium`). There's nothing for
  super likes, no reset time, and none of it is in Swagger.
- `GET /api/Dating/config` returns only `{ "maxGalleryImages": 4 }`, so the app
  can't learn the limits before swiping.

**Not tested yet:** what the 11th swipe returns, whether a **Pass** counts
toward the 10, when the count resets, and the premium values.

Also seen in the same session: `GET /api/Dating/likes/received` returned the
full list to this **free** account (200 with data), so the premium gate on
Likes Received isn't enforced (gap #23).

## What the app does now

Implemented 2026-09-11 (`DatingDiscoverScreen`, `src/utils/swipeLimits.ts`).

- A refused swipe counts as "that allowance is spent" when it is a **402/403**
  (the agreed contract) or a **400 whose `message` contains "daily limit"**
  (what the API actually sends). The wording match is a stopgap: rewording the
  message breaks it.
  - A refused `Like` → the card goes back, the "You Have Reached Your Daily
    Limit!" cover shows, and ♥ is dimmed.
  - A refused `SuperLike` → the card goes back, an "Out of Super Likes" alert
    shows, and ⭐ is dimmed. Likes keep working.
  - A `Pass` is never treated as limited.
- Any other failure is treated as transient.
- The block lifts at the device's **local midnight** (a guess), or when the user
  buys premium. If the server hasn't reset yet, the next swipe is refused again.
- The free numbers are **hardcoded** on the Non-Spiritual entry screen: "10 free
  swipes per day" and "1 super like per day". They match beta today, but won't
  follow an admin change.

## Changes needed

### 1. Give the refusal an error code

Keep the message, but add a machine-readable code, and preferably use **403** as
agreed with the client. For example:

```json
HTTP 403
{
  "success": false,
  "message": "You have reached your daily limit of 1 super likes. Upgrade to Premium for more.",
  "data": {
    "code": "SUPERLIKE_LIMIT_REACHED",
    "limit": 1,
    "resetsAt": "2026-09-12T00:00:00Z"
  }
}
```

- `code` is `SWIPE_LIMIT_REACHED` (the daily 10) or `SUPERLIKE_LIMIT_REACHED`.
  Nothing else should use these codes.
- Add the error response to Swagger.

### 2. Return super-like counters and the reset time

The swipe response already has the swipe counters. Add the super-like ones and
`resetsAt`, and document the whole response in Swagger:

```json
{
  "isMatch": false,
  "matchId": null,
  "isPremium": false,
  "dailySwipeLimit": 10,
  "swipesUsedToday": 1,
  "swipesRemainingToday": 9,
  "dailySuperLikeLimit": 1,
  "superLikesUsedToday": 1,
  "superLikesRemainingToday": 0,
  "resetsAt": "2026-09-12T00:00:00Z"
}
```

### 3. Return the same counters from `GET /api/Dating/config`

Put them next to `maxGalleryImages`, so the app knows the limits before the
first swipe. It can then show the real numbers instead of hardcoded ones and
dim ♥/⭐ up front. Use `null` for unlimited.

### 4. Confirm the rules

- **Does a Pass count toward `dailySwipeLimit`?** The requirement is that passes
  aren't limited, but the name "swipes" suggests they might be.
- **Is the 10 a limit on likes or on all swipes?** The admin panel, the API and
  the app copy should use the same word.
- **When does the count reset?** Midnight UTC, the user's local midnight, or a
  rolling 24 hours. Return `resetsAt` as UTC with a `Z` (see gap #30).
- Do Spiritual and Non-Spiritual dating share the same limits?
- Which admin setting keys hold these values, and does a change apply
  immediately?

### 5. Test data

- A **premium** account with a dating profile, to check the premium values.
- A deck with more than 10 people, or a temporarily lower limit on beta (e.g.
  2 swipes), to test the swipe limit.
- For reference: `chat.michael@yopmail.com` in [CHAT_API.md](./CHAT_API.md) is
  deactivated, and `sp2@yopmail.com` has no dating profile.

## Questions for the client

- **Is premium ever unlimited?** The Figma copy says "Unlimited Likes" (Premium
  screen) and "Try Premium subscription for unlimited swaps and filters" (limit
  cover). If premium has a cap, both need new wording.
- Should Pass stay unlimited? (Assumed yes.)

## Acceptance checklist

- [x] Free user: the 2nd super like of the day is refused, and likes still work afterwards (verified 2026-09-11).
- [x] A refused swipe doesn't use up allowance (verified 2026-09-11).
- [ ] Free user: the 11th swipe is refused with `SWIPE_LIMIT_REACHED`.
- [ ] Refusals carry a `code` (item 1) and are documented in Swagger.
- [ ] A Pass is never refused for a limit.
- [ ] A premium user gets the premium values.
- [ ] The count resets when `resetsAt` says.
- [ ] Limits and usage come back from the swipe response and `GET /api/Dating/config` (items 2–3).

## What the app will do once this ships

- Read `code` instead of matching the message text.
- Load the limits on Discover focus, dim ♥/⭐ up front, and show the admin
  numbers on the Non-Spiritual entry screen.
- Lift the block at `resetsAt` instead of local midnight.
