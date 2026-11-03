import React, { useRef, useState, useEffect } from 'react';
import { AnnotationPath, AnnotationTextBox, MediaAnnotationRecord } from '@smartnotes/shared';
import { IconPen, IconTextBox, IconUndo, IconClose, IconCheck, IconTrash } from '../icons/Icons';

export interface AnnotationOverlayProps {
  mediaId: string;
  pageIndex: number;
  isEditing: boolean;
  targetWidth: number;
  targetHeight: number;
  initialAnnotation?: MediaAnnotationRecord;
  onSave?: (annotation: MediaAnnotationRecord) => void;
  onClose?: () => void;
}

export const AnnotationOverlay: React.FC<AnnotationOverlayProps> = ({
  mediaId,
  pageIndex,
  isEditing,
  targetWidth,
  targetHeight,
  initialAnnotation,
  onSave,
  onClose
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [paths, setPaths] = useState<AnnotationPath[]>(initialAnnotation?.paths || []);
  const [textBoxes, setTextBoxes] = useState<AnnotationTextBox[]>(initialAnnotation?.textBoxes || []);
  const [activeTool, setActiveTool] = useState<'pen' | 'text'>('pen');
  const [penColor, setPenColor] = useState<string>('#B9F32A');
  const [penWidth, setPenWidth] = useState<number>(3);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [currentPath, setCurrentPath] = useState<AnnotationPath | null>(null);

  // Redraw canvas whenever paths, size, or zoom changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const allPaths = [...paths];
    if (currentPath) allPaths.push(currentPath);

    for (const p of allPaths) {
      if (!p.points || p.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const p0 = p.points[0];
      ctx.moveTo(p0.x * targetWidth, p0.y * targetHeight);

      for (let i = 1; i < p.points.length; i++) {
        const pt = p.points[i];
        ctx.lineTo(pt.x * targetWidth, pt.y * targetHeight);
      }
      ctx.stroke();
    }
  }, [paths, currentPath, targetWidth, targetHeight]);

  // Handle Drawing events
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isEditing || activeTool !== 'pen') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    setIsDrawing(true);
    setCurrentPath({
      id: `p-${Date.now()}`,
      color: penColor,
      strokeWidth: penWidth,
      points: [{ x, y }]
    });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentPath) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    setCurrentPath(prev => {
      if (!prev) return null;
      return {
        ...prev,
        points: [...prev.points, { x, y }]
      };
    });
  };

  const handlePointerUp = () => {
    if (isDrawing && currentPath) {
      setPaths(prev => [...prev, currentPath]);
      setCurrentPath(null);
    }
    setIsDrawing(false);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isEditing || activeTool !== 'text') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0.02, Math.min(0.85, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0.02, Math.min(0.85, (e.clientY - rect.top) / rect.height));

    const newBox: AnnotationTextBox = {
      id: `tb-${Date.now()}`,
      text: 'Note text',
      x,
      y,
      color: penColor
    };
    setTextBoxes(prev => [...prev, newBox]);
    setActiveTool('pen'); // Return to pen tool
  };

  const handleUndo = () => {
    if (paths.length > 0) {
      setPaths(prev => prev.slice(0, -1));
    }
  };

  const handleClear = () => {
    if (window.confirm('Clear all drawings and text annotations on this page?')) {
      setPaths([]);
      setTextBoxes([]);
    }
  };

  const handleSave = () => {
    onSave?.({
      assetId: mediaId,
      pageIndex,
      paths,
      textBoxes
    });
  };

  // Draggable text box handler
  const handleBoxDragStart = (e: React.PointerEvent<HTMLDivElement>, id: string) => {
    e.stopPropagation();
    const el = e.currentTarget;
    const container = el.parentElement;
    if (!container) return;

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const box = textBoxes.find(b => b.id === id);
    if (!box) return;

    const initialX = box.x;
    const initialY = box.y;

    const onPointerMove = (moveEv: PointerEvent) => {
      const containerRect = container.getBoundingClientRect();
      const deltaX = (moveEv.clientX - startClientX) / containerRect.width;
      const deltaY = (moveEv.clientY - startClientY) / containerRect.height;

      setTextBoxes(prev =>
        prev.map(b => {
          if (b.id !== id) return b;
          return {
            ...b,
            x: Math.max(0.01, Math.min(0.9, initialX + deltaX)),
            y: Math.max(0.01, Math.min(0.9, initialY + deltaY))
          };
        })
      );
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  return (
    <div
      className={`annotation-overlay-root ${isEditing ? 'editing-active' : 'read-only'}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${targetWidth}px`,
        height: `${targetHeight}px`,
        pointerEvents: isEditing ? 'auto' : 'none',
        userSelect: 'none'
      }}
      onClick={handleCanvasClick}
    >
      {/* Visual Annotation Mode Banner (Top Dock) */}
      {isEditing && (
        <div
          className="annotation-floating-toolbar"
          style={{
            position: 'absolute',
            top: '12px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-pill)',
            padding: '6px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 100,
            pointerEvents: 'auto'
          }}
          onClick={e => e.stopPropagation()}
        >
          <span className="badge badge-lime" style={{ fontSize: '0.72rem' }}>
            Annotation Mode Active
          </span>

          <button
            type="button"
            className={`btn btn-sm ${activeTool === 'pen' ? 'btn-primary' : ''}`}
            onClick={() => setActiveTool('pen')}
            title="Pen Drawing Tool"
          >
            <IconPen size={14} />
            Pen
          </button>

          <button
            type="button"
            className={`btn btn-sm ${activeTool === 'text' ? 'btn-primary' : ''}`}
            onClick={() => setActiveTool('text')}
            title="Add Movable Text Box"
          >
            <IconTextBox size={14} />
            Text
          </button>

          {/* Color palette */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {['#B9F32A', '#FFFFFF', '#EF4444', '#F59E0B', '#17211A'].map(c => (
              <button
                key={c}
                type="button"
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: c,
                  border: penColor === c ? '2px solid #17211A' : '1px solid rgba(0,0,0,0.15)',
                  cursor: 'pointer'
                }}
                onClick={() => setPenColor(c)}
              />
            ))}
          </div>

          <button type="button" className="btn btn-icon btn-sm" onClick={handleUndo} title="Undo stroke">
            <IconUndo size={14} />
          </button>

          <button type="button" className="btn btn-sm" onClick={handleClear} title="Clear annotations" style={{ color: 'var(--danger)' }}>
            <IconTrash size={14} />
          </button>

          <button type="button" className="btn btn-sm btn-primary" onClick={handleSave} title="Save Annotations">
            <IconCheck size={14} />
            Save
          </button>

          <button type="button" className="btn btn-icon btn-sm" onClick={onClose} title="Close without saving">
            <IconClose size={14} />
          </button>
        </div>
      )}

      {/* Freehand Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          touchAction: 'none',
          cursor: isEditing ? (activeTool === 'pen' ? 'crosshair' : 'text') : 'default'
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />

      {/* Draggable & Editable Text Boxes */}
      {textBoxes.map(tb => (
        <div
          key={tb.id}
          className="annotation-text-box-item"
          style={{
            position: 'absolute',
            left: `${tb.x * 100}%`,
            top: `${tb.y * 100}%`,
            background: isEditing ? 'var(--bg-surface)' : 'rgba(255, 255, 255, 0.92)',
            border: `2px solid ${tb.color || 'var(--lime-primary)'}`,
            borderRadius: 'var(--radius-xs)',
            padding: '3px 8px',
            fontSize: '0.82rem',
            fontWeight: 600,
            color: 'var(--text-main)',
            boxShadow: 'var(--shadow-sm)',
            cursor: isEditing ? 'grab' : 'default',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            pointerEvents: isEditing ? 'auto' : 'none',
            zIndex: 10
          }}
          onPointerDown={e => isEditing && handleBoxDragStart(e, tb.id)}
          onClick={e => e.stopPropagation()}
        >
          {isEditing && (
            <span style={{ cursor: 'grab', opacity: 0.6, fontSize: '0.75rem' }} aria-hidden="true">
              :::
            </span>
          )}

          {isEditing ? (
            <input
              type="text"
              value={tb.text}
              spellCheck={false}
              autoCorrect="off"
              style={{
                border: 'none',
                background: 'transparent',
                color: 'inherit',
                fontSize: 'inherit',
                fontWeight: 'inherit',
                outline: 'none',
                minWidth: '60px'
              }}
              onChange={e => {
                const val = e.target.value;
                setTextBoxes(prev => prev.map(b => b.id === tb.id ? { ...b, text: val } : b));
              }}
            />
          ) : (
            <span>{tb.text}</span>
          )}

          {isEditing && (
            <button
              type="button"
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--danger)',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
              onClick={() => setTextBoxes(prev => prev.filter(b => b.id !== tb.id))}
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
};
