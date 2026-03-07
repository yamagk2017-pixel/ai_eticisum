import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_URL = "https://www.musicite.net/imakite";
const DEFAULT_OUT_DIR = path.resolve(process.cwd(), "tmp", "imakite-captures");

const CLIPS = [
  {
    name: "imakite-top1.png",
    clip: { x: 183, y: 418, width: 714, height: 522 },
  },
  {
    name: "imakite-top12.png",
    clip: { x: 182, y: 417, width: 1076, height: 1332 },
  },
];

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    console.error("playwright が見つかりません。先に `npm install -D playwright` を実行してください。");
    process.exit(1);
  }
}

async function run() {
  const url = process.env.IMAKITE_CAPTURE_URL ?? DEFAULT_URL;
  const outDir = process.env.IMAKITE_CAPTURE_OUT_DIR ?? DEFAULT_OUT_DIR;
  const waitMs = Number(process.env.IMAKITE_CAPTURE_WAIT_MS ?? "1200");

  await fs.mkdir(outDir, { recursive: true });

  const playwright = await loadPlaywright();
  const browser = await playwright.chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 3200 },
      deviceScaleFactor: 2,
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForFunction(() => document.querySelectorAll("main article").length >= 12, {
      timeout: 60000,
    });
    await page.waitForTimeout(waitMs);

    const written = [];
    for (const item of CLIPS) {
      const outPath = path.join(outDir, item.name);
      await page.screenshot({ path: outPath, clip: item.clip });
      written.push(outPath);
    }

    console.log(JSON.stringify({ ok: true, url, outDir, files: written }, null, 2));
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
