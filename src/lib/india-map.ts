export const INDIA_MAP_SOURCE = "https://raw.githubusercontent.com/Vardhan-Systems/vardhan-maps/main/src/data/generated/states.low.json";
export const INDIA_MAP_VIEWBOX = "0 0 520 560";
export const INITIAL_MAP_VIEWPORT = { x: 0, y: 0, zoom: 1 };
export type MapViewport = typeof INITIAL_MAP_VIEWPORT;
export type MapBounds = { x: number; y: number; width: number; height: number };

export function clampMapViewport(view: MapViewport): MapViewport {
  const zoom = Math.max(1, Math.min(5, view.zoom));
  return { zoom, x: Math.max(0, Math.min(520 - 520 / zoom, view.x)), y: Math.max(0, Math.min(560 - 560 / zoom, view.y)) };
}

export function zoomMap(view: MapViewport, factor: number): MapViewport {
  const zoom = Math.max(1, Math.min(5, view.zoom * factor));
  return clampMapViewport({ zoom, x: view.x + 260 / view.zoom - 260 / zoom, y: view.y + 280 / view.zoom - 280 / zoom });
}

export function focusMapRegion(bounds: MapBounds): MapViewport {
  const zoom = Math.max(1, Math.min(5, 520 / (bounds.width + 40), 560 / (bounds.height + 40)));
  return clampMapViewport({ zoom, x: bounds.x + bounds.width / 2 - 260 / zoom, y: bounds.y + bounds.height / 2 - 280 / zoom });
}

export function mapViewBox(view: MapViewport) {
  return `${view.x} ${view.y} ${520 / view.zoom} ${560 / view.zoom}`;
}

type Point = [number, number];
type Geometry = { type: "Polygon"; coordinates: Point[][] } | { type: "MultiPolygon"; coordinates: Point[][][] };
export type IndiaGeoJSON = { features: { properties: { name: string }; geometry: Geometry }[] };
export type StateShape = { name: string; path: string; marker: Point | null; bounds: MapBounds };

function canonicalName(value: string) {
  const name = value.replaceAll("&", "and").replace(/\s+/g, " ").trim();
  const aliases: Record<string, string> = {
    "NCT of Delhi": "Delhi", "National Capital Territory of Delhi": "Delhi",
    "Andaman and Nicobar": "Andaman and Nicobar Islands", Orissa: "Odisha", Pondicherry: "Puducherry",
  };
  return aliases[name] || name;
}

// Convert the GeoJSON boundary polygons to a compact SVG using a Mercator projection.
export function indiaStateShapes(data: IndiaGeoJSON): StateShape[] {
  const project = ([longitude, latitude]: Point): Point => [
    longitude * Math.PI / 180,
    -Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360)),
  ];
  const shapes = data.features.map((feature) => ({
    name: canonicalName(feature.properties.name),
    polygons: (feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates)
      .map((polygon) => polygon.map((ring) => ring.map(project))),
  }));
  const points = shapes.flatMap((shape) => shape.polygons.flat(2));
  if (!points.length) throw new Error("No state boundaries found.");
  const bounds = (vertices: Point[]) => vertices.reduce((box, [x, y]) => ({
    minX: Math.min(box.minX, x), maxX: Math.max(box.maxX, x),
    minY: Math.min(box.minY, y), maxY: Math.max(box.maxY, y),
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
  const { minX, maxX, minY, maxY } = bounds(points);
  const scale = Math.min(480 / (maxX - minX), 520 / (maxY - minY));
  if (!Number.isFinite(scale)) throw new Error("Invalid state boundaries.");
  const offsetX = (520 - (maxX - minX) * scale) / 2;
  const offsetY = (560 - (maxY - minY) * scale) / 2;
  const fit = ([x, y]: Point): Point => [offsetX + (x - minX) * scale, offsetY + (y - minY) * scale];
  return shapes.map(({ name, polygons }) => {
    const fitted = polygons.map((polygon) => polygon.map((ring) => ring.map(fit)));
    const vertices = fitted.flat(2);
    const { minX: left, maxX: right, minY: top, maxY: bottom } = bounds(vertices);
    return {
      name,
      bounds: { x: left, y: top, width: right - left, height: bottom - top },
      path: fitted.flatMap((polygon) => polygon.map((ring) => ring.map(([x, y], index) =>
        `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ") + "Z")).join(" "),
      marker: Math.max(right - left, bottom - top) < 12 ? [(left + right) / 2, (top + bottom) / 2] : null,
    };
  });
}
