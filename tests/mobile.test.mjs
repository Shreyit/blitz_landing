import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";

const base = process.env.BLITZ_TEST_URL || "http://127.0.0.1:3000";
const { regions } = JSON.parse(readFileSync(new URL("../shared/registration-options.json", import.meta.url)));
const photo = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l3sAAAAASUVORK5CYII=", "base64");
const player = { id: "mobile-test", name: "A very long campus participant name for mobile layout", programme: "BSASS", year: 2, sports: ["Football", "Table tennis"], photo: null, price: 1990, source: "auction" };
const state = {
  phase: "active", round: 0, version: 1, current: player, bid: 1990, leader: 1, next_bid: 2000,
  remaining: 1, sold: 1, total: 2,
  teams: [1, 3, 4, 5, 6, 7].map((id, index) => ({ id, name: `Campus sports team with a long name ${index + 1}`, symbol: "BT", color: "#315a36", purse: 2000, players: [player] })),
  history: [{ name: player.name, team: "Campus sports team with a long name 1", price: 1990, source: "auction" }],
};
let browser;
before(async () => {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", headless: true, args: ["--no-sandbox"] });
});
after(async () => { await browser?.close(); });

async function mobilePage(viewport = { width: 390, height: 844 }, admin = false) {
  const page = await browser.newPage({ viewport, hasTouch: true, isMobile: true, deviceScaleFactor: 2, reducedMotion: "reduce" });
  // Isolate layout tests from network availability and never mutate event data.
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auction") return route.fulfill({ json: state });
    if (path === "/api/admin/me") return route.fulfill({ status: admin ? 200 : 401, json: admin ? { authenticated: true } : { detail: "Sign in" } });
    if (path === "/api/admin/registrations") return route.fulfill({ status: admin ? 200 : 401, json: admin ? [
      { ...player, role: "player", email: "m2024bsass027@stud.tiss.ac.in", age: 20, gender: "female", region: "Andaman and Nicobar Islands", played_before: true, verified: true, volunteer_department: null, volunteer_rationale: null },
      { ...player, id: "volunteer-test", name: "Pilot volunteer", role: "volunteer", email: "pilot@stud.tiss.edu", age: 21, gender: "others", region: "Maharashtra", played_before: false, sports: [], verified: false, volunteer_department: "Operations", volunteer_rationale: "I can coordinate equipment and venue setup." },
    ] : { detail: "Sign in" } });
    if (path === "/api/admin/logout") { admin = false; return route.fulfill({ json: { authenticated: false } }); }
    if (route.request().method() === "GET") return route.fulfill({ json: [] });
    assert.equal(path, "/api/registrations", `Unexpected mutation: ${path}`);
    return route.fulfill({ status: 201, json: { id: "mobile-registration", message: "Saved" } });
  });
  await page.route("**/states.low.json", (route) => route.fulfill({ json: {
    features: regions.map((name, index) => {
      const x = 72 + index % 6, y = 15 + Math.floor(index / 6);
      return { properties: { name }, geometry: { type: "Polygon", coordinates: [[[x, y], [x + .8, y], [x + .8, y + .8], [x, y + .8], [x, y]]] } };
    }),
  } }));
  await page.routeWebSocket("**/api/auction/live", (socket) => socket.close());
  return page;
}

async function noOverflow(page, label) {
  const size = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  assert(size.document <= size.width + 1 && size.body <= size.width + 1, `${label}: page overflow ${JSON.stringify(size)}`);
}

async function touchTarget(locator) {
  const box = await locator.boundingBox();
  assert(box && box.width >= 44 && box.height >= 44, `Small touch target: ${await locator.getAttribute("aria-label") || await locator.innerText()}`);
}

for (const viewport of [
  { width: 320, height: 568 }, { width: 360, height: 800 },
  { width: 390, height: 844 }, { width: 430, height: 932 },
  { width: 768, height: 1024 }, { width: 1024, height: 768 },
  { width: 844, height: 390 },
]) {
  test(`public pages fit ${viewport.width} × ${viewport.height} touch screens`, async () => {
    const page = await mobilePage(viewport);
    try {
      for (const path of ["/", "/about", "/rules", "/register", "/teams", "/auction", "/admin", "/verify", "/missing-mobile-test-page"]) {
        await page.goto(`${base}${path}`);
        await page.locator("#main h1").waitFor();
        await page.evaluate(() => document.fonts.ready);
        if (path === "/register") await page.locator(".region-map").waitFor();
        if (path === "/teams" || path === "/auction") await page.getByText(state.teams[0].name, { exact: true }).filter({ visible: true }).first().waitFor();
        await noOverflow(page, `${path} at ${viewport.width}`);
        const menu = page.getByRole("button", { name: "Open navigation", exact: true });
        await touchTarget(menu);
        await touchTarget(page.locator(".nav-cta"));
        if (path === "/register" || path === "/admin") {
          const fontSizes = await page.locator("input:not([type=radio]):not([type=checkbox]), select, textarea").evaluateAll((fields) => fields.map((field) => parseFloat(getComputedStyle(field).fontSize)));
          assert(fontSizes.every((size) => size >= 16), `${path}: input text triggers focus zoom`);
        }
      }
    } finally { await page.close(); }
  });
}

test("tablet and landscape navigation opens, dismisses, and reaches every link", async () => {
  const page = await mobilePage({ width: 844, height: 390 });
  try {
    await page.goto(base);
    await page.getByRole("button", { name: "Open navigation", exact: true }).tap();
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("button", { name: "Open navigation", exact: true }).getAttribute("aria-expanded"), "false");
    for (const name of ["The spirit", "Rules & formats", "Registration", "Auction Dome", "The teams"]) {
      await page.getByRole("button", { name: "Open navigation", exact: true }).tap();
      await page.locator("#main-navigation").getByRole("link", { name, exact: true }).tap();
      await page.getByRole("button", { name: "Open navigation", exact: true }).waitFor();
      assert.equal(await page.locator("#main-navigation").isVisible(), false);
      await noOverflow(page, name);
    }
    await page.getByRole("button", { name: "Open navigation", exact: true }).tap();
    // Tap outside the dropdown to dismiss it without changing routes.
    await page.touchscreen.tap(10, 385);
    assert.equal(await page.locator("#main-navigation").isVisible(), false);
  } finally { await page.close(); }
});

test("every sport dialog fits narrow phones and landscape with scrollable rules", async () => {
  for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }]) {
    const page = await mobilePage(viewport);
    try {
      await page.goto(`${base}/rules`);
      for (const button of await page.locator(".rule-card-trigger").all()) {
        await button.tap();
        const dialog = page.locator(".rules-modal[open]");
        await dialog.waitFor();
        const bounds = await dialog.boundingBox();
        assert(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width + 1 && bounds.y + bounds.height <= viewport.height + 1);
        const scroll = dialog.locator(".rules-modal-scroll");
        assert.equal(await scroll.evaluate((element) => element.scrollWidth <= element.clientWidth + 1), true);
        await scroll.evaluate((element) => { element.scrollTop = element.scrollHeight; });
        await dialog.locator(".rules-modal-register").waitFor({ state: "visible" });
        await touchTarget(dialog.getByRole("button", { name: "Close sport rules" }));
        await dialog.getByRole("button", { name: "Close sport rules" }).tap();
        await dialog.waitFor({ state: "hidden" });
      }
      await page.locator(".format-final").scrollIntoViewIfNeeded();
      await touchTarget(page.getByRole("button", { name: "A1 wins" }).first());
      await noOverflow(page, "Rules and format");
    } finally { await page.close(); }
  }
});

async function details(page) {
  await page.getByLabel("Full name").fill(player.name);
  await page.getByLabel("TISS email username", { exact: true }).fill("m2024bsass027");
  await page.getByLabel("WhatsApp number", { exact: true }).fill("98765 43210");
  await page.getByLabel("Age", { exact: true }).fill("20");
  await page.getByLabel("Gender", { exact: true }).selectOption("female");
  await page.getByLabel("State or union territory", { exact: true }).selectOption("Andaman and Nicobar Islands");
  await page.getByRole("radio", { name: "Yes", exact: true }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).tap();
}

test("touch photo cropping and both registration flows fit portrait and landscape", async () => {
  for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }]) {
    for (const role of ["player", "volunteer"]) {
      const page = await mobilePage(viewport);
      try {
        await page.goto(`${base}/register?role=${role}&sport=Football`);
        await details(page);
        if (role === "volunteer") {
          await page.getByRole("radio", { name: /^Operations/ }).check();
          await page.getByLabel("Why are you suitable, and how can you contribute?", { exact: false }).fill("I can coordinate volunteers and help organise supplies for each sport.");
        }
        await page.getByLabel("Upload your photo").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: photo });
        const dialog = page.locator(".photo-crop-dialog[open]");
        await dialog.waitFor();
        await dialog.getByRole("button", { name: "Use crop", exact: true }).waitFor();
        await page.waitForFunction(() => !document.querySelector(".photo-crop-actions .button:last-child").disabled);
        const stage = page.locator(".photo-crop-stage");
        const bounds = await stage.boundingBox();
        assert(Math.abs(bounds.width - bounds.height) < 1, "Crop preview must stay square");
        const zoom = page.getByLabel("Zoom", { exact: false });
        await zoom.tap();
        assert(Number(await zoom.inputValue()) > 1, "Touch slider should zoom the photo");
        await stage.scrollIntoViewIfNeeded();
        const before = await stage.locator("img").getAttribute("style");
        const box = await stage.boundingBox();
        const session = await page.context().newCDPSession(page);
        const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
        await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...point, x: point.x + 20 }] });
        await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await session.detach();
        assert.notEqual(await stage.locator("img").getAttribute("style"), before, "Touch drag should change crop framing");
        await touchTarget(page.getByRole("button", { name: "Close photo crop", exact: true }));
        await page.getByRole("button", { name: "Use crop", exact: true }).tap();
        await dialog.waitFor({ state: "hidden" });
        await page.getByRole("button", { name: "Adjust photo crop", exact: true }).tap();
        await page.getByRole("button", { name: "Cancel", exact: true }).tap();
        await page.getByRole("button", { name: "Continue", exact: true }).tap();
        await noOverflow(page, `${role} review`);
        await page.getByRole("checkbox").check();
        const submit = page.getByRole("button", { name: "Register for BLITZ", exact: true });
        await submit.scrollIntoViewIfNeeded();
        assert.equal(await page.locator(".bolt-companion-left").evaluate((element) => getComputedStyle(element).position === "fixed"), false);
        await submit.tap();
        await page.getByRole("heading", { name: "Your registration is complete." }).waitFor();
        await noOverflow(page, `${role} success`);
      } finally { await page.close(); }
    }
  }
});

test("mobile admin profiles fit the screen and rosters remain usable", async () => {
  const page = await mobilePage({ width: 320, height: 568 }, true);
  try {
    await page.goto(`${base}/admin`);
    const card = page.getByRole("button", { name: `View ${player.name}, player registration` });
    await card.waitFor();
    await noOverflow(page, "Organiser registrations");
    await touchTarget(card);
    await card.tap();
    const profile = page.getByRole("dialog");
    await profile.waitFor();
    assert.equal(await profile.getByText("Andaman and Nicobar Islands", { exact: true }).count(), 1);
    await noOverflow(page, "Registration profile");
    const close = page.getByRole("button", { name: "Close profile", exact: true });
    await touchTarget(close);
    await close.tap();
    await page.getByRole("searchbox", { name: "Search registrations" }).fill("no-matching-person");
    await page.getByRole("heading", { name: "No matching registrations." }).waitFor();
    await page.getByRole("searchbox", { name: "Search registrations" }).fill("");
    await page.getByLabel("Role", { exact: true }).selectOption("volunteer");
    await page.getByRole("button", { name: "View Pilot volunteer, volunteer registration" }).tap();
    await page.getByRole("dialog").getByText("I can coordinate equipment and venue setup.", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Close profile", exact: true }).tap();
    await page.getByRole("button", { name: "Sign out", exact: true }).tap();
    await page.getByLabel("Organiser password", { exact: true }).waitFor();
    assert.equal(await page.locator(".roster-card").count(), 0);
    assert.equal(await page.getByRole("dialog").count(), 0);
    await page.goto(`${base}/teams`);
    await page.locator(".team-card summary").first().tap();
    await page.locator(".roster-person").first().waitFor();
    await noOverflow(page, "Expanded roster");
  } finally { await page.close(); }
});

test("the map supports touch zoom and pan without changing the selected region", async () => {
  const page = await mobilePage();
  try {
    await page.goto(`${base}/register`);
    const map = page.locator(".region-map");
    await map.waitFor();
    const region = page.getByLabel("State or union territory", { exact: true });
    await region.selectOption("Maharashtra");
    const zoomIn = page.getByRole("button", { name: "Zoom in on India map", exact: true });
    await touchTarget(zoomIn);
    await zoomIn.tap();
    const before = await map.getAttribute("viewBox");
    assert.notEqual(before, "0 0 520 560");
    await map.scrollIntoViewIfNeeded();
    const box = await map.boundingBox();
    const session = await page.context().newCDPSession(page);
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...point, x: point.x + 40 }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await session.detach();
    assert.notEqual(await map.getAttribute("viewBox"), before);
    assert.equal(await region.inputValue(), "Maharashtra");
    await page.getByRole("button", { name: "Reset India map view", exact: true }).tap();
    assert.equal(await map.getAttribute("viewBox"), "0 0 520 560");
    await region.selectOption("Andaman and Nicobar Islands");
    await page.waitForFunction(() => document.querySelector(".region-map").getAttribute("viewBox") !== "0 0 520 560");
    assert.equal(await region.inputValue(), "Andaman and Nicobar Islands");
    await noOverflow(page, "Touch region map");
  } finally { await page.close(); }
});
