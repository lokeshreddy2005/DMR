# Phase 2: Frontend Integration Plan (v2)

This plan details the frontend architecture needed to integrate the advanced filtering, server-side pagination, and omni-fetcher we built in Phase 1. It utilizes scalable UI patterns tailored for large document repositories.

## 1. Unified Fetching Logic
Currently, `fetchDocuments()` uses `if/else` logic to call different endpoints (e.g., `/search?q=` vs `?space=organization`).
* **Implementation:** We will rewrite `fetchDocuments()` to **always** call `GET /api/documents` (or `/api/public/documents`). 
* **Dynamic Query Construction:** We will map the URL `searchParams` directly to the `axios` call. Any filter a user sets in the UI will automatically be read from the URL and passed to the backend Omni-fetcher.

## 2. Server-Side Pagination
Currently, pagination is simulated in the browser: `const paginatedDocuments = displayedDocuments.slice(...)`. 
* **Implementation:** 
  - Remove all client-side slicing. 
  - `Workspace.jsx` state will hold `documents`, `currentPage`, and `totalPages` pulled directly from the backend `res.data`.
  - The Next/Previous buttons will trigger `setSearchParams({ page: newPage })` which natively fires a new backend fetch.

## 3. Removing Client-Side Local Search
* **Implementation:** Delete the `displayedDocuments` client-side `filter()` block entirely. The backend now handles `q=`, so all text searching executes securely on MongoDB.

## 4. Advanced Search UI (Google Drive Style)
To keep the UI clean and handle millions of potential tags securely.
* **Implementation:** 
  - **The Toggle:** Add a "Filter/Options" icon button directly inside the right side of the existing main Search Bar.
  - **The Popover:** Clicking the icon opens a floating popover window directly beneath the search bar containing advanced criteria.
  - **Low-Cardinality Controls (UI Dropdowns):**
    * Type Dropdown (Maps to `extension`)
    * Date Pickers (Maps to `startDate` / `endDate`)
    * Size Thresholds (Maps to `minSize` / `maxSize`)
    * `isTagged` boolean toggle (For Admins to find failed AI runs)
  - **High-Cardinality Controls (Autocomplete Search):**
    * *Tags:* Because there could be millions of tags, we will not use a dropdown. We will build an Autocomplete input. Typing pings an `/api/tags/search` endpoint to show suggestions.
    * *Uploaded By:* Typing a name pings an `/api/users/search` endpoint to show matching workspace members.
  - **Execution:** Changing a control updates React Router's `setSearchParams(newParams)`, instantly triggering a refetch safely via the URL.

## 5. Parity for `routes/public.js`
* **Implementation:** Copy the Omni-Fetcher logic we built in Phase 1A into `server/routes/public.js`. Remove the JWT/Ownership checks, but retain all the size/date/extension/search query parsing. This ensures public visitors get the exact same powerful filtering capabilities as logged-in users.
