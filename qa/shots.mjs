import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://127.0.0.1:4173/";
const pages = ["index", "services", "about", "service-area", "contact"];
const widths = [
  { name: "1440", width: 1440, height: 900 },
  { name: "390", width: 390, height: 844, mobile: true },
];
const out = process.argv[2] || "shots";
const only = process.argv[3];
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
for (const w of widths) {
  const ctx = await browser.newContext({
    viewport: { width: w.width, height: w.height },
    deviceScaleFactor: 1,
    isMobile: !!w.mobile,
    hasTouch: !!w.mobile,
  });
  const page = await ctx.newPage();
  for (const p of pages) {
    if (only && only !== p) continue;
    await page.goto(BASE + p + ".html", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${out}/${p}-${w.name}-fold.png` });
    await page.screenshot({ path: `${out}/${p}-${w.name}-full.png`, fullPage: true });
  }
  await ctx.close();
}
await browser.close();
console.log("done");
