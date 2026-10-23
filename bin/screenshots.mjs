#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import puppeteer from "puppeteer";

const port = process.env.PORT ?? "3000";
const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });

try {
  await mkdir("artifacts", { recursive: true });
  await mkdir("public/screenshots", { recursive: true });
  await mkdir("public/icons", { recursive: true });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: "domcontentloaded" });
  await new Promise((resolve) => setTimeout(resolve, 500));
  await page.screenshot({ path: "artifacts/radio-desktop.png" });
  await page.screenshot({ path: "public/screenshots/radio-wide.png" });

  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.screenshot({ path: "public/screenshots/radio-mobile.png" });

  const icon = await browser.newPage();
  await icon.setContent(
    '<img src="file://' +
      process.cwd() +
      '/public/icons/radio.svg" style="width:100%;height:100%">',
  );
  for (const size of [180, 192, 512]) {
    await icon.setViewport({ width: size, height: size });
    await icon.screenshot({ path: `public/icons/radio-${size}.png`, omitBackground: true });
  }
  await icon.evaluate(() => {
    const image = document.querySelector("img");
    image.style.padding = "20%";
  });
  await icon.setViewport({ width: 512, height: 512 });
  await icon.screenshot({ path: "public/icons/radio-maskable-512.png", omitBackground: true });
  await icon.close();
} finally {
  await browser.close();
}
