# Smart Notes prototype audit

Reviewed: 2026-11-02. Source: `../smart-notes-prototype.html` (static code review) and the supplied desktop/mobile screenshots. This is not a claim that every interaction was run in a browser.

## What exists

- One 190 KB HTML file with desktop three-column layout and a mobile preview mode.
- IndexedDB `SmartNotesDB_v1` with `items` and `assets` stores. Folders and notes use `parentId`; notes can be children of notes.
- Rich-text editing via `contenteditable` and `document.execCommand`; note search, pinning, moving, deletion, and a sample library are implemented.
- Image/PDF attachment handling, drawing/text annotations, and ZIP export/restore code exist.
- Sync screen explicitly describes future cloud sync. There is no account, API, server, or real cross-device sync.

## Visual review

- The screenshots confirm the user's objection: nearly every large surface is dark green/black. Lime is used heavily, so there is little light-space hierarchy.
- The supplied reference uses mostly white/light surfaces, with lime used for selected cards, controls and accents, plus a few dark cards for emphasis. The production default should be light, with a separate dark theme.
- Mobile preview is framed inside a desktop page; production mobile must be a real full-screen app, not the preview frame.
- Emoji appear in folder/note actions, lists, restore text, and the PDF fallback. Replace every app icon with a consistent custom SVG icon set; remove emoji from UI and sample content used as decoration.

## Production gaps and risks

1. **Storage:** Attachments are read as base64 data URLs and embedded in note records, despite a separate `assets` object store. Large files can cause memory, quota, save, and export failures. Store binary blobs separately and reference them by stable asset ID.
2. **PDF:** PDF.js and its worker load from a CDN. Without them the code draws a fake document preview. Production must render the real PDF offline or display an honest error.
3. **Export/restore:** JSZip loads from a CDN; the local ZIP fallback builds the whole archive in memory. ZIP restore requires JSZip and restores manifest items, not a robust validated, transactional asset import. Duplicate note titles can also collide in exported paths. The arbitrary-large-export requirement is not met.
4. **Editor:** `document.execCommand` and raw HTML strings are fragile for structured editing, undo, collaboration and safe rendering. Use a maintained editor with a document schema, controlled serialization, sanitization and migration.
5. **Sync:** No actual backend or conflict handling. The current conflict modal is a demo. Build authenticated, durable sync with explicit conflict behavior and no silent overwrite.
6. **Reliability:** A single large HTML file mixes views, storage, editor and export. There are no automated tests, schema migrations, error telemetry, or release pipeline in this folder.
7. **Accessibility and mobile:** The viewport disables user zoom. Native `prompt`, `confirm`, and `alert` are common. Production needs accessible dialogs, usable touch targets, keyboard/focus behavior, and a true Android package.
8. **Security:** Imported rich text and generated HTML need validation and sanitization. Export/restore paths and archive contents need traversal, collision, type, size and decompression-limit checks.

## Decision

Treat this file as a behavior reference and a source of sample flows. Build the production product as a maintainable application. Preserve user data through an explicit migration/import path; do not assume the prototype's local browser data will automatically transfer to the new app.
