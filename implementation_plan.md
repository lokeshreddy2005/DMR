# Advanced Document Filtering Implementation Plan (v2)

This document outlines the step-by-step technical implementation for the advanced filtering capabilities. It incorporates your design decisions regarding seamless search integration, database optimizations for tracking, and enhanced metadata extraction.

## Phase 1A: Non-Relational Filtering, Pagination, and Search Integration

These properties live directly on the `Document` schema as primitives (strings, numbers, dates).

### Target Files
* `server/routes/documents.js`
* `server/models/Document.js` (Optional schema tweak for extension)

### Implementation Details
We will update the `GET /api/documents` endpoint to become an **all-in-one fetcher** that merges standard query parameters with fuzzy search logic. 

* **Seamless Search Integration (`q`):**
  - If `req.query.q` exists, we will inject your existing regex search logic (searching across `fileName`, `tags`, `description`, etc.) into the main query object using `$and`.
* **File Extension Extraction (New Feature):**
  - During `POST /upload`, we will extract the exact extension using `path.extname(req.file.originalname)`.
  - We will save this into `metadata.extension` (e.g., `.pdf`) so the frontend dropdowns can filter easily without relying on complex `mimeType` strings.
* **Pagination:**
  - Extract `page` and `limit` from `req.query`.
  - Apply `.skip((page - 1) * limit).limit(limit)`.
  - Execute a parallel `Document.countDocuments(query)` to return `totalCount` and compute `totalPages`.
* **File Size & Upload Date (Ranges):**
  - Extract `minSize`, `maxSize`, `startDate`, and `endDate`.
  - Apply `$gte` and `$lte` accordingly.
* **Basic Properties:**
  - `extension` and custom fields like `metadata.departmentOwner`: Exact string match integration.

## Phase 1B: Relational & Permission Filtering

These properties rely on linking Object IDs from the `Document` schema to the `User` and `Organization` collections, as well as checking embedded permission arrays.

### Target Files
* `server/routes/documents.js`

### Implementation Details
Within the unified `GET /api/documents` endpoint:

* **Uploaded By (`uploadedBy`):**
  - Append specific User ID filter: `query.uploadedBy = req.query.uploadedBy`.
* **Organization (`organization`):**
  - Append specific Org ID filter: `query.organization = req.query.organizationId`.
* **Permission Level (`permissionLevel`):**
  - If the user only wants to see files where they have 'editor' access, use array matching:
    `query.permissions = { $elemMatch: { user: req.user._id, level: req.query.permissionLevel } }`

## Phase 1C: Usage Tracking Schema (Recently Used)

This phase introduces active, highly-optimized tracking to allow users to see what they recently opened/viewed without bloating the database.

### Target Files
* `[NEW]` `server/models/RecentAccess.js`
* `server/routes/documents.js`

### Implementation Details
* **Step 1: Create the Optimized Schema.** 
  - Create `RecentAccess.js` with fields: `user` (ObjectId), `document` (ObjectId), `lastOpenedAt` (Date).
  - Include a compound unique index: `recentAccessSchema.index({ user: 1, document: 1 }, { unique: true });`.
  - **[NEW] Add TTL Index:** Add an expiration rule `recentAccessSchema.index({ lastOpenedAt: 1 }, { expireAfterSeconds: 7776000 });` (90 days). This forces MongoDB to auto-delete old log entries, completely preventing database bloat.
* **Step 2: Log the Access (Upsert).** 
  - Update the "View" trigger endpoint (currently `GET /api/documents/:id/download` which grants the frontend the access URL).
  - Use an Upsert to ensure we only update the time, never adding duplicate rows: `RecentAccess.findOneAndUpdate({ user: req.user._id, document: doc._id }, { lastOpenedAt: new Date() }, { upsert: true })`.
* **Step 3: Fetch Recent Activity.**
  - Create `GET /api/documents/recent-activity`.
  - Query `RecentAccess.find({ user: req.user._id }).sort({ lastOpenedAt: -1 }).limit(10).populate('document')`.

## User Review Required

> [!IMPORTANT]
> The plan has been updated to reflect your chosen approach. If everything looks good, approve the plan and we will begin coding **Phase 1A**.
