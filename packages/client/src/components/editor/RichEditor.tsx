import React, { useRef, useEffect, useState, useCallback } from 'react';
import DOMPurify from 'dompurify';
import { Item, Asset, MediaAnnotationRecord } from '@smartnotes/shared';
import {
  IconChecklist, IconListBullet, IconListNumber, IconQuote, IconCode,
  IconLink, IconHighlighter, IconUndo, IconRedo, IconImage, IconPdf,
  IconPen, IconTrash, IconZoomIn, IconZoomOut, IconPlus, IconNote,
  IconChevronRight, IconCheck, IconClose
} from '../icons/Icons';
import { renderPdfPageToCanvas } from '../../pdf/pdfViewer';
import { AnnotationOverlay } from '../annotations/AnnotationOverlay';
import { dbGetAsset, StoredAssetRecord } from '../../storage/db';

export interface RichEditorProps {
  note: Item;
  breadcrumbs: Array<{ id: string | null; title: string; kind: 'root' | 'folder' | 'note' }>;
  childNotes: Item[];
  localSaveState: 'saving' | 'saved' | 'error';
  cloudSyncState: 'synced' | 'pending' | 'offline' | 'conflict';
  onUpdateNote: (updated: Partial<Item>) => void;
  onNavigateBreadcrumb: (id: string | null) => void;
  onSelectChildNote: (id: string) => void;
  onCreateChildNote: () => void;
  onAttachAsset: (file: File) => void;
  onDeleteAsset: (assetId: string) => void;
  onSaveAnnotation: (annotation: MediaAnnotationRecord) => void;
}

export const RichEditor: React.FC<RichEditorProps> = ({
  note,
  breadcrumbs,
  childNotes,
  localSaveState,
  cloudSyncState,
  onUpdateNote,
  onNavigateBreadcrumb,
  onSelectChildNote,
  onCreateChildNote,
  onAttachAsset,
  onDeleteAsset,
  onSaveAnnotation
}) => {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [activeAnnotationAssetId, setActiveAnnotationAssetId] = useState<string | null>(null);
  const [activeAnnotationPage, setActiveAnnotationPage] = useState<number>(1);
  const [loadedAssets, setLoadedAssets] = useState<Map<string, StoredAssetRecord>>(new Map());
  const [pdfPages, setPdfPages] = useState<Record<string, { page: number; total: number; zoom: number }>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importType, setImportType] = useState<'image' | 'pdf'>('image');

  // Load binary assets from IndexedDB
  useEffect(() => {
    let isMounted = true;
    const loadAssets = async () => {
      const assetMap = new Map<string, StoredAssetRecord>();
      for (const assetId of note.assetIds || []) {
        const record = await dbGetAsset(assetId);
        if (record && isMounted) {
          assetMap.set(assetId, record);
        }
      }
      if (isMounted) setLoadedAssets(assetMap);
    };
    loadAssets();
    return () => { isMounted = false; };
  }, [note.assetIds]);

  // Sync contentHtml to editable body on note change
  useEffect(() => {
    if (bodyRef.current && bodyRef.current.innerHTML !== note.contentHtml) {
      bodyRef.current.innerHTML = note.contentHtml || '';
      attachChecklistListeners();
    }
  }, [note.id]);

  const attachChecklistListeners = useCallback(() => {
    if (!bodyRef.current) return;
    const checkboxes = bodyRef.current.querySelectorAll<HTMLInputElement>('.task-checkbox');
    checkboxes.forEach(cb => {
      cb.onchange = () => {
        const taskItem = cb.closest('.task-item');
        if (taskItem) {
          taskItem.classList.toggle('completed', cb.checked);
          if (cb.checked) {
            cb.setAttribute('checked', 'checked');
          } else {
            cb.removeAttribute('checked');
          }
        }
        handleBodyChange();
      };
    });
  }, []);

  const handleBodyChange = () => {
    if (!bodyRef.current) return;
    const rawHtml = bodyRef.current.innerHTML;
    const cleanHtml = DOMPurify.sanitize(rawHtml, {
      ADD_TAGS: ['input'],
      ADD_ATTR: ['type', 'checked', 'class']
    });
    const plainText = (bodyRef.current.textContent || '').trim();
    onUpdateNote({ contentHtml: cleanHtml, plainText });
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateNote({ title: e.target.value });
  };

  // Formatting helpers
  const exec = (cmd: string, val: string | null = null) => {
    document.execCommand(cmd, false, val ?? undefined);
    if (bodyRef.current) bodyRef.current.focus();
    handleBodyChange();
  };

  const insertChecklist = () => {
    const html = `<div class="task-item" style="display:flex; align-items:flex-start; gap:8px; margin:4px 0;"><input type="checkbox" class="task-checkbox" style="width:18px; height:18px; margin-top:3px; accent-color:#B9F32A;" /> <span class="task-text" contenteditable="true">Checklist item</span></div><p><br/></p>`;
    document.execCommand('insertHTML', false, html);
    attachChecklistListeners();
    handleBodyChange();
  };

  const triggerFileUpload = (type: 'image' | 'pdf') => {
    setImportType(type);
    if (fileInputRef.current) {
      fileInputRef.current.accept = type === 'image' ? 'image/*' : 'application/pdf';
      fileInputRef.current.click();
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onAttachAsset(file);
      e.target.value = '';
    }
  };

  return (
    <div className="rich-editor-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Hidden File Input */}
      <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={onFileInputChange} />

      {/* Editor Header: Breadcrumbs & Sync Telemetry */}
      <div
        className="editor-nav-header"
        style={{
          padding: '12px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}
      >
        {/* Breadcrumb Trail */}
        <nav className="breadcrumb-trail" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={crumb.id || 'root'}>
                {idx > 0 && <IconChevronRight size={12} color="var(--text-tertiary)" />}
                <button
                  type="button"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: isLast ? 'var(--text-main)' : 'var(--text-secondary)',
                    fontWeight: isLast ? 700 : 500,
                    cursor: isLast ? 'default' : 'pointer',
                    padding: '2px 4px',
                    borderRadius: '4px'
                  }}
                  onClick={() => !isLast && onNavigateBreadcrumb(crumb.id)}
                >
                  {crumb.title}
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        {/* Local Save & Cloud Sync Separate Status Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge" title="Local storage status">
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: localSaveState === 'saving' ? 'var(--warning)' : 'var(--lime-primary)'
              }}
            />
            {localSaveState === 'saving' ? 'Saving locally...' : 'Saved on this device'}
          </span>

          <span
            className={`badge ${cloudSyncState === 'synced' ? 'badge-lime' : ''}`}
            title="Cloud backup & sync status"
            style={{
              color: cloudSyncState === 'conflict' ? 'var(--danger)' : undefined,
              borderColor: cloudSyncState === 'conflict' ? 'var(--danger)' : undefined
            }}
          >
            {cloudSyncState === 'synced' && 'Cloud Synced'}
            {cloudSyncState === 'pending' && 'Waiting to Sync'}
            {cloudSyncState === 'offline' && 'Offline (Queue Active)'}
            {cloudSyncState === 'conflict' && 'Sync Conflict'}
          </span>
        </div>
      </div>

      {/* Formatting Toolbar */}
      <div
        className="editor-formatting-toolbar"
        style={{
          padding: '6px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface-elevated)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          flexWrap: 'wrap',
          flexShrink: 0
        }}
      >
        <button type="button" className="btn btn-sm" onClick={() => exec('formatBlock', '<h1>')} title="Heading 1">
          H1
        </button>
        <button type="button" className="btn btn-sm" onClick={() => exec('formatBlock', '<h2>')} title="Heading 2">
          H2
        </button>
        <button type="button" className="btn btn-sm" onClick={() => exec('formatBlock', '<h3>')} title="Heading 3">
          H3
        </button>
        <button type="button" className="btn btn-sm" onClick={() => exec('formatBlock', '<p>')} title="Paragraph">
          P
        </button>

        <span style={{ width: '1px', height: '18px', background: 'var(--border-subtle)', margin: '0 4px' }} />

        <button type="button" className="btn btn-icon btn-sm" onClick={() => exec('bold')} title="Bold">
          <strong>B</strong>
        </button>
        <button type="button" className="btn btn-icon btn-sm" onClick={() => exec('italic')} title="Italic">
          <em>I</em>
        </button>
        <button type="button" className="btn btn-icon btn-sm" onClick={() => exec('underline')} title="Underline">
          <u>U</u>
        </button>
        <button type="button" className="btn btn-icon btn-sm" onClick={() => exec('strikeThrough')} title="Strikethrough">
          <s>S</s>
        </button>

        <span style={{ width: '1px', height: '18px', background: 'var(--border-subtle)', margin: '0 4px' }} />

        <button type="button" className="btn btn-icon btn-sm" onClick={() => exec('insertUnorderedList')} title="Bullet List">
          <IconListBullet size={16} />
        </button>
        <button type="button" className="btn btn-icon btn-sm" onClick={() => exec('insertOrderedList')} title="Numbered List">
          <IconListNumber size={16} />
        </button>
        <button type="button" className="btn btn-icon btn-sm" onClick={insertChecklist} title="Interactive Checklist">
          <IconChecklist size={16} />
        </button>
        <button type="button" className="btn btn-icon btn-sm" onClick={() => exec('formatBlock', '<blockquote>')} title="Blockquote">
          <IconQuote size={16} />
        </button>
        <button type="button" className="btn btn-icon btn-sm" onClick={() => exec('formatBlock', '<pre>')} title="Code Block">
          <IconCode size={16} />
        </button>

        <span style={{ width: '1px', height: '18px', background: 'var(--border-subtle)', margin: '0 4px' }} />

        <button type="button" className="btn btn-icon btn-sm" onClick={() => exec('undo')} title="Undo">
          <IconUndo size={16} />
        </button>
        <button type="button" className="btn btn-icon btn-sm" onClick={() => exec('redo')} title="Redo">
          <IconRedo size={16} />
        </button>

        <span style={{ width: '1px', height: '18px', background: 'var(--border-subtle)', margin: '0 4px' }} />

        <button type="button" className="btn btn-sm" onClick={() => triggerFileUpload('image')} title="Insert Image Attachment">
          <IconImage size={15} />
          Image
        </button>
        <button type="button" className="btn btn-sm" onClick={() => triggerFileUpload('pdf')} title="Insert PDF Document">
          <IconPdf size={15} />
          PDF
        </button>
      </div>

      {/* Scrollable Document Canvas */}
      <div
        className="editor-scroll-body"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '36px 14% 60px 14%',
          background: 'var(--bg-canvas)'
        }}
      >
        {/* Document Sheet Card */}
        <div
          className="document-paper"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-card)',
            padding: '40px 48px',
            boxShadow: 'var(--shadow-md)',
            minHeight: '600px',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Note Title Input */}
          <input
            type="text"
            className="note-title-input"
            value={note.title}
            onChange={handleTitleChange}
            placeholder="Untitled Note"
            style={{
              fontSize: '2.1rem',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: 'var(--text-main)',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              marginBottom: '8px',
              width: '100%'
            }}
          />

          {/* Date & Metadata */}
          <div style={{ fontSize: '0.76rem', color: 'var(--text-tertiary)', marginBottom: '24px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
            Last modified {new Date(note.updatedAt).toLocaleString()} · Version {note.version}
          </div>

          {/* Rich Content Body */}
          <div
            ref={bodyRef}
            contentEditable
            suppressContentEditableWarning
            className="note-rich-body"
            onInput={handleBodyChange}
            style={{
              flex: 1,
              outline: 'none',
              fontSize: '1.02rem',
              lineHeight: 1.75,
              color: 'var(--text-main)',
              minHeight: '200px'
            }}
          />

          {/* Embedded Binary Media Attachments (Images & Real PDF Canvas) */}
          {note.assetIds && note.assetIds.length > 0 && (
            <div className="attachments-list" style={{ marginTop: '36px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Attachments & Documents ({note.assetIds.length})
              </div>

              {note.assetIds.map(assetId => {
                const asset = loadedAssets.get(assetId);
                if (!asset) return null;
                const isPdf = asset.mimeType === 'application/pdf' || asset.filename.endsWith('.pdf');
                const annotation = (note.mediaAnnotations || []).find(a => a.assetId === assetId);

                return (
                  <AttachmentItemCard
                    key={assetId}
                    asset={asset}
                    isPdf={isPdf}
                    annotation={annotation}
                    isAnnotating={activeAnnotationAssetId === assetId}
                    onStartAnnotation={() => setActiveAnnotationAssetId(assetId)}
                    onSaveAnnotation={(anno) => {
                      onSaveAnnotation(anno);
                      setActiveAnnotationAssetId(null);
                    }}
                    onCloseAnnotation={() => setActiveAnnotationAssetId(null)}
                    onDelete={() => onDeleteAsset(assetId)}
                  />
                );
              })}
            </div>
          )}

          {/* Child Notes (Sub-pages) Section */}
          <div className="child-notes-section" style={{ marginTop: '48px', paddingTop: '24px', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
                <IconNote size={16} />
                Child Notes & Sub-pages
                <span className="badge badge-lime">{childNotes.length}</span>
              </div>
              <button type="button" className="btn btn-sm btn-primary" onClick={onCreateChildNote}>
                <IconPlus size={14} />
                Add Sub-Note
              </button>
            </div>

            <div className="child-notes-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
              {childNotes.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', gridColumn: '1/-1' }}>
                  No nested child notes. Click "Add Sub-Note" to nest notes inside this note to unlimited depth.
                </div>
              ) : (
                childNotes.map(child => (
                  <div
                    key={child.id}
                    className="child-note-card"
                    style={{
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '12px 14px',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)'
                    }}
                    onClick={() => onSelectChildNote(child.id)}
                  >
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                      {child.title || 'Untitled Note'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                      Modified {new Date(child.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Subcomponent for each Image or PDF attachment
interface AttachmentCardProps {
  asset: StoredAssetRecord;
  isPdf: boolean;
  annotation?: MediaAnnotationRecord;
  isAnnotating: boolean;
  onStartAnnotation: () => void;
  onSaveAnnotation: (anno: MediaAnnotationRecord) => void;
  onCloseAnnotation: () => void;
  onDelete: () => void;
}

const AttachmentItemCard: React.FC<AttachmentCardProps> = ({
  asset,
  isPdf,
  annotation,
  isAnnotating,
  onStartAnnotation,
  onSaveAnnotation,
  onCloseAnnotation,
  onDelete
}) => {
  const [url, setUrl] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(1.0);
  const [viewSize, setViewSize] = useState<{ width: number; height: number }>({ width: 600, height: 400 });
  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(asset.blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [asset.blob]);

  // Render PDF page to canvas offline
  useEffect(() => {
    if (!isPdf || !pdfCanvasRef.current) return;
    let isMounted = true;

    const render = async () => {
      const arrayBuf = await asset.blob.arrayBuffer();
      if (!isMounted || !pdfCanvasRef.current) return;
      const res = await renderPdfPageToCanvas(arrayBuf, currentPage, pdfCanvasRef.current, zoom);
      if (isMounted) {
        setTotalPages(res.totalPages);
        setViewSize({ width: res.viewportWidth, height: res.viewportHeight });
      }
    };
    render();

    return () => { isMounted = false; };
  }, [isPdf, asset.blob, currentPage, zoom]);

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setViewSize({
      width: e.currentTarget.clientWidth,
      height: e.currentTarget.clientHeight
    });
  };

  return (
    <div
      className="attachment-card"
      style={{
        background: 'var(--bg-surface-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden'
      }}
    >
      {/* Attachment Header */}
      <div
        style={{
          padding: '10px 16px',
          background: 'var(--bg-surface-subtle)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)' }}>
          {isPdf ? <IconPdf size={16} /> : <IconImage size={16} />}
          <span>{asset.filename}</span>
          <span className="badge badge-lime">{isPdf ? 'PDF' : 'IMAGE'}</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
            ({Math.round(asset.byteLength / 1024)} KB)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button type="button" className="btn btn-sm btn-primary" onClick={onStartAnnotation}>
            <IconPen size={14} />
            Annotate
          </button>
          <button type="button" className="btn btn-icon btn-sm" onClick={onDelete} style={{ color: 'var(--danger)' }} title="Remove Attachment">
            <IconTrash size={14} />
          </button>
        </div>
      </div>

      {/* Viewer Stage */}
      <div
        className="attachment-stage"
        style={{
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'var(--bg-canvas)',
          padding: '16px',
          minHeight: '260px',
          overflow: 'auto'
        }}
      >
        <div style={{ position: 'relative', display: 'inline-block' }}>
          {isPdf ? (
            <canvas ref={pdfCanvasRef} style={{ display: 'block', maxWidth: '100%' }} />
          ) : (
            <img src={url} alt={asset.filename} style={{ maxWidth: '100%', height: 'auto', display: 'block' }} onLoad={onImgLoad} />
          )}

          {/* Visual Annotation Overlay */}
          <AnnotationOverlay
            mediaId={asset.id}
            pageIndex={currentPage}
            isEditing={isAnnotating}
            targetWidth={viewSize.width}
            targetHeight={viewSize.height}
            initialAnnotation={annotation}
            onSave={onSaveAnnotation}
            onClose={onCloseAnnotation}
          />
        </div>
      </div>

      {/* PDF Controls (Offline page navigation & zoom) */}
      {isPdf && (
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px'
          }}
        >
          <button
            type="button"
            className="btn btn-sm"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-sm"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          >
            Next
          </button>

          <span style={{ width: '1px', height: '16px', background: 'var(--border-subtle)', margin: '0 4px' }} />

          <button type="button" className="btn btn-icon btn-sm" onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} title="Zoom Out">
            <IconZoomOut size={14} />
          </button>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{Math.round(zoom * 100)}%</span>
          <button type="button" className="btn btn-icon btn-sm" onClick={() => setZoom(z => Math.min(2.0, z + 0.25))} title="Zoom In">
            <IconZoomIn size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
