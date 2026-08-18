# Project Instructions

This file holds standing instructions for working on the **AIFixitMobileApp**.
Read this before making any changes.

---

## Phase status

- **Phase 1 — UI (COMPLETE, 2026-08-17):** All modules (auth, home/shared,
  dating incl. spiritual flow, penpal, mentor) have been matched to the Figma
  designs. The old "UI-only, never touch API code" rule from this phase is
  **retired**.
- **Phase 2 — API integration (CURRENT):** We are now integrating and updating
  the API integrations. Some **flow changes may still be requested later**, so
  keep screens flexible and don't assume the current navigation/flows are final.

## 1. API integration work is now allowed

- Wiring **existing endpoints** into screens, updating request/response
  handling, and integrating backend capabilities the app never used
  (e.g. `POST /api/Dating/matches/{matchId}/upload` for chat attachments)
  is now in scope.
- Use the Swagger as the source of truth for the contract:
  `https://beta.contentdevelopmentpros.com:4125/swagger`
  (spec: `/swagger/v1/swagger.json`). Note most **response schemas are
  untyped** there — verify real response shapes with the dev API logger
  (`src/api/logging.ts`, logs every request/response in Metro) before relying
  on them.
- Keep changes incremental and don't break working flows: auth/token refresh
  (`src/api/axios.ts`), SignalR chat (`src/services/chatHub.ts`), and the
  existing happy paths should keep working after every change.

## 2. Keep the trackers up to date

- [API_CHANGES_NEEDED.md](./API_CHANGES_NEEDED.md) stays the shared list of
  **backend** changes we're waiting on (fields, params, new endpoints).
  - When a gap is resolved (backend shipped it, or we integrated an existing
    endpoint), mark the row 🟢 Resolved with a date instead of deleting it.
  - When new backend needs surface during integration work, add a row
    (include the **endpoint** column).
  - Keep the `.xlsx` exports and the screen lists
    ([SCREENS_API_CHANGES_REQUIRED.md](./SCREENS_API_CHANGES_REQUIRED.md) /
    [SCREENS_NO_API_CHANGES.md](./SCREENS_NO_API_CHANGES.md)) in sync when
    rows change.
- [MEMORY_LOG.md](./MEMORY_LOG.md) — keep logging notable work/decisions per
  session, as before.
