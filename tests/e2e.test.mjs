import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";

async function completeDemographics(page) {
  await page.getByLabel("Age", { exact: true }).fill("20");
  await page.getByLabel("Gender", { exact: true }).selectOption("female");
  await page.getByLabel("State or union territory", { exact: true }).selectOption("Maharashtra");
  await page.getByRole("radio", { name: "No", exact: true }).check();
}

const base = process.env.BLITZ_TEST_URL || "http://127.0.0.1:3000";
let browser;
before(async () => {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
});
after(async () => {
  await browser?.close();
});

test("public navigation and mobile layout", async () => {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  await page.goto(base);
  assert.match(await page.locator("h1").innerText(), /Bachelor’s\s*BLITZ/);
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "The spirit", exact: true }).click();
  await page
    .getByRole("heading", { name: /Good games.*Better connections/ })
    .waitFor();
  await page.close();
});

test("registration reviews selected details without sending real mail", async () => {
  const page = await browser.newPage({ reducedMotion: "reduce" });
  let submitted = false;
  await page.route("**/api/registrations", async (route) => {
    const body = route.request().postDataBuffer().toString();
    assert(
      body.includes("student@stud.tiss.ac.in") && body.includes("Football"),
    );
    submitted = true;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ id: "test-registration", message: "Saved" }),
    });
  });
  await page.goto(`${base}/register?sport=Football`);
  await page.getByLabel("Full name").fill("Test campus player");
  await page.getByLabel("TISS email username", { exact: true }).fill("student");
  assert.equal(await page.getByLabel("TISS email domain").inputValue(), "stud.tiss.ac.in");
  await completeDemographics(page);
  await page.getByRole("button", { name: "Continue" }).click();
  // A tiny valid PNG; the backend independently tests photo decoding.
  await page.getByLabel("Upload your photo").setInputFiles({
    name: "test.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l3sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page.getByRole("button", { name: "Use crop", exact: true }).click();
  await page.locator(".photo-crop-dialog").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Adjust photo crop", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.locator(".upload-box img").waitFor();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator(".review-fields").getByText("student@stud.tiss.ac.in", { exact: true }).waitFor();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Register for BLITZ" }).click();
  await page
    .getByRole("heading", { name: "Your registration is complete." })
    .waitFor();
  assert(submitted);
  await page.close();
});

test("volunteers choose one department and can submit a separate player registration", async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const { regions } = JSON.parse(readFileSync(new URL("../shared/registration-options.json", import.meta.url)));
  // Synthetic polygons exercise map selection without depending on external boundary downloads.
  await page.route("**/states.low.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    features: regions.map((name, index) => {
      const x = 72 + index % 6, y = 15 + Math.floor(index / 6);
      return { properties: { name }, geometry: { type: "Polygon", coordinates: [[[x, y], [x + .8, y], [x + .8, y + .8], [x, y + .8], [x, y]]] } };
    }),
  }) }));
  const submissions = [];
  await page.route("**/api/registrations", (route) => {
    submissions.push(route.request().postDataBuffer().toString());
    return route.fulfill({ status: 201, contentType: "application/json", body: '{"id":"saved","message":"Saved"}' });
  });
  await page.goto(`${base}/register?role=volunteer&sport=Football`);
  await page.getByText("You can register as both a player and a volunteer.", { exact: false }).waitFor();
  await page.getByLabel("Full name").fill("Campus volunteer");
  await page.getByLabel("TISS email username", { exact: true }).fill("crew");
  await page.getByLabel("Age", { exact: true }).fill("21");
  await page.getByLabel("Gender", { exact: true }).selectOption("others");
  await page.getByRole("radio", { name: "Yes", exact: true }).check();
  await page.getByRole("button", { name: "Select Maharashtra", exact: true }).click();
  assert.equal(await page.getByLabel("State or union territory", { exact: true }).inputValue(), "Maharashtra");
  await page.getByLabel("State or union territory", { exact: true }).selectOption("Delhi");
  assert.equal(await page.getByRole("button", { name: "Select Delhi", exact: true }).getAttribute("aria-pressed"), "true");
  const map = page.getByRole("group", { name: "India: select your state or union territory" });
  await page.getByRole("button", { name: "Zoom in on India map", exact: true }).click();
  assert.notEqual(await map.getAttribute("viewBox"), "0 0 520 560");
  await page.getByRole("button", { name: "Reset India map view", exact: true }).click();
  assert.equal(await map.getAttribute("viewBox"), "0 0 520 560");
  assert.equal(await page.getByLabel("State or union territory", { exact: true }).inputValue(), "Delhi");
  await page.getByLabel("State or union territory", { exact: true }).selectOption("Andaman and Nicobar Islands");
  assert.equal(await page.getByLabel("State or union territory", { exact: true }).inputValue(), "Andaman and Nicobar Islands");
  assert.notEqual(await map.getAttribute("viewBox"), "0 0 520 560");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  assert.equal(await page.locator(".sport-picker").count(), 0);
  assert.equal(await page.getByRole("radio").count(), 4);
  await page.getByRole("radio", { name: /^Operations/ }).check();
  await page.getByRole("radio", { name: /^Medical/ }).check();
  assert.equal(await page.locator('input[type="radio"]:checked').count(), 1);
  await page.getByLabel("Why are you suitable, and how can you contribute?", { exact: false }).fill("I can coordinate medical supplies and help the medical team communicate with participants.");
  await page.getByLabel("Upload your photo").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l3sAAAAASUVORK5CYII=", "base64") });
  await page.getByRole("button", { name: "Use crop", exact: true }).click();
  await page.locator(".photo-crop-dialog").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.locator(".review-fields").getByText("Medical", { exact: true }).waitFor();
  await page.locator(".review-fields").getByText("Others", { exact: true }).waitFor();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Register for BLITZ", exact: true }).click();
  await page.getByRole("heading", { name: "Your registration is complete." }).waitFor();
  assert(submissions[0].includes('name="volunteer_department"\r\n\r\nMedical'));
  assert(submissions[0].includes('name="sports"\r\n\r\n[]'));
  await page.getByRole("button", { name: "Also register as a player" }).click();
  assert.equal(await page.getByRole("checkbox", { name: "Football", exact: true }).isChecked(), true);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  assert.equal(await page.locator(".review-rationale").count(), 0);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Register for BLITZ", exact: true }).click();
  await page.getByRole("heading", { name: "Your registration is complete." }).waitFor();
  assert.equal(submissions.length, 2);
  assert(!submissions[1].includes('name="volunteer_department"'));
  assert(submissions[1].includes("Football"));
  await page.close();
});

test("region selection remains usable when the boundary download fails", async () => {
  const page = await browser.newPage({ reducedMotion: "reduce" });
  await page.route("**/states.low.json", (route) => route.abort());
  await page.goto(`${base}/register`);
  await page.getByText("The map couldn’t load. You can still select your state below.").waitFor();
  await completeDemographics(page);
  assert.equal(await page.getByLabel("State or union territory", { exact: true }).inputValue(), "Maharashtra");
  await page.close();
});

test("auction preview and eight expandable teams", async () => {
  const page = await browser.newPage({ reducedMotion: "reduce" });
  await page.route("**/api/auction", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"detail":"Offline"}',
    }),
  );
  await page.goto(`${base}/auction`);
  assert.equal(await page.locator(".mascot, .bolt-companion").count(), 0);
  await page.getByText("Read-only preview", { exact: true }).waitFor();
  assert.equal(await page.locator(".dome-kpi").count(), 8);
  await page.goto(`${base}/teams`);
  assert.equal(await page.locator(".team-card").count(), 8);
  await page.locator(".team-squad-button").first().click();
  await page.getByText("The first team-up is still to come.").first().waitFor();
  await page.close();
});

test("Bolt reacts to interactions and respects password-field privacy", async () => {
  const page = await browser.newPage({ reducedMotion: "reduce" });
  await page.goto(`${base}/admin`);
  assert.equal(
    await page.locator(".companion-mascot .bolt-backdrop").count(),
    0,
  );
  await page.getByLabel("Organiser password").focus();
  await page.locator('[data-mascot-action="peek"]').waitFor();
  await page.getByLabel("Organiser password").fill("not-a-real-password");
  await page.evaluate(() => window.dispatchEvent(new Event("scroll")));
  assert.equal(await page.locator('[data-mascot-action="peek"]').count(), 1);
  await page.getByLabel("Organiser password").press("Tab");
  await page
    .getByRole("button", { name: "Give Bolt a high-five", exact: true })
    .click();
  await page.locator('[data-mascot-action="highfive"]').waitFor();
  assert.equal(await page.getByRole("button", { name: "Change Bolt’s sports scene" }).count(), 0);
  for (const action of ["dribble", "speed", "spin", "flip", "dribble"]) {
    await page.getByRole("button", { name: "Show a trick", exact: true }).click();
    await page.locator(`[data-mascot-action="${action}"]`).waitFor();
  }
  await page.getByRole("button", { name: "Minimise Bolt" }).click();
  await page.getByRole("button", { name: "Bring Bolt back" }).click();
  await page.locator('[data-mascot-action="wave"]').waitFor();
  await page.goto(`${base}/verify`);
  await page
    .getByRole("complementary", { name: "Bolt, your BLITZ companion" })
    .waitFor();
  await page.goto(`${base}/about`);
  await page.locator(".about-mascot .mascot").waitFor();
  await page.goto(`${base}/auction`);
  assert.equal(await page.locator(".mascot, .bolt-companion").count(), 0);
  await page.close();
});

test("sports scenes, all eight registration choices and tug-of-war controls", async () => {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  await page.goto(base);
  assert.equal(await page.locator(".tug-athlete").count(), 6);
  const hero = page.locator(".hero-mascot");
  assert.equal(await hero.locator(".bolt-backdrop").count(), 1);
  assert.equal(await hero.getAttribute("data-bolt-sport"), "Football");
  assert.equal(await hero.locator(".bolt-inline-controls button").count(), 1);
  assert.equal(await page.locator(".sport-card").count(), 8);
  await hero.getByRole("button", { name: "Show a trick", exact: true }).click();
  assert.equal(await hero.getAttribute("data-mascot-action"), "dribble");
  await page
    .getByRole("button", { name: "Pull for The Strikers", exact: true })
    .click();
  assert.equal(
    await page.getByRole("meter").getAttribute("aria-valuenow"),
    "-1",
  );
  await page
    .getByRole("button", { name: "Pull for Blue Wolves", exact: true })
    .click();
  assert.equal(
    await page.getByRole("meter").getAttribute("aria-valuenow"),
    "0",
  );
  for (let i = 0; i < 6; i++)
    await page
      .getByRole("button", { name: "Pull for The Strikers", exact: true })
      .click();
  await page
    .getByText("The Strikers takes the rope!", { exact: true })
    .waitFor();
  assert(
    await page
      .getByRole("button", { name: "Pull for Blue Wolves", exact: true })
      .isDisabled(),
  );
  await page.getByRole("button", { name: "Reset tug of war" }).click();
  assert.equal(
    await page.getByRole("meter").getAttribute("aria-valuenow"),
    "0",
  );
  await page.getByLabel("Left tug team").selectOption("4");
  assert.equal(
    await page
      .locator(".tug-squad-left")
      .evaluate((node) => node.style.getPropertyValue("--bolt-jersey")),
    "#9671a5",
  );
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.goto(`${base}/register?sport=Weightlifting`);
  await page.locator('[data-bolt-sport="Weightlifting"]').first().waitFor();
  await page.getByLabel("Full name").fill("Sports test");
  await page.locator('input[name="email"]').fill("sports@tiss.edu");
  assert.equal(await page.getByLabel("TISS email username", { exact: true }).inputValue(), "sports");
  assert.equal(await page.getByLabel("TISS email domain").inputValue(), "tiss.edu");
  await completeDemographics(page);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  assert(await page.locator(".sport-picker").evaluate((node) => node.open));
  for (const sport of [
    "Football",
    "Cricket",
    "Badminton",
    "Table tennis",
    "Power lifting",
    "Chess",
    "Tug of war",
    "Dodgeball",
  ])
    assert.equal(
      await page.getByRole("checkbox", { name: sport, exact: true }).count(),
      1,
    );
  assert.equal(
    await page
      .getByRole("checkbox", { name: "Basketball", exact: true })
      .count(),
    0,
  );
  await page.getByRole("checkbox", { name: "Chess", exact: true }).check();
  await page.locator('[data-bolt-sport="Chess"]').first().waitFor();
  await page.close();
});

test("rules deep links open the selected sport and the bracket follows the supplied pairings", async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await page.goto(`${base}/rules#power-lifting`);
  const modal = page.getByRole("dialog", { name: "Power lifting", exact: true });
  await modal.waitFor();
  await modal.getByText("Under 79 kg", { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.style.overflow), "hidden");
  await modal.getByRole("button", { name: "Close sport rules" }).click();
  await modal.waitFor({ state: "hidden" });
  await page.getByRole("link", { name: "Chess", exact: true }).click();
  await page.getByRole("dialog", { name: "Chess", exact: true }).waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: /QF3 B1 vs A4/ }).click();
  assert.match(await page.locator('.quarterfinal-winners-round .bracket-match[data-active="true"]').innerText(), /Winner of QF3/);
  assert.equal(await page.locator('.bracket-connectors path[data-active="true"]').count(), 3);
  assert.equal(await page.locator('.bracket-champion[data-active="true"]').count(), 1);
  assert(await page.locator('.bracket-scroll').evaluate((node) => node.scrollWidth > node.clientWidth));
  const route = await page.locator('.semifinal-round .bracket-match[data-active="true"]').innerText();
  assert.match(route, /SF2/);
  assert.match(route, /Winner of QF3/);
  assert.match(route, /Winner of QF4/);
  await page.getByText("No third-place or bronze-medal match", { exact: true }).waitFor();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.getByRole("button", { name: "Power lifting rules and format", exact: true }).click();
  await page.getByRole("link", { name: "Register for Power lifting", exact: true }).click();
  assert(page.url().includes("sport=Weightlifting"));
  await page.close();
});

test("all eight sports open glass popups, trap focus, and restore the page on dismissal", async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  await page.goto(`${base}/rules`);
  for (const sport of ["Football", "Cricket", "Badminton", "Table tennis", "Power lifting", "Chess", "Tug of war", "Dodgeball"]) {
    const trigger = page.getByRole("button", { name: `${sport} rules and format`, exact: true });
    await trigger.click();
    const modal = page.getByRole("dialog", { name: sport, exact: true });
    await modal.waitFor();
    assert(await modal.evaluate((node) => node.matches(":modal")));
    assert.match(await modal.evaluate((node) => getComputedStyle(node, "::backdrop").backdropFilter), /blur\(12px\)/);
    assert(await modal.getByRole("button", { name: "Close sport rules" }).evaluate((node) => node === document.activeElement));
    await page.keyboard.press("Shift+Tab");
    assert(await modal.getByRole("link", { name: `Register for ${sport}`, exact: true }).evaluate((node) => node === document.activeElement));
    await page.keyboard.press("Tab");
    assert(await modal.getByRole("button", { name: "Close sport rules" }).evaluate((node) => node === document.activeElement));
    await page.keyboard.press("Escape");
    await modal.waitFor({ state: "hidden" });
    assert(await trigger.evaluate((node) => node === document.activeElement));
    assert.notEqual(await page.evaluate(() => document.documentElement.style.overflow), "hidden");
  }
  await page.getByRole("button", { name: "Football rules and format", exact: true }).click();
  await page.mouse.click(4, 4);
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.close();
});
