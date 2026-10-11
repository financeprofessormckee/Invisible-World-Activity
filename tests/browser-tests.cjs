/* Optional integration suite: npm install --no-save playwright@1.62.1
   npx playwright install chromium && node tests/browser-tests.cjs */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const IW = require('../js/model.js');
const url = pathToFileURL(path.join(__dirname, '../index.html')).href;
let checks = 0;
function ok(value, message) { assert.ok(value, message); checks++; }
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    const open = async (good = 'wool', seed = 'AUDIT235') => {
      await page.goto(url + '?good=' + good + '&seed=' + seed);
      await page.locator('#scenario-code').waitFor();
    };
    const settings = async values => {
      for (let i = 0; i < values.length; i++) {
        await page.locator('#var-' + i).focus();
        await page.keyboard.press('Home');
        for (let n = 0; n < values[i]; n++) await page.keyboard.press('ArrowRight');
      }
    };
    const through = async (a, b, kind) => {
      await page.locator('#thru-1').selectOption(String(a));
      await page.locator('#thru-2').selectOption(String(b));
      await page.locator('#thru-apply').click();
      await page.locator('input[value="' + kind + '"]').check();
      await page.locator('#attach').selectOption('0');
      await page.locator('#check').click();
    };
    // Reproduce the formerly scoreable duplicate-point/horizontal-line exploit through the UI.
    await open();
    await page.locator('#observe').click();
    const w = IW.createWorld('wool', 'AUDIT235');
    const p = IW.toDisplay(w.commodity.price, IW.equilibrium(w, w.initial).P);
    for (const [id, value] of Object.entries({ q1: 0, q2: 200, p1: p, p2: p }))
      await page.locator('#' + id).fill(String(value));
    await page.locator('#check').click();
    ok((await page.locator('#curve-feedback').innerText()).includes('two different quantities'), 'duplicate evidence refused');
    ok(await page.locator('#score').innerText() === '95', 'invalid evidence incurs no check penalty');
    await page.locator('#q1').fill('999');
    await page.locator('#check').click();
    ok(await page.locator('#q1').inputValue() === '999', 'out-of-range value is not silently clamped');
    ok(await page.locator('#q1').getAttribute('aria-invalid') === 'true', 'invalid endpoint marked');
    ok((await page.locator('#curve-feedback').innerText()).includes('ranges'), 'range error explained');
    // All three classroom markets, exact point selection, then rounded typed endpoints.
    for (const good of ['wool', 'icecream', 'homes']) {
      await open(good, 'CLASS1');
      const world = IW.createWorld(good, 'CLASS1'), initial = world.initial;
      const supply = initial.slice(); supply[0] = initial[0] === 4 ? 0 : 4;
      const demand = initial.slice(); demand[1] = initial[1] === 4 ? 0 : 4;
      await settings(supply); await page.locator('#observe').click();
      await settings(demand); await page.locator('#observe').click();
      await through(0, 1, 'demand');
      ok((await page.locator('#found').innerText()).includes('Demand found'), good + ' demand accepted');
      const a = IW.equilibrium(world, initial), c = IW.equilibrium(world, demand);
      for (const [id, value] of Object.entries({q1:a.Q,p1:a.P,q2:c.Q,p2:c.P})) {
        const axis = id[0] === 'q' ? world.commodity.quantity : world.commodity.price;
        await page.locator('#' + id).fill(String(IW.toDisplay(axis, value)));
      }
      await page.locator('#check').click();
      ok(await page.locator('#results').isVisible(), good + ' completes');
      ok(await page.locator('#score').innerText() === '90', good + ' score 90');
      ok(await page.locator('#results-heading').evaluate(el => el === document.activeElement), 'finish focuses heading');
      await page.locator('#log-action-1').focus();
      await page.keyboard.press('Enter');
      ok(await page.locator('#log-action-1').evaluate(el => el === document.activeElement), 'replay preserves focus');
      ok((await page.locator('#replay-text').innerText()).includes('same demand curve'), 'replay explains identification');
      await page.locator('#play-again').click();
      ok(await page.locator('#thru-1').inputValue() === '', 'new world resets old point selection');
      ok(await page.locator('#var-0').evaluate(el => el === document.activeElement), 'new world focuses conditions');
    }
    // Observation cap leaves checking available; no runtime error during replay or market changes.
    await open();
    for (let n = 1; n < 12; n++) await page.locator('#observe').click();
    ok(await page.locator('#observe').isDisabled(), 'observation cap enforced');
    ok(await page.locator('#check').isEnabled(), 'checking remains available at cap');
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no page overflow at ' + width);
    }
    ok(await page.locator('#graph').evaluate(el => getComputedStyle(el).touchAction === 'pan-y'), 'plot allows vertical touch scrolling');
    ok(await page.locator('#share-link').getAttribute('target') === '_blank', 'share link preserves current game');
    ok(errors.length === 0, 'no uncaught errors: ' + errors.join('; '));
    if (process.env.SCREENSHOT_PATH) await page.screenshot({ path: process.env.SCREENSHOT_PATH, fullPage: true });
    console.log(checks + ' browser checks passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
