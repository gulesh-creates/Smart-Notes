# Smart Notes UI design specification

## Reference and direction

The user's third supplied reference is the visual target: white/off-white main surfaces, black readable text, restrained lime highlights, occasional dark forest cards, soft rounded geometry and clean spacing. Translate that language to a writing product. Do not copy the reference's banking content or layout literally.

## Themes

Default **light**: canvas `#F6F7F3`, surface `#FFFFFF`, subtle surface `#EDF1E8`, text `#17211A`, muted text `#637067`, border `#E2E8DE`, lime action `#B9F32A`, pale lime `#E7F9B5`, dark accent `#12241A`. Validate text/button contrast and adjust tokens if needed.

Optional **dark**: deliberately designed companion theme with near-black neutral surfaces and lime only as accent. Do not turn every panel green. Follow system theme initially but allow manual override stored per device.

## Layout

- Desktop: adjustable/collapsible folder rail, note list, spacious document editor. White editor canvas; slim toolbar; predictable breadcrumbs; optional focus mode.
- Android: full-screen Library, folder, editor, search and settings screens. Bottom navigation where appropriate; prominent create button; editor toolbar reachable on a phone. No desktop preview frame in the shipped app.
- Tablet: adaptive two-pane layout. Handle long names, deep nesting, touch keyboard and small screens without clipping.
- Leave comfortable reading width in the editor; attachments should not force horizontal page scrolling.

## Components and icon rules

- Create a local custom SVG icon set with a consistent 24px grid, stroke, corners and optical weight. Icons needed include note, folder, nested note, add, search, pin, move, image, PDF, pen, text, undo, redo, sync, offline, export, import, settings, trash and back.
- No Unicode emoji, platform emoji glyphs, or emoji in place of icons anywhere in the app. Provide text labels or accessible names for ambiguous icons.
- Design buttons, tabs, cards, menus, dialogs, toasts, progress, status, empty states and errors in both themes.
- Use lime for primary actions, selected navigation, small highlights and a few feature cards. Use neutral cards for the majority of content.
- Mobile tap targets at least 44 CSS px; visible focus states; screen reader names; keyboard paths; user zoom enabled.

## Review screens

Before implementation, produce reviewable light-theme mockups for Android Library, folder, editor with image, PDF annotation, search, sync/conflict, and desktop three-pane editor. Include one dark-theme Library/editor pair. Ask for design approval only after these concrete artifacts exist.
