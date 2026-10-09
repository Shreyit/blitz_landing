import test from "node:test";
import assert from "node:assert/strict";
import { cropArea, dragPhotoCrop, INITIAL_PHOTO_CROP, PHOTO_SIZE } from "../src/lib/photo-crop.ts";

test("a 1:1 crop fits portrait, landscape, and square photos", () => {
  assert.deepEqual(cropArea(600, 1000, INITIAL_PHOTO_CROP), { x: 0, y: 200, side: 600 });
  assert.deepEqual(cropArea(1000, 600, INITIAL_PHOTO_CROP), { x: 200, y: 0, side: 600 });
  assert.deepEqual(cropArea(600, 600, INITIAL_PHOTO_CROP), { x: 0, y: 0, side: 600 });
  assert.equal(PHOTO_SIZE, 600);
});

test("zoom and dragging cannot reveal blank space outside a photo", () => {
  for (const [width, height] of [[600, 1000], [1000, 600], [600, 600]]) {
    for (const zoom of [1, 2, 3]) {
      for (const [dx, dy] of [[-10, -10], [10, 10], [-10, 10], [10, -10]]) {
        const crop = dragPhotoCrop(width, height, { ...INITIAL_PHOTO_CROP, zoom }, dx, dy);
        const area = cropArea(width, height, crop);
        assert(area.x >= 0 && area.y >= 0);
        assert(area.x + area.side <= width && area.y + area.side <= height);
      }
    }
  }
});

test("dragging moves the photo with the pointer and a full-width crop locks the horizontal axis", () => {
  const portrait = dragPhotoCrop(600, 1000, INITIAL_PHOTO_CROP, 1, .1);
  assert.equal(portrait.x, 0);
  assert(cropArea(600, 1000, portrait).y < 200);
  const landscape = dragPhotoCrop(1000, 600, INITIAL_PHOTO_CROP, .1, 1);
  assert.equal(landscape.y, 0);
  assert(cropArea(1000, 600, landscape).x < 200);
  assert.deepEqual(INITIAL_PHOTO_CROP, { zoom: 1, x: 0, y: 0 });
  assert.throws(() => cropArea(0, 100, INITIAL_PHOTO_CROP), /Invalid photo/);
});
