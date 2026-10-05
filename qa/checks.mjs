import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "http://127.0.0.1:4173/";
const PAGES = ["index", "services", "about", "service-area", "contact"];
const out = "checks";
mkdirSync(out, { recursive: true });
const log = (...a) => console.log(...a);
let failures = 0;
const fail = (msg) => { failures++; log("  FAIL", msg); };
const ok = (msg) => log("  ok  ", msg);

const browser = await chromium.launch();

/* 1. Links + anchors */
log("\n[links]");
{
  const page = await browser.newPage();
  const seen = new Set();
  for (const p of PAGES) {
    await page.goto(BASE + p + ".html");
    const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
    for (const h of hrefs) {
      if (seen.has(p + h)) continue;
      seen.add(p + h);
      if (h.startsWith("tel:")) { if (h !== "tel:+15550104417") fail(`${p}: bad tel ${h}`); continue; }
      if (h.startsWith("#")) {
        if (!(await page.$(h))) fail(`${p}: missing anchor ${h}`);
        continue;
      }
      if (/^https?:/.test(h)) continue;
      const [file, hash] = h.split("#");
      const res = await page.request.get(new URL(file, BASE + p + ".html").href);
      if (res.status() !== 200) { fail(`${p}: ${h} -> ${res.status()}`); continue; }
      if (hash) {
        const html = await res.text();
        if (!html.includes(`id="${hash}"`)) fail(`${p}: ${h} anchor not found`);
      }
    }
  }
  ok(`${seen.size} link references checked`);
  const buttons = await page.$$eval("button", (b) => b.length);
  await page.close();
}

/* 2. axe (WCAG 2 AA incl. contrast) at both widths */
log("\n[axe WCAG AA]");
for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  for (const p of PAGES) {
    await page.goto(BASE + p + ".html", { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);
    const r = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .exclude("iframe")
      .analyze();
    if (r.violations.length) {
      for (const v of r.violations) fail(`${p}@${vp.width}: ${v.id} (${v.nodes.length}) ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
    } else ok(`${p}@${vp.width}: 0 violations`);
  }
  await ctx.close();
}

/* 3. Mobile call reach */
log("\n[mobile call]");
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  for (const p of PAGES) {
    await page.goto(BASE + p + ".html");
    const box = await page.locator(".callbar a").boundingBox();
    const inThumbZone = box && box.y > 844 * 0.8 && box.y + box.height <= 844 && box.height >= 44;
    inThumbZone ? ok(`${p}: call bar at y=${Math.round(box.y)}, ${Math.round(box.height)}px tall`) : fail(`${p}: call bar not in thumb zone ${JSON.stringify(box)}`);
    await page.mouse.wheel(0, 3000);
    await page.waitForTimeout(100);
    const box2 = await page.locator(".callbar a").boundingBox();
    if (Math.round(box2.y) !== Math.round(box.y)) fail(`${p}: call bar moved on scroll`);
  }
  // Nav toggle
  await page.goto(BASE + "index.html");
  await page.click(".nav-toggle");
  const exp = await page.getAttribute(".nav-toggle", "aria-expanded");
  const vis = await page.isVisible("#site-nav a[href='services.html']");
  exp === "true" && vis ? ok("menu opens") : fail("menu does not open");
  await page.keyboard.press("Escape");
  (await page.getAttribute(".nav-toggle", "aria-expanded")) === "false" ? ok("Escape closes menu") : fail("Escape does not close menu");
  await page.click(".nav-toggle");
  await page.screenshot({ path: `${out}/menu-390.png` });
  await ctx.close();
}

/* 4. Keyboard + focus */
log("\n[keyboard]");
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + "index.html");
  const order = [];
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      const cs = getComputedStyle(el);
      return { text: (el.innerText || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 32), outline: cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2 };
    });
    order.push(info.text);
    if (!info.outline) fail(`no visible focus on "${info.text}"`);
    if (i === 0) await page.screenshot({ path: `${out}/focus-skip.png`, clip: { x: 0, y: 0, width: 700, height: 160 } });
    if (i === 7) await page.screenshot({ path: `${out}/focus-call.png`, clip: { x: 0, y: 0, width: 1440, height: 560 } });
  }
  ok("tab order: " + order.join(" → "));
  await page.goto(BASE + "index.html");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  const hash = await page.evaluate(() => location.hash);
  hash === "#main" ? ok("skip link jumps to #main") : fail("skip link failed");
  await page.close();
}

/* 5. Form states */
log("\n[form]");
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(BASE + "contact.html");

  // empty submit -> errors, focus first invalid
  await page.click(".btn-submit");
  const errs = await page.$$eval(".has-error .error-msg", (e) => e.map((x) => x.textContent));
  const focused = await page.evaluate(() => document.activeElement.id);
  errs.length >= 5 && focused === "service" ? ok(`validation: ${errs.length} errors, focus on #service`) : fail(`validation: ${errs.length} errors, focus ${focused}`);
  await page.screenshot({ path: `${out}/form-errors-390.png`, fullPage: true });

  // emergency alert
  await page.check('input[value="leaking-now"]');
  (await page.isVisible("#urgent-alert")) ? ok("emergency choice shows call alert") : fail("no emergency alert");
  await page.check('input[value="few-days"]');
  (await page.isVisible("#urgent-alert")) ? fail("alert did not hide") : ok("alert hides for non-urgent");

  // fill + photo
  await page.selectOption("#service", "drain");
  await page.fill("#address", "TODO Test St, Testville 00000");
  await page.setInputFiles("#photos", { name: "floor-drain.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(240 * 1024) });
  const listed = await page.textContent("#file-list");
  listed.includes("floor-drain.jpg") ? ok("photo listed: " + listed.trim()) : fail("photo not listed");
  await page.fill("#name", "Test Person");
  await page.fill("#phone", "555 010 0000");
  await page.check('input[value="email"]');
  await page.click(".btn-submit");
  (await page.evaluate(() => document.activeElement.id)) === "email" ? ok("email required when preferred") : fail("email pref not enforced");
  await page.fill("#email", "test@example.com");

  // loading -> success
  await page.click(".btn-submit");
  const busy = await page.getAttribute(".btn-submit", "aria-busy");
  const label = await page.textContent(".btn-submit .label");
  busy === "true" && label.includes("Sending") ? ok("loading state shown") : fail("no loading state");
  await page.screenshot({ path: `${out}/form-loading-390.png` });
  await page.waitForSelector(".status-success", { timeout: 4000 });
  ok("success: " + (await page.textContent(".status-success p")).trim());
  await page.screenshot({ path: `${out}/form-success-390.png` });
  await page.click("[data-reset]");
  (await page.isVisible("#quote-form")) ? ok("send another resets form") : fail("reset failed");

  // error state
  await page.goto(BASE + "contact.html?demo=error&service=repiping");
  (await page.inputValue("#service")) === "repiping" ? ok("?service= preselects") : fail("preselect failed");
  await page.check('input[value="planning"]');
  await page.fill("#address", "TODO Test St");
  await page.fill("#name", "Test Person");
  await page.fill("#phone", "5550100000");
  await page.check('input[value="call"]');
  await page.click(".btn-submit");
  await page.waitForSelector(".status-error", { timeout: 4000 });
  const kept = await page.inputValue("#name");
  kept === "Test Person" ? ok("error state shown, input kept") : fail("error lost input");
  await page.locator(".status-error").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/form-error-390.png` });
  await ctx.close();
}

/* 6. Reduced motion */
log("\n[reduced motion]");
{
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(BASE + "index.html");
  const d = await page.evaluate(() => getComputedStyle(document.querySelector(".svc-list .arrow")).transitionDuration);
  parseFloat(d) < 0.01 ? ok(`transitions disabled (${d})`) : fail(`transition still ${d}`);
  const anims = await page.evaluate(() => document.getAnimations().length);
  ok(`running animations on load: ${anims}`);
  await ctx.close();
}

await browser.close();
log(`\n${failures ? failures + " FAILURE(S)" : "ALL CHECKS PASSED"}`);
process.exit(failures ? 1 : 0);
