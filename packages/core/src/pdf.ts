export interface PdfRenderer {
  render(html: string, outPath: string): Promise<void>;
  close(): Promise<void>;
}

/** Launch one headless Chromium for a batch of PDFs (one per run, so concurrent runs never share a browser). */
export async function openPdfRenderer(): Promise<PdfRenderer> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {});
  return {
    async render(html, outPath) {
      const page = await browser.newPage();
      try {
        await page.setContent(html, { waitUntil: "load" });
        await page.pdf({ path: outPath, format: "Letter", printBackground: true, preferCSSPageSize: true });
      } finally {
        await page.close();
      }
    },
    close: () => browser.close(),
  };
}

/** Page count from the PDF's page tree (good enough for our own Chromium-made PDFs). */
export function countPdfPages(buf: Buffer): number {
  const m = buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g);
  return m ? m.length : 0;
}
