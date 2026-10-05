import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const out = process.argv[2] || "frames";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();

for (const vp of [{ name: "1440", width: 1440, height: 900 }, { name: "390", width: 390, height: 844, isMobile: true }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile });
  const page = await ctx.newPage();
  // Load fonts/images once so the timed run measures the animation, not the network.
  await page.goto("http://127.0.0.1:4173/index.html", { waitUntil: "networkidle" });
  await page.goto("http://127.0.0.1:4173/index.html", { waitUntil: "commit" });
  const t0 = Date.now();
  for (const ms of [150, 450, 900, 1600, 3200]) {
    await page.waitForTimeout(Math.max(0, ms - (Date.now() - t0)));
    await page.screenshot({ path: `${out}/load-${vp.name}-${String(ms).padStart(4, "0")}ms.png` });
  }
  await ctx.close();
}

const rm = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
const p = await rm.newPage();
await p.goto("http://127.0.0.1:4173/index.html", { waitUntil: "load" });
await p.waitForTimeout(100);
await p.screenshot({ path: `${out}/reduced-motion-100ms.png` });
await browser.close();
console.log("done");
