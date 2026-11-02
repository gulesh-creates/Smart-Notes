# Smart Notes product requirements

## Product goal

One personal notes library usable offline on Android and desktop browsers. After sign-in and network recovery, both devices converge without silently losing edits. The Android deliverable is an installable APK; the desktop deliverable is a hosted web app.

## Core workflows

1. Create, edit, search, pin, duplicate, move, trash, restore, and permanently delete a note.
2. Format headings, paragraphs, lists, checklists, quotes, links, bold, italic, underline, text size and highlights, with undo/redo and reliable autosave.
3. Create folders in folders at arbitrary depth. Each folder holds folders and notes. A note may contain child notes at arbitrary depth. Prevent cycles when moving items.
4. Insert images and PDFs at a chosen place in a note. Reorder/resize an image. View real PDF pages offline. Add editable text and pen annotations over images and individual PDF pages. Preserve annotation placement across zoom and screen sizes.
5. Work with no network. Show local save state separately from cloud sync state. Queue edits and assets for later sync. After reconnection, sync Android and web through one account; never silently discard a local revision.
6. Export the whole library as a ZIP whose paths reflect folder and child-note hierarchy. Include a versioned manifest, content, original assets and annotations. Restore after validating an archive and showing a summary. Support large libraries with streaming or bounded-memory processing, progress and cancellation; document platform limits honestly.

## User-visible states

- Local save: saving, saved locally, local save failed.
- Cloud: offline, waiting to sync, syncing, synced, conflict, sync failed.
- Conflict: show both versions, dates/devices and choices to keep either, merge manually, or keep both. Preserve both until resolved.
- Storage pressure, oversized attachment, interrupted import/export and permission loss must have recovery paths.

## Data and account rules

- Local edits are available immediately. Sign-in is required for cross-device backup/sync, not for local note-taking.
- Never label unsynced work as backed up. First sign-in and sign-out flows must clearly state what remains on the device and what is in the account.
- Unique stable IDs, ordered siblings, timestamps, deletion tombstones and revision metadata are required.
- Reuse a binary asset across revisions by content hash where appropriate. Deleting an attachment should not break an older backup.
- Define privacy policy, retention and account-deletion behavior before public release. Do not claim end-to-end encryption unless implemented and tested.

## Acceptance criteria

- Notes, folders, child notes, images, PDFs and annotations persist after app restart and offline restart.
- Android A and browser B can both edit offline, reconnect and see all nonconflicting changes on both devices.
- Concurrent edits to one note trigger a recoverable conflict with no lost version.
- Exported ZIP can be restored into a clean installation with structure and content intact; verify checksums and counts.
- Large-file tests cover a realistic library and an interrupted export/import. State tested limits in release notes.
- All visible icons are custom SVG assets from one consistent set; no emoji UI icons.
- Light mode is the default. Dark mode is optional and fully designed.
