# Smart Notes technical plan

## Suggested implementation

Use a TypeScript monorepo: React web app; Capacitor Android wrapper around the shared UI where practical; platform storage adapters; a typed API service; PostgreSQL for account/item/revision metadata; object storage for binary assets. Prefer a maintained schema-based rich-text editor. Keep the exact package choices documented and maintained. The team may substitute an equivalent stack with a written reason and the same acceptance tests.

## Local data

- Web: IndexedDB with versioned migrations. Android: durable SQLite plus app-private files for large assets. Do not keep full PDFs/images as base64 inside note records.
- Model items with stable IDs, `kind`, `parentId`, sibling order, timestamps, revision and tombstone; model note content as versioned structured JSON; model assets separately with hash, MIME type, byte length and local/cloud state.
- Annotation records refer to asset ID and PDF page index. Store normalized page/image coordinates so zoom and resizing do not move markings.
- Use transactions for structure changes, imports and deletion. Retain a trash/recovery window.

## Sync contract

- Authenticated account-scoped API with authorization checks on every item and asset. HTTPS in transit, encryption at rest, scoped upload/download tokens, rate limits and audit logs.
- Record local changes in a durable outbox. Push idempotent operations with client operation ID and base revision. Server returns accepted revision or conflict. Pull changes with cursor and tombstones. Resume after interruption; retry with backoff.
- Upload large assets in resumable chunks, verify hash, then publish the item revision that references them. Download on demand and cache for offline use.
- Concurrent nonoverlapping item changes may sync independently. Concurrent changes to the same note preserve both versions and surface a conflict UI. Do not use last-write-wins for note bodies.
- Report separate local-save and cloud-sync states. Monitor failures without logging private note bodies.

## Export and restore

- Versioned ZIP manifest includes IDs, parent relationships, order, revisions, asset references, checksums, timestamps and format version. Represent child notes as subdirectories or a documented equivalent without ambiguous duplicate names.
- Stream archive entries and binary reads where platform APIs permit. Use Android Storage Access Framework for destination selection. Provide progress/cancel/resume strategy and a clear message when a platform cannot produce a requested archive size.
- Validate ZIP paths against traversal, duplicate paths, decompression bombs, unsupported MIME and schema versions. Preview restore, then apply transactionally or through a rollback journal. Verify by round trip on a clean profile.

## Delivery stages

1. Review the existing prototype and preserve a migration/export path.
2. Approve light/dark design and custom SVG set.
3. Build local-first web and Android foundations with core editing, hierarchy, media and annotations.
4. Add real account, backend, sync, conflicts and asset transfer.
5. Add streaming export/restore, migration, accessibility, security and recovery behavior.
6. Run automated tests, cross-device offline scenarios, visual review and release builds. Deliver a hosted web app and signed/releasable Android APK with setup and deployment instructions.

## Quality gates

Unit tests for hierarchy, migrations, sync state and ZIP manifest; integration tests for API/auth/storage; end-to-end tests for offline edits, reconnect, conflicts, media, export/restore; Android device and browser testing; accessibility and performance checks. No demo-only sync status or fake PDF canvas may be presented as production behavior.
