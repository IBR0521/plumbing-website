import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const [, , out = "seg", pageName = "index", widthArg = "1440"] = process.argv;
const width = Number(widthArg);
const height = width < 600 ? 844 : 900;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width, height }, isMobile: width < 600, hasTouch: width < 600 });
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:4173/${pageName}.html`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
for (let y = 0; y < 12000; y += 600) { await page.mouse.wheel(0, 600); await page.waitForTimeout(60); }
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(2500);
const total = await page.evaluate(() => document.documentElement.scrollHeight);
let i = 0;
for (let y = 0; y < total; y += height) {
  await page.screenshot({ path: `${out}/${pageName}-${width}-${String(i).padStart(2, "0")}.png`, fullPage: true, clip: { x: 0, y, width, height: Math.min(height, total - y) } });
  i++;
}
console.log(`${i} segments, height ${total}`);
await browser.close();
