#!/usr/bin/env node
/**
 * Capture screenshots for user docs. Used by /document-feature.
 *
 * Usage: node .claude/scripts/capture-screenshots.cjs <spec.json>
 *
 * spec.json:
 * {
 *   "baseUrl": "http://localhost:3000",
 *   "outDir": "docs/user/images/how-to-reset-password",
 *   "seedSampleData": true,            // click "Load sample data" on an empty store first
 *   "viewport": { "width": 1280, "height": 800 },
 *   "shots": [
 *     { "name": "01-dashboard", "path": "/", "fullPage": false },
 *     { "name": "02-form", "path": "/expenses",
 *       "actions": [ { "click": "role=button[name=/add expense/i]" }, { "waitFor": "role=dialog" } ],
 *       "selector": "role=dialog" }   // optional: capture one element instead of the page
 *   ]
 * }
 *
 * Exit codes: 0 = all shots saved, 1 = some shots failed (others saved),
 *             2 = bad arguments, 3 = Playwright or a browser is not available.
 * Prints one JSON line per shot: {"name","file","ok","error"?}
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function loadPlaywright() {
  const roots = [process.cwd()];
  try {
    roots.push(execSync("npm root -g", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim());
  } catch {}
  for (const name of ["playwright", "playwright-core", "@playwright/test"]) {
    for (const root of roots) {
      try {
        return require(require.resolve(name, { paths: [root] }));
      } catch {}
    }
  }
  return null;
}

async function main() {
  const specPath = process.argv[2];
  if (!specPath || !fs.existsSync(specPath)) {
    console.error("usage: capture-screenshots.cjs <spec.json>");
    process.exit(2);
  }
  const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
  const pw = loadPlaywright();
  if (!pw || !pw.chromium) {
    console.error("playwright not found (install with: npm i -g playwright && npx playwright install chromium)");
    process.exit(3);
  }

  let browser;
  try {
    browser = await pw.chromium.launch();
  } catch (e) {
    console.error("could not launch chromium: " + e.message.split("\n")[0]);
    process.exit(3);
  }

  const outDir = spec.outDir || "docs/user/images";
  fs.mkdirSync(outDir, { recursive: true });
  const context = await browser.newContext({ viewport: spec.viewport || { width: 1280, height: 800 } });
  const page = await context.newPage();
  const base = (spec.baseUrl || "http://localhost:3000").replace(/\/$/, "");

  if (spec.seedSampleData) {
    try {
      await page.goto(base + "/", { waitUntil: "networkidle" });
      const btn = page.getByRole("button", { name: /load sample data/i });
      if (await btn.count()) await btn.first().click();
      await page.waitForTimeout(300);
    } catch {}
  }

  let failed = 0;
  for (const shot of spec.shots || []) {
    const file = path.join(outDir, `${shot.name}.png`);
    try {
      await page.goto(base + (shot.path || "/"), { waitUntil: "networkidle" });
      for (const a of shot.actions || []) {
        if (a.click) await page.locator(a.click).first().click();
        if (a.fill) await page.locator(a.fill.selector).first().fill(a.fill.value);
        if (a.waitFor) await page.locator(a.waitFor).first().waitFor();
        if (a.wait) await page.waitForTimeout(a.wait);
      }
      await page.waitForTimeout(250); // let transitions settle
      if (shot.selector) {
        await page.locator(shot.selector).first().screenshot({ path: file });
      } else {
        await page.screenshot({ path: file, fullPage: !!shot.fullPage });
      }
      console.log(JSON.stringify({ name: shot.name, file, ok: true }));
    } catch (e) {
      failed++;
      console.log(JSON.stringify({ name: shot.name, file, ok: false, error: e.message.split("\n")[0] }));
    }
  }

  await browser.close();
  process.exit(failed ? 1 : 0);
}

main();
