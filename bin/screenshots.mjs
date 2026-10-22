#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import puppeteer from "puppeteer";

const port = process.env.PORT ?? "3000";
const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle0" });
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/radio-desktop.png", fullPage: true });
} finally {
  await browser.close();
}
