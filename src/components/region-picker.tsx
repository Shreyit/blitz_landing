"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Minus, Plus, RotateCcw } from "lucide-react";
import { REGIONS } from "@/lib/registration-options";
import { INDIA_MAP_SOURCE, INITIAL_MAP_VIEWPORT, clampMapViewport, focusMapRegion, indiaStateShapes, mapViewBox, zoomMap, type MapViewport, type StateShape } from "@/lib/india-map";

const ISLANDS = "Andaman and Nicobar Islands";

export function RegionPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [shapes, setShapes] = useState<StateShape[]>([]);
  const [hovered, setHovered] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [viewport, setViewport] = useState(INITIAL_MAP_VIEWPORT);
  const [panning, setPanning] = useState(false);
  const suppressClick = useRef(false);
  const drag = useRef<{ pointer: number; clientX: number; clientY: number; x: number; y: number; inverse: DOMMatrix; viewport: MapViewport; moved: boolean } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 12000);
    setStatus("loading");
    fetch(INDIA_MAP_SOURCE, { signal: controller.signal, cache: "force-cache" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Map unavailable");
        const boundaries = indiaStateShapes(await response.json());
        if (new Set(boundaries.map((shape) => shape.name)).size !== REGIONS.length ||
          boundaries.some((shape) => !REGIONS.includes(shape.name))) throw new Error("Incomplete state map");
        if (!controller.signal.aborted) { setShapes(boundaries); setStatus("ready"); }
      })
      .catch(() => { if (active) setStatus("error"); })
      .finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [attempt]);

  useEffect(() => {
    if (value !== ISLANDS) return;
    const islands = shapes.find((shape) => shape.name === ISLANDS);
    if (islands) setViewport(focusMapRegion(islands.bounds));
  }, [value, shapes]);

  return (
    <div className="field full region-field">
      <span id="registration-region-title">Region</span>
      <small id="registration-region-help">Select the state or union territory you belong to on the map, or choose it from the list.</small>
      <div className="region-picker">
        <div className="region-map-frame">
          <div className="region-map-tools" aria-label="Map controls">
            <div className="region-map-zoom">
              <button type="button" aria-label="Zoom out on India map" disabled={status !== "ready" || viewport.zoom <= 1} onClick={() => setViewport((view) => zoomMap(view, 1 / 1.5))}><Minus size={16}/></button>
              <output aria-label="Map zoom level">{Math.round(viewport.zoom * 100)}%</output>
              <button type="button" aria-label="Zoom in on India map" disabled={status !== "ready" || viewport.zoom >= 5} onClick={() => setViewport((view) => zoomMap(view, 1.5))}><Plus size={16}/></button>
              <button type="button" aria-label="Reset India map view" disabled={status !== "ready"} onClick={() => setViewport(INITIAL_MAP_VIEWPORT)}><RotateCcw size={15}/></button>
            </div>
          </div>
          {status === "ready" ? (
            <svg viewBox={mapViewBox(viewport)} role="group" aria-label="India: select your state or union territory" className="region-map" data-panning={panning}
              onPointerDown={(event) => {
                if (event.button !== 0 || !event.isPrimary) return;
                const inverse = event.currentTarget.getScreenCTM()?.inverse();
                if (!inverse) return;
                const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(inverse);
                suppressClick.current = false;
                drag.current = { pointer: event.pointerId, clientX: event.clientX, clientY: event.clientY, x: point.x, y: point.y, inverse, viewport, moved: false };
              }}
              onPointerMove={(event) => {
                const session = drag.current;
                if (!session || event.pointerId !== session.pointer) return;
                if (!session.moved && Math.hypot(event.clientX - session.clientX, event.clientY - session.clientY) < 5) return;
                if (!session.moved) { session.moved = true; event.currentTarget.setPointerCapture(event.pointerId); setPanning(true); setHovered(""); }
                const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(session.inverse);
                setViewport(clampMapViewport({ ...session.viewport, x: session.viewport.x + session.x - point.x, y: session.viewport.y + session.y - point.y }));
              }}
              onPointerUp={(event) => {
                if (drag.current?.pointer !== event.pointerId) return;
                suppressClick.current = drag.current.moved;
                drag.current = null;
                setPanning(false);
                if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
              }}
              onPointerCancel={() => { drag.current = null; setPanning(false); }}
              onLostPointerCapture={() => { if (drag.current?.moved) suppressClick.current = true; drag.current = null; setPanning(false); }}
              onClickCapture={(event) => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}>
              {shapes.map((shape) => (
                <g key={shape.name} role="button" tabIndex={0} aria-label={`Select ${shape.name}`} aria-pressed={value === shape.name}
                  className="region-map-state" onClick={() => onChange(shape.name)}
                  onPointerEnter={() => setHovered(shape.name)} onPointerLeave={() => setHovered("")}
                  onFocus={() => setHovered(shape.name)} onBlur={() => setHovered("")}
                  onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onChange(shape.name); } }}>
                  <title>{shape.name}</title><path d={shape.path} fillRule="evenodd" vectorEffect="non-scaling-stroke" />
                  {shape.marker && <circle cx={shape.marker[0]} cy={shape.marker[1]} r={6 / viewport.zoom} vectorEffect="non-scaling-stroke" />}
                </g>
              ))}
            </svg>
          ) : (
            <div className="region-map-message" role="status"><MapPin size={30}/><p>{status === "loading" ? "Loading the India map…" : "The map couldn’t load. You can still select your state below."}</p>
              {status === "error" && <button type="button" className="secondary-link" onClick={() => setAttempt(attempt + 1)}>Retry map</button>}
            </div>
          )}
          <div className="region-map-caption" aria-live="polite"><MapPin size={15}/>{hovered || value || "Your home state, your team spirit."}</div>
        </div>
        <div className="region-selection">
          <label htmlFor="registration-region">State or union territory</label>
          <select id="registration-region" name="region" required value={value} aria-describedby="registration-region-help"
            onChange={(event) => onChange(event.target.value)}>
            <option value="" disabled>Select your state or UT</option>
            {REGIONS.map((region) => <option key={region} value={region}>{region}</option>)}
          </select>
          <p className="region-map-credit">Map: <a href="https://github.com/Vardhan-Systems/vardhan-maps" target="_blank" rel="noreferrer">Vardhan Maps</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></p>
        </div>
      </div>
    </div>
  );
}
