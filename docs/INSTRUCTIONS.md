# Project Instructions

This file holds standing instructions for working on the **AIFixitMobileApp**.
Read this before making any changes.

---

## 1. Do NOT touch API integration work

- This project is a **UI-only** effort. We are only making **UI changes across the whole app**.
- **Never** remove, comment out, uncomment, replace, or otherwise modify any
  **API integration related code** — this includes:
  - API calls / network requests (fetch, axios, services, etc.)
  - Endpoints, base URLs, and request/response handling
  - API keys, tokens, and auth/integration logic
  - Data-fetching hooks, state wiring tied to API responses
- If a UI change *seems* to require touching API code, **stop and do not change it**.
  Instead, log it in [API_CHANGES_NEEDED.md](./API_CHANGES_NEEDED.md) (see instruction 2).

## 2. Track API/endpoint/screen changes that are needed

- If, while doing UI work, you find that an **API, endpoint, or screen with API
  integration needs a change**, do not make the change.
- Record it instead in the shared memory files:
  - [API_CHANGES_NEEDED.md](./API_CHANGES_NEEDED.md) — things that need to change.
  - [MEMORY_LOG.md](./MEMORY_LOG.md) — running log of notes/decisions for both of us.
