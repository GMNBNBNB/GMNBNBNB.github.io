#!/usr/bin/env node
/*
  Renders resume.html to Meng_Gao_Resume.pdf.

  resume.html is the only copy of the resume that anyone edits; the PDF is a
  build output. This script prints it with headless Chromium using the page's
  own print stylesheet (Letter, 0.5in margins) and fails if the web fonts did
  not load or the result is not exactly one page, so a resume that quietly
  spills onto a second page never gets published.

  Usage:
    npm install
    npm run build:pdf
  Set RESUME_PDF_CHANNEL=msedge (or chrome) to reuse an installed browser
  instead of running `npx playwright install chromium` first.
*/
import { chromium } from 'playwright';
import { readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'resume.html');
const output = join(root, process.env.RESUME_PDF_OUT || 'Meng_Gao_Resume.pdf');
const channel = process.env.RESUME_PDF_CHANNEL || undefined;

const browser = await chromium.launch({ channel });
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(source).href, { waitUntil: 'load' });
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => document.fonts.ready);

  const faces = await page.evaluate(() =>
    [...document.fonts]
      .filter((f) => f.family.replace(/["']/g, '') === 'Resume Serif')
      .map((f) => `${f.style} ${f.weight}: ${f.status}`));
  if (!faces.length || faces.some((f) => !f.endsWith('loaded'))) {
    throw new Error(`Resume Serif did not load: ${faces.join(', ') || 'no faces found'}`);
  }

  await page.pdf({ path: output, preferCSSPageSize: true, printBackground: true, tagged: true });
} finally {
  await browser.close();
}

const pdf = await readFile(output, 'latin1');
const counts = [...pdf.matchAll(/\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)|\/Count\s+(\d+)[^>]*?\/Type\s*\/Pages\b/g)]
  .map((m) => Number(m[1] ?? m[2]));
const pages = counts.length ? Math.max(...counts) : (pdf.match(/\/Type\s*\/Page(?![s\w])/g) || []).length;
const { size } = await stat(output);

if (pages !== 1) {
  console.error(`resume.html printed to ${pages} pages; trim it back to one before publishing.`);
  process.exit(1);
}
console.log(`Wrote ${output} (1 page, ${(size / 1024).toFixed(1)} KB)`);
