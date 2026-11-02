import { Item } from '@smartnotes/shared';
import { StoredAssetRecord } from './storage/db';

const now = Date.now();

// 1-page valid PDF bytes for offline rendering
const SAMPLE_PDF_BASE64 = `JVBERi0xLjQKMSAwIG9iaiA8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4gZW5kb2JqCjIgMCBvYmogPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4gZW5kb2JqCjMgMCBvYmogPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvQ29udGVudHMgNCAwIFIgL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgNSAwIFIgPj4gPj4gPj4gZW5kb2JqCjQgMCBvYmogPDwgL0xlbmd0aCA1OCA+PiBzdHJlYW0KQlQKL0YxIDIwIFRmCjcwIDcwMCBUZAooU21hcnQgTm90ZXMgU3BlY2lmaWNhdGlvbiBEb2N1bWVudCkgVGoKRVRKZW5kc3RyZWFtIGVuZG9iago1IDAgb2JqIDw8IC9UeXBlIC9Gb250IC9TdWJ0eXBlIC9UeXBlMSAvQmFzZUZvbnQgL0hlbHZldGljYSA+PiBlbmRvYmoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDEwIDAwMDAwIG4gCjAwMDAwMDAwNjAgMDAwMDAgbiAKMDAwMDAwMDExNyAwMDAwMCBuIAowMDAwMDAwMjM2IDAwMDAwIG4gCjAwMDAwMDAzNDUgMDAwMDAgbiAKdHJhaWxlciA8PCAvU2l6ZSA2IC9Sb290IDEgMCBSID4+CnN0YXJ0eHJlZgo0MTYKJSVFT0Y=`;

const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="340" viewBox="0 0 600 340">
  <rect width="600" height="340" rx="16" fill="#12241A" />
  <circle cx="80" cy="80" r="32" fill="#B9F32A" />
  <text x="80" y="88" font-family="sans-serif" font-size="22" font-weight="bold" fill="#12241A" text-anchor="middle">SN</text>
  <text x="135" y="75" font-family="sans-serif" font-size="18" font-weight="bold" fill="#FFFFFF">Storage &amp; Sync Architecture</text>
  <text x="135" y="100" font-family="sans-serif" font-size="13" fill="#A8BFB0">IndexedDB Outbox &bull; SHA-256 Blobs &bull; Three-Way Merge</text>
  <rect x="50" y="145" width="230" height="140" rx="12" fill="#1E382A" stroke="#B9F32A" stroke-width="2" />
  <text x="70" y="180" font-family="sans-serif" font-size="15" font-weight="bold" fill="#B9F32A">Client Outbox Queue</text>
  <text x="70" y="210" font-family="sans-serif" font-size="12" fill="#E0EDE4">&bull; Immediate local commit</text>
  <text x="70" y="235" font-family="sans-serif" font-size="12" fill="#E0EDE4">&bull; Resilient retry worker</text>
  <text x="70" y="260" font-family="sans-serif" font-size="12" fill="#E0EDE4">&bull; Zero data loss</text>
  <path d="M 290 215 L 340 215" stroke="#B9F32A" stroke-width="3" />
  <rect x="350" y="145" width="200" height="140" rx="12" fill="#1E382A" />
  <text x="370" y="180" font-family="sans-serif" font-size="15" font-weight="bold" fill="#FFFFFF">Cloud Gateway</text>
  <text x="370" y="210" font-family="sans-serif" font-size="12" fill="#A8BFB0">&bull; Delta pull cursor</text>
  <text x="370" y="235" font-family="sans-serif" font-size="12" fill="#A8BFB0">&bull; Conflict detection</text>
  <text x="370" y="260" font-family="sans-serif" font-size="12" fill="#A8BFB0">&bull; Verified binary store</text>
</svg>`;

export function createInitialSampleAssets(): StoredAssetRecord[] {
  let pdfBlob: Blob;
  try {
    const binary = atob(SAMPLE_PDF_BASE64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    pdfBlob = new Blob([bytes], { type: 'application/pdf' });
  } catch {
    pdfBlob = new Blob(['%PDF-1.4 demo'], { type: 'application/pdf' });
  }

  const svgBlob = new Blob([SAMPLE_SVG], { type: 'image/svg+xml' });

  return [
    {
      id: 'asset-sample-img',
      sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      mimeType: 'image/svg+xml',
      byteLength: svgBlob.size,
      filename: 'Storage-Architecture-Diagram.svg',
      blob: svgBlob,
      createdAt: now,
      syncState: 'synced'
    },
    {
      id: 'asset-sample-pdf',
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      mimeType: 'application/pdf',
      byteLength: pdfBlob.size,
      filename: 'Smart-Notes-Specification.pdf',
      blob: pdfBlob,
      createdAt: now,
      syncState: 'synced'
    }
  ];
}

export const INITIAL_SAMPLE_ITEMS: Item[] = [
  // 1. Root Folder: Engineering & Architecture
  {
    id: 'f-engineering',
    kind: 'folder',
    title: 'Engineering & Architecture',
    color: '#10B981', // Emerald Green
    parentId: null,
    orderIndex: 0,
    version: 1,
    createdAt: now - 86400000 * 4,
    updatedAt: now - 86400000 * 2,
    isDeleted: false,
    isPinned: false,
    assetIds: [],
    mediaAnnotations: []
  },
  // 1.1 Subfolder: Storage & Sync
  {
    id: 'f-storage-sync',
    kind: 'folder',
    title: 'Storage & Sync Systems',
    color: '#0284C7', // Sky Blue
    parentId: 'f-engineering',
    orderIndex: 0,
    version: 1,
    createdAt: now - 86400000 * 3,
    updatedAt: now - 86400000 * 2,
    isDeleted: false,
    isPinned: false,
    assetIds: [],
    mediaAnnotations: []
  },
  // 1.1.1 Note in Subfolder: Offline Synchronization Strategy
  {
    id: 'n-offline-sync',
    kind: 'note',
    title: 'Offline Synchronization Strategy',
    parentId: 'f-storage-sync',
    orderIndex: 0,
    version: 1,
    createdAt: now - 86400000 * 3,
    updatedAt: now - 3600000,
    isDeleted: false,
    isPinned: true,
    contentHtml: `<h2>Offline-First Sync Architecture</h2><p>Smart Notes implements a local-first durable synchronization model using a transactional outbox in IndexedDB.</p><blockquote>"Local data is the primary source of truth; the server acts as an authenticated relay and long-term backup."</blockquote><h3>Core Principles</h3><ul class="editor-checklist"><li data-checked="true">Local IndexedDB writes are synchronous and immediate</li><li data-checked="true">Separate binary assets from metadata JSON</li><li data-checked="false">Continuous delta synchronization with revision cursors</li><li data-checked="false">Safe three-way conflict resolution without silent overwrites</li></ul><p>When connectivity is restored, outstanding mutations in the outbox queue are batched and pushed to the cloud backend.</p>`,
    plainText: 'Offline-First Sync Architecture\nSmart Notes implements a local-first durable synchronization model using a transactional outbox in IndexedDB.\n"Local data is the primary source of truth; the server acts as an authenticated relay and long-term backup."\nCore Principles:\n- [x] Local IndexedDB writes are synchronous and immediate\n- [x] Separate binary assets from metadata JSON\n- [ ] Continuous delta synchronization with revision cursors\n- [ ] Safe three-way conflict resolution without silent overwrites',
    assetIds: ['asset-sample-img', 'asset-sample-pdf'],
    mediaAnnotations: [
      {
        assetId: 'asset-sample-img',
        pageIndex: 0,
        paths: [
          {
            id: 'path-1',
            color: '#B9F32A',
            strokeWidth: 4,
            points: [{ x: 0.1, y: 0.5 }, { x: 0.35, y: 0.5 }, { x: 0.45, y: 0.65 }]
          }
        ],
        textBoxes: [
          {
            id: 'tb-1',
            text: 'Verified transactional queue',
            x: 0.12,
            y: 0.42,
            color: '#B9F32A',
            fontSize: 13
          }
        ]
      },
      {
        assetId: 'asset-sample-pdf',
        pageIndex: 1,
        paths: [
          {
            id: 'path-pdf-1',
            color: '#B9F32A',
            strokeWidth: 3,
            points: [{ x: 0.15, y: 0.8 }, { x: 0.6, y: 0.8 }]
          }
        ],
        textBoxes: [
          {
            id: 'tb-pdf-1',
            text: 'Offline verified PDF page',
            x: 0.15,
            y: 0.74,
            color: '#12241A',
            fontSize: 12
          }
        ]
      }
    ]
  },
  // 1.1.1.1 Child Note: IndexedDB Delta Tracking (Nested inside n-offline-sync!)
  {
    id: 'n-idb-deltas',
    kind: 'note',
    title: 'IndexedDB Delta Tracking',
    parentId: 'n-offline-sync',
    orderIndex: 0,
    version: 1,
    createdAt: now - 86400000 * 2,
    updatedAt: now - 7200000,
    isDeleted: false,
    isPinned: false,
    contentHtml: `<h3>Mutation Log Specification</h3><p>Every write operation produces a record in the <code>outbox</code> object store:</p><pre><code>interface ItemMutation {\\n  opId: string;\\n  itemId: string;\\n  action: 'upsert' | 'delete';\\n  baseVersion: number;\\n  item: Item;\\n  timestamp: number;\\n}</code></pre><p>Mutations are removed only after the server acknowledges successful persistence.</p>`,
    plainText: 'Mutation Log Specification\nEvery write operation produces a record in the outbox object store. Mutations are removed only after the server acknowledges successful persistence.',
    assetIds: [],
    mediaAnnotations: []
  },
  // 1.1.1.2 Child Note: Deterministic Conflict Resolution (Also nested inside n-offline-sync!)
  {
    id: 'n-conflict-handling',
    kind: 'note',
    title: 'Deterministic Conflict Resolution',
    parentId: 'n-offline-sync',
    orderIndex: 1,
    version: 1,
    createdAt: now - 86400000 * 2,
    updatedAt: now - 7000000,
    isDeleted: false,
    isPinned: false,
    contentHtml: `<h3>Conflict Detection Rules</h3><p>A conflict arises when a client pushes a mutation whose <code>baseVersion</code> is strictly lower than the server's current version for that item.</p><h3>Resolution Options</h3><ol><li><strong>Keep Local:</strong> Client version supersedes server with bumped version number.</li><li><strong>Keep Cloud:</strong> Discard local changes and accept server copy.</li><li><strong>Merge Both:</strong> Non-destructive concatenation preserving both edits with visual separation.</li></ol>`,
    plainText: 'Conflict Detection Rules\nA conflict arises when a client pushes a mutation whose baseVersion is strictly lower than the server current version for that item.\nResolution Options:\n1. Keep Local: Client version supersedes server.\n2. Keep Cloud: Discard local changes.\n3. Merge Both: Non-destructive concatenation.',
    assetIds: [],
    mediaAnnotations: []
  },

  // 2. Root Folder: Product Design & Systems
  {
    id: 'f-design',
    kind: 'folder',
    title: 'Product Design & Systems',
    color: '#8B5CF6', // Purple
    parentId: null,
    orderIndex: 1,
    version: 1,
    createdAt: now - 86400000 * 5,
    updatedAt: now - 86400000 * 1,
    isDeleted: false,
    isPinned: false,
    assetIds: [],
    mediaAnnotations: []
  },
  // 2.1 Note in Design: Design Tokens & SVG Icon System
  {
    id: 'n-design-tokens',
    kind: 'note',
    title: 'Design Tokens & SVG Icon System',
    parentId: 'f-design',
    orderIndex: 0,
    version: 1,
    createdAt: now - 86400000 * 3,
    updatedAt: now - 86400000 * 1,
    isDeleted: false,
    isPinned: true,
    contentHtml: `<h2>Visual System & Aesthetics</h2><p>Designed in alignment with the light canvas visual direction: warm off-white backgrounds (<code>#F6F7F3</code>), pure white cards, crisp dark typography (<code>#17211A</code>), and vivid lime accents (<code>#B9F32A</code>).</p><h3>Iconography Guidelines</h3><ul><li>100% custom SVG icons built on a strict 24x24 grid.</li><li>Consistent 2px geometric stroke width.</li><li>Zero emoji used across user interface elements, trees, and lists.</li></ul>`,
    plainText: 'Visual System & Aesthetics\nDesigned in alignment with the light canvas visual direction: warm off-white backgrounds (#F6F7F3), pure white cards, crisp dark typography (#17211A), and vivid lime accents (#B9F32A).\nIconography Guidelines:\n- 100% custom SVG icons built on a strict 24x24 grid.\n- Consistent 2px geometric stroke width.\n- Zero emoji used across user interface elements, trees, and lists.',
    assetIds: [],
    mediaAnnotations: []
  },
  // 2.2 Note in Design: Media Annotation Engine
  {
    id: 'n-media-annotation',
    kind: 'note',
    title: 'Media Annotation Engine',
    parentId: 'f-design',
    orderIndex: 1,
    version: 1,
    createdAt: now - 86400000 * 2,
    updatedAt: now - 1800000,
    isDeleted: false,
    isPinned: false,
    contentHtml: `<h2>Normalized Media Coordinate Space</h2><p>All pen strokes and textual annotations on images and PDF pages are recorded with normalized relative coordinates (values from <code>0.0</code> to <code>1.0</code>).</p><p>This guarantees that annotations remain perfectly aligned when rendered on differing screen resolutions, mobile devices, or when changing document zoom.</p>`,
    plainText: 'Normalized Media Coordinate Space\nAll pen strokes and textual annotations on images and PDF pages are recorded with normalized relative coordinates (0.0 to 1.0). This guarantees that annotations remain perfectly aligned across devices.',
    assetIds: [],
    mediaAnnotations: []
  },

  // 3. Unfiled Scratchpad Note (Root level note)
  {
    id: 'n-quick-scratchpad',
    kind: 'note',
    title: 'Quick Scratchpad & Ideas',
    parentId: null,
    orderIndex: 2,
    version: 1,
    createdAt: now - 86400000 * 1,
    updatedAt: now - 600000,
    isDeleted: false,
    isPinned: true,
    contentHtml: `<h2>Quick Scratchpad</h2><p>A convenient place for rapid notes, checklists, and snippets.</p><ul class="editor-checklist"><li data-checked="true">Verify offline PDF page rendering via local PDF.js worker</li><li data-checked="true">Test arbitrary depth tree nesting and cycle prevention</li><li data-checked="true">Confirm traversal-safe ZIP backup and restore</li><li data-checked="false">Prepare installable Android release package</li></ul>`,
    plainText: 'Quick Scratchpad\nA convenient place for rapid notes, checklists, and snippets.\n- [x] Verify offline PDF page rendering via local PDF.js worker\n- [x] Test arbitrary depth tree nesting and cycle prevention\n- [x] Confirm traversal-safe ZIP backup and restore\n- [ ] Prepare installable Android release package',
    assetIds: [],
    mediaAnnotations: []
  }
];
