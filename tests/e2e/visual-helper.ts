import fs from "node:fs";
import path from "node:path";
import type { Page, TestInfo } from "@playwright/test";

export interface VisualCaptureEntry {
  relativePath: string;
  description: string;
  viewport: string;
  flow: string;
  capturedAt: string;
}

const BASE_DIR = path.resolve(process.cwd(), "tests/e2e/visual-results");
const MANIFEST_FILE = path.join(BASE_DIR, "manifest.json");

function readManifest(): VisualCaptureEntry[] {
  if (!fs.existsSync(MANIFEST_FILE)) return [];
  try {
    const raw = fs.readFileSync(MANIFEST_FILE, "utf8");
    return JSON.parse(raw) as VisualCaptureEntry[];
  } catch {
    return [];
  }
}

function writeManifest(entries: VisualCaptureEntry[]): void {
  if (!fs.existsSync(BASE_DIR)) {
    fs.mkdirSync(BASE_DIR, { recursive: true });
  }
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(entries, null, 2), "utf8");
}

/**
 * Ensures the destination directory exists and captures a high-resolution screenshot.
 * Also attaches it to the current Playwright testInfo so it appears in the HTML report.
 */
export async function takeVisualScreenshot(
  page: Page,
  testInfo: TestInfo,
  relativePath: string,
  description: string,
  flow: string,
  options?: { fullPage?: boolean },
): Promise<string> {
  const targetPath = path.resolve(BASE_DIR, relativePath);
  const targetDir = path.dirname(targetPath);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Allow animations and fonts to stabilize
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await page.waitForTimeout(250);

  await page.screenshot({
    path: targetPath,
    fullPage: options?.fullPage ?? false,
  });

  const viewport = page.viewportSize();
  const viewportStr = viewport ? `${viewport.width}x${viewport.height}` : "default";

  await testInfo.attach(description, {
    path: targetPath,
    contentType: "image/png",
  });

  const allEntries = readManifest();
  const filtered = allEntries.filter((e) => e.relativePath !== relativePath);
  filtered.push({
    relativePath,
    description,
    viewport: viewportStr,
    flow,
    capturedAt: new Date().toISOString(),
  });
  writeManifest(filtered);

  return targetPath;
}

/**
 * Generates an indexable Markdown visual gallery catalog in tests/e2e/visual-results/VISUAL_GALLERY.md
 */
export function generateVisualGalleryMarkdown(): void {
  const entries = readManifest();
  if (entries.length === 0) return;

  const flows = Array.from(new Set(entries.map((e) => e.flow)));

  let md = `# TETRA E2E Visual Test Results Gallery\n\n`;
  md += `This gallery documents the end-to-end visual captures executed across all TETRA views, workflows, and viewports.\n\n`;
  md += `**Total visual captures:** ${entries.length} screenshots  \n`;
  md += `**Generated on:** ${new Date().toUTCString()}\n\n`;
  md += `## Table of Contents\n\n`;

  for (const flow of flows) {
    const anchor = flow.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    md += `- [${flow}](#${anchor})\n`;
  }
  md += `\n---\n\n`;

  for (const flow of flows) {
    md += `## ${flow}\n\n`;
    const flowEntries = entries.filter((e) => e.flow === flow);

    md += `| Screenshot | Description | Viewport | File Path |\n`;
    md += `| :--- | :--- | :---: | :--- |\n`;

    for (const entry of flowEntries) {
      const fileName = path.basename(entry.relativePath);
      md += `| **${fileName}** | ${entry.description} | \`${entry.viewport}\` | [${entry.relativePath}](./${entry.relativePath}) |\n`;
    }
    md += `\n`;

    for (const entry of flowEntries) {
      md += `### ${entry.description}\n\n`;
      md += `> Viewport: \`${entry.viewport}\` · Relative path: \`${entry.relativePath}\`\n\n`;
      md += `![${entry.description}](./${entry.relativePath})\n\n`;
    }
  }

  const galleryPath = path.join(BASE_DIR, "VISUAL_GALLERY.md");
  fs.writeFileSync(galleryPath, md, "utf8");
}
