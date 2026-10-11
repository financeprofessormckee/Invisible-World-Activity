'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
let checks = 0;
function ok(condition, text) { assert.ok(condition, text); checks++; }
(async()=>{
 const browser = await chromium.launch({ executablePath:process.env.CHROMIUM_EXECUTABLE_PATH || undefined,args:['--no-sandbox','--disable-dev-shm-usage'] });
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}}), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>d.accept());
  await page.goto(pathToFileURL(path.join(__dirname,'../index.html')).href+'?good=wool&seed=AUDIT235');
  const initial=await page.locator('input[type="range"]').evaluateAll(nodes=>nodes.map(n=>n.value));
  const step=async id=>{await page.locator(id).focus();await page.keyboard.press('End');};
  // Optional predictions and baseline are bound to the observation, not the mutable controls.
  await page.locator('.prediction summary').click();
  await page.locator('#predict-price').selectOption('down');
  await page.locator('#predict-quantity').selectOption('up');
  await page.locator('#experiment-reason').fill('=2+3');
  await step('#var-0');
  ok((await page.locator('#baseline-diff').innerText()).includes('1 condition changed'), 'single-change feedback');
  await page.locator('#observe').click();
  ok((await page.locator('#comparison-summary').innerText()).includes('A → B: 1 condition changed'), 'automatic evidence comparison');
  ok(!await page.locator('#comparison-explanation').isVisible(), 'no hidden curve explanation during play');
  ok(await page.locator('#graph .curve--supply').count()===0 && await page.locator('#graph .curve--demand').count()===0, 'true curves remain hidden');
  ok((await page.locator('#log tbody').innerText()).includes('=2+3'), 'reason recorded as text');
  ok(await page.locator('#predict-price').inputValue()==='', 'prediction resets for next experiment');
  await page.locator('#restore-baseline').click();
  ok(JSON.stringify(await page.locator('input[type="range"]').evaluateAll(nodes=>nodes.map(n=>n.value)))===JSON.stringify(initial), 'restore reproduces A conditions');
  ok(await page.locator('#score').innerText()==='95' && await page.locator('#log tbody tr').count()===2, 'restoring spends no points or observations');
  await step('#var-1'); await page.locator('#observe').click();
  await page.locator('#compare-first').selectOption('0');
  await page.locator('#compare-second').selectOption('2');
  await page.locator('#compare-draw').click();
  ok(await page.locator('#attach').evaluate(el=>el===document.activeElement), 'comparison draw focuses grading attachment');
  ok(await page.locator('#thru-1').inputValue()==='0' && await page.locator('#thru-2').inputValue()==='2', 'draw uses selected pair');
  await page.locator('#check').click();
  ok((await page.locator('#found').innerText()).includes('Supply found'), 'A-C identifies supply');
  await page.locator('#compare-second').selectOption('1');
  await page.locator('#compare-draw').click();
  await page.locator('#check').click();
  ok(await page.locator('#score').innerText()==='90', 'workbench retains original score');
  ok((await page.locator('#prediction-review').innerText()).includes('2 of 2'), 'correct directional predictions reviewed without score changes');
  await page.locator('#compare-first').selectOption('0');
  await page.locator('#compare-second').selectOption('2');
  ok((await page.locator('#comparison-explanation').innerText()).includes('same supply curve'), 'nonconsecutive replay explains A-C');
  ok((await page.locator('#replay-heading').innerText()).includes('observation C'), 'pair comparison reveals the second observation');
  await page.locator('#reflection').fill('My evidence is A and C.');
  const downloading=page.waitForEvent('download');await page.locator('#export-csv').click();const download=await downloading;
  ok(download.suggestedFilename()==='invisible-world-wool-AUDIT235.csv', 'download names the reproducible world');
  const csv=fs.readFileSync(await download.path(),'utf8');
  ok(csv.includes("\"'=2+3\"") && csv.includes('My evidence is A and C.'), 'download preserves reflection and neutralizes formula');
  ok(csv.includes('"done","supply; demand",90,'), 'download includes completed score');
  for(const width of [320,390,768,1440]) {
   await page.setViewportSize({width,height:1000});
   ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no overflow after finish at '+width);
  }
  await page.locator('#play-again').click();
  ok(await page.locator('#reflection').inputValue()==='' && await page.locator('#baseline').inputValue()==='0','notebook resets in new world');
  ok(!await page.locator('#comparison-explanation').isVisible(), 'new world does not retain revealed explanations');
  ok(errors.length===0,'no uncaught errors: '+errors.join('; '));
  console.log(checks+' workbench browser checks passed');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
