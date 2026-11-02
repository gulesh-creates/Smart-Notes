# Smart Notes 📝

Smart Notes is a modern, offline-first notes application with a clean, high-contrast visual design, unlimited-depth hierarchy, real-time rich text editing, in-app media annotations (image & PDF), and local-to-cloud synchronization.

Built as a production TypeScript monorepo supporting **Desktop Web** (React + Vite) and **Android App** (Capacitor + Android SDK).

---

## ✨ Features

- **🎨 Modern Design System (Reference 3 Direction):**
  - Default Light Theme with crisp dark typography (`#17211A`) and vivid lime green accents (`#B9F32A`).
  - Dark Theme & System Theme toggle.
  - 100% Custom SVG Iconography (strictly zero emoji).
- **📂 Unlimited-Depth Organization:**
  - Folders inside folders, and notes inside notes at any depth.
  - Cycle prevention algorithms to ensure safe item moves.
  - **Folder Customization:** Name & 11 aesthetic color themes (Lime, Emerald, Forest, Sky, Ocean, Indigo, Purple, Rose, Amber, Teal, Slate).
  - Inline rename & color customize using the pencil button.
  - Distinguishable visual hierarchy with tree connector guide lines.
- **✍️ Rich Text Writing Experience:**
  - Headings (H1, H2, H3), lists, interactive checklists, blockquotes, code blocks.
  - Bold, italic, underline, strikethrough.
  - Autosave with immediate IndexedDB local persistence.
  - Undo / Redo history stack.
- **🖼️ Media & PDF Offline Annotations:**
  - Insert and preview images and offline multi-page PDFs using PDF.js.
  - Interactive pen strokes and draggable text box annotations in normalized media coordinate space.
- **🔄 Local-First Synchronization:**
  - Changes are written synchronously to IndexedDB outbox.
  - Automatic push & pull sync with Node/Express + SQLite backend when connected.
  - Deterministic 3-way conflict resolution flow without silent data loss.
- **📦 ZIP Backup & Restore:**
  - Traversal-safe archive engine preserving hierarchy, JSON metadata, binary assets, and media annotations.
- **🗑️ Safe Deletion:**
  - Two-step English confirmation dialog before moving items and their nested contents to Trash.

---

## 🏗️ Repository Architecture

This repository is structured as an npm workspaces monorepo:

```
Smart-Notes/
├── packages/
│   ├── shared/         # Domain types, tree hierarchy logic, and ZIP archive validation
│   ├── server/         # Express REST API, JWT auth, and SQLite sync backend
│   └── client/         # React 19 + TypeScript + Vite web app & Capacitor Android app
│       └── android/    # Native Android Studio Gradle project
├── docs/               # Specifications, prototype audit, and design plans
└── screenshots/        # Verified application screenshots
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- *(Optional for Android build)* **JDK 21** and **Android SDK 34/35**

### 1. Installation

Clone the repository and install all workspace dependencies:

```bash
git clone https://github.com/gulesh-creates/Smart-Notes.git
cd Smart-Notes
npm install
```

### 2. Running Locally

#### Run Client (Vite Dev Server)
```bash
npm run dev:client
```
The application will be accessible at: `http://localhost:3000` (or `http://localhost:5173`).

#### Run Sync Server
```bash
npm run dev:server
```
The API server runs on: `http://localhost:4000`.

### 3. Running Tests

Run unit and integration test suites across all packages:

```bash
npm test
```

### 4. Building Production Artifacts

#### Web Client Build
```bash
npm run build:client
```
Generates production assets in `packages/client/dist`.

#### Android APK Build
```bash
npm run build:android
```
Produces an installable Android debug APK.

---

## 📄 License

MIT License. Designed and developed with care.

