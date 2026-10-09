"use client";

import { useEffect, useRef, useState } from "react";
import { Crop, RotateCcw, X } from "lucide-react";
import { INITIAL_PHOTO_CROP, cropArea, dragPhotoCrop, exportPhotoCrop, type PhotoCrop } from "@/lib/photo-crop";

export function PhotoCropper({ file, initialCrop = INITIAL_PHOTO_CROP, onApply, onCancel }: {
  file: File; initialCrop?: PhotoCrop; onApply: (file: File, crop: PhotoCrop) => void; onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const image = useRef<HTMLImageElement | null>(null);
  const [url, setUrl] = useState("");
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [crop, setCrop] = useState(initialCrop);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ pointer: number; x: number; y: number; width: number; crop: PhotoCrop } | null>(null);

  useEffect(() => {
    let active = true;
    const source = URL.createObjectURL(file);
    const decoded = new Image();
    setUrl(source);
    decoded.onload = () => {
      if (!active) return;
      if (decoded.naturalWidth * decoded.naturalHeight > 12_000_000) {
        setError("Choose a photo up to 12 megapixels.");
        return;
      }
      image.current = decoded;
      setSize({ width: decoded.naturalWidth, height: decoded.naturalHeight });
    };
    decoded.onerror = () => { if (active) setError("This photo couldn’t be opened. Please choose a valid JPEG, PNG or WebP image."); };
    decoded.src = source;
    const opener = document.activeElement;
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    const modal = dialog.current;
    modal?.showModal();
    return () => {
      active = false;
      decoded.onload = decoded.onerror = null;
      image.current = null;
      URL.revokeObjectURL(source);
      modal?.close();
      root.style.overflow = overflow;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, [file]);

  async function apply() {
    if (!image.current || saving) return;
    setSaving(true);
    setError("");
    try {
      const cropped = await exportPhotoCrop(image.current, crop, file.name);
      onApply(cropped, crop);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn’t save this crop. Please try again.");
      setSaving(false);
    }
  }

  const area = size ? cropArea(size.width, size.height, crop) : null;
  return (
    <dialog ref={dialog} className="photo-crop-dialog" aria-labelledby="photo-crop-title" aria-describedby="photo-crop-help" data-lenis-prevent
      onCancel={(event) => { event.preventDefault(); if (!saving) onCancel(); }}>
      <div className="photo-crop-header"><div><span className="section-kicker">Your team photo · 1:1</span><h2 id="photo-crop-title">Find your best frame.</h2></div>
        <button type="button" className="photo-crop-close" aria-label="Close photo crop" disabled={saving} onClick={onCancel}><X size={19}/></button>
      </div>
      <p id="photo-crop-help">Drag to position your photo and adjust the zoom. Keep your face inside the square.</p>
      <div className="photo-crop-stage" role="img" aria-label="Square photo crop preview" tabIndex={0} data-dragging={dragging}
        onPointerDown={(event) => {
          if (!size || saving || event.button !== 0 || !event.isPrimary) return;
          event.currentTarget.focus({ preventScroll: true });
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, width: event.currentTarget.getBoundingClientRect().width, crop };
          setDragging(true);
        }}
        onPointerMove={(event) => {
          const session = drag.current;
          if (!size || !session || event.pointerId !== session.pointer) return;
          setCrop(dragPhotoCrop(size.width, size.height, session.crop, (event.clientX - session.x) / session.width, (event.clientY - session.y) / session.width));
        }}
        onPointerUp={(event) => {
          if (drag.current?.pointer !== event.pointerId) return;
          drag.current = null;
          setDragging(false);
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => { drag.current = null; setDragging(false); }}
        onLostPointerCapture={() => { drag.current = null; setDragging(false); }}
        onKeyDown={(event) => {
          if (!size || saving) return;
          const movement: Record<string, [number, number]> = { ArrowLeft: [-.05, 0], ArrowRight: [.05, 0], ArrowUp: [0, -.05], ArrowDown: [0, .05] };
          const direction = movement[event.key];
          if (direction) { event.preventDefault(); setCrop((current) => dragPhotoCrop(size.width, size.height, current, ...direction)); }
        }}>
        {size && area ? <><img src={url} alt="" draggable={false} style={{ width: `${size.width / area.side * 100}%`, height: `${size.height / area.side * 100}%`, left: `${-area.x / area.side * 100}%`, top: `${-area.y / area.side * 100}%` }}/><div className="photo-crop-grid" aria-hidden="true"/></>
          : <span role="status">{error ? "Photo unavailable" : "Opening your photo…"}</span>}
      </div>
      <div className="photo-crop-adjust"><label htmlFor="photo-crop-zoom">Zoom <output>{crop.zoom.toFixed(2)}×</output></label>
        <input id="photo-crop-zoom" type="range" min={1} max={3} step={.05} value={crop.zoom} disabled={!size || saving}
          onChange={(event) => setCrop((current) => ({ ...current, zoom: Number(event.target.value) }))}/>
        <button type="button" className="secondary-link" disabled={!size || saving} onClick={() => setCrop(INITIAL_PHOTO_CROP)}><RotateCcw size={14}/>Reset crop</button>
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="photo-crop-actions"><button type="button" className="button button-outline" disabled={saving} onClick={onCancel}>Cancel</button>
        <button type="button" className="button" disabled={!size || saving} onClick={apply}>{saving ? "Saving crop…" : "Use crop"}<Crop size={16}/></button>
      </div>
    </dialog>
  );
}
