import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { INITIAL_MAP_VIEWPORT, clampMapViewport, focusMapRegion, indiaStateShapes, mapViewBox, zoomMap } from "../src/lib/india-map.ts";

test("registration options include the four volunteer departments, three genders, and all 36 regions", () => {
  const options = JSON.parse(readFileSync(new URL("../shared/registration-options.json", import.meta.url)));
  assert.deepEqual(options.volunteerDepartments, ["Digital & Marketing", "Operations", "Medical", "Sustainability"]);
  assert.deepEqual(options.genders, ["male", "female", "others"]);
  assert.equal(new Set(options.regions).size, 36);
  for (const region of ["Andaman and Nicobar Islands", "Ladakh", "Telangana", "Lakshadweep", "Dadra and Nagar Haveli and Daman and Diu"])
    assert(options.regions.includes(region));
});

test("map projection preserves polygon holes and island shapes and fits the map frame", () => {
  const shapes = indiaStateShapes({ features: [
    { properties: { name: "Maharashtra" }, geometry: { type: "Polygon", coordinates: [
      [[72, 17], [81, 17], [81, 22], [72, 22], [72, 17]],
      [[74, 18], [75, 18], [75, 19], [74, 19], [74, 18]],
    ] } },
    { properties: { name: "Andaman and Nicobar" }, geometry: { type: "MultiPolygon", coordinates: [
      [[[92, 11], [93, 11], [93, 12], [92, 11]]],
      [[[92, 8], [93, 8], [93, 9], [92, 8]]],
    ] } },
  ] });
  assert.equal(shapes[1].name, "Andaman and Nicobar Islands");
  assert.equal(shapes[0].path.match(/M/g).length, 2);
  assert.equal(shapes[1].path.match(/M/g).length, 2);
  for (const shape of shapes) {
    assert(!/NaN|Infinity/.test(shape.path));
    const numbers = shape.path.match(/\d+(?:\.\d+)?/g).map(Number);
    for (let i = 0; i < numbers.length; i += 2) {
      assert(numbers[i] >= 0 && numbers[i] <= 520);
      assert(numbers[i + 1] >= 0 && numbers[i + 1] <= 560);
    }
  }
});

test("small territories have a larger selectable marker; empty boundary data fails", () => {
  const shapes = indiaStateShapes({ features: [
    { properties: { name: "Maharashtra" }, geometry: { type: "Polygon", coordinates: [[[70, 10], [90, 10], [90, 35], [70, 10]]] } },
    { properties: { name: "NCT of Delhi" }, geometry: { type: "Polygon", coordinates: [[[77, 28], [77.1, 28], [77.1, 28.1], [77, 28]]] } },
  ] });
  assert.equal(shapes[1].name, "Delhi");
  assert(shapes[1].marker);
  assert.equal(shapes[0].marker, null);
  assert.throws(() => indiaStateShapes({ features: [] }), /No state boundaries/);
});

test("zoom preserves the map centre, respects limits, and resets to the full map", () => {
  const zoomed = zoomMap(INITIAL_MAP_VIEWPORT, 2);
  assert.equal(zoomed.zoom, 2);
  assert.equal(zoomed.x + 260 / zoomed.zoom, 260);
  assert.equal(zoomed.y + 280 / zoomed.zoom, 280);
  assert.equal(zoomMap(zoomed, 100).zoom, 5);
  assert.deepEqual(zoomMap(zoomed, .01), INITIAL_MAP_VIEWPORT);
  assert.equal(mapViewBox(INITIAL_MAP_VIEWPORT), "0 0 520 560");
  assert.equal(mapViewBox(zoomed), "130 140 260 280");
});

test("panning stays within the country frame and island focus includes the entire archipelago", () => {
  assert.deepEqual(clampMapViewport({ x: -100, y: 999, zoom: 2 }), { x: 0, y: 280, zoom: 2 });
  const islands = { x: 410, y: 390, width: 25, height: 130 };
  const view = focusMapRegion(islands);
  assert(view.zoom > 1);
  assert(view.x <= islands.x && view.x + 520 / view.zoom >= islands.x + islands.width);
  assert(view.y <= islands.y && view.y + 560 / view.zoom >= islands.y + islands.height);
  assert.deepEqual(INITIAL_MAP_VIEWPORT, { x: 0, y: 0, zoom: 1 });
});
