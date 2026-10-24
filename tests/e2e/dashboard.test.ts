import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";
import { createPausedDraft, getDraft, listAuditLog, planAdRefresh } from "@arc/core";

const PORT = 3123;
const BASE = `http://localhost:${PORT}`;
const dashboard = path.join(process.cwd(), "apps", "dashboard");
let server: ChildProcess;
let browser: Browser;

async function waitForServer() {
  try {
    await fetch(BASE);
    throw new Error(`port ${PORT} is already in use; stop the old server first`);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("port")) throw err;
  }
  await new Promise((r) => setTimeout(r, 300));
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("dashboard did not start");
}

beforeAll(async () => {
  if (!fs.existsSync(path.join(dashboard, ".next", "BUILD_ID"))) {
    const b = spawnSync("npm", ["run", "build", "-w", "@arc/dashboard"], { stdio: "inherit" });
    if (b.status !== 0) throw new Error("dashboard build failed");
  }
  // Same DB_PATH / REPORTS_DIR as this test process (set in tests/setup.ts).
  // Detached = own process group, so afterAll can stop `next` as well as the `npx` wrapper.
  server = spawn("npx", ["next", "start", "-p", String(PORT)], { cwd: dashboard, env: { ...process.env }, stdio: "ignore", detached: true });
  await waitForServer();
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
  if (server?.pid) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      server.kill();
    }
  }
});

describe("dashboard", () => {
  it("approve flow: a PAUSED draft goes live only after a click, and the audit log shows it", async () => {
    const draft = await createPausedDraft(await planAdRefresh("northstar-partners", "cmp_np_01"), "e2e");
    const page = await browser.newPage();
    await page.goto(`${BASE}/drafts`);
    const card = page.getByTestId(`draft-${draft.id}`);
    await expect(card.getByTestId("draft-status").textContent()).resolves.toContain("Paused");
    expect(getDraft(draft.id)?.status).toBe("PAUSED");

    await card.getByTestId("approve").click();
    await page.getByText("Approved · live").waitFor();
    expect(getDraft(draft.id)?.status).toBe("APPROVED");
    await page.getByTestId("audit-log").getByText("approve_draft").first().waitFor();
    expect(listAuditLog({ limit: 1 })[0]).toMatchObject({ action: "approve_draft", result: "ok" });
  });

  it("weekly run from the dashboard produces a PDF per client", async () => {
    const page = await browser.newPage();
    await page.goto(BASE);
    await page.getByTestId("run-weekly").click();
    await page.getByText("4/4 clients done").waitFor({ timeout: 120_000 });
    const href = await page.getByTestId("run-item-ridgeline-roofing").getByRole("link", { name: /PDF/ }).getAttribute("href");
    const res = await fetch(`${BASE}${href}`);
    expect(res.headers.get("content-type")).toBe("application/pdf");
  });

  it("Ask answers the roofing question with the tool call shown", async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/ask`);
    await page.getByTestId("ask-input").fill("How did the roofing client do this month?");
    await page.getByTestId("ask-send").click();
    await page.getByTestId("answer").waitFor();
    expect(await page.getByTestId("tool-calls").textContent()).toContain("get_mtd_summary");
    expect(await page.getByTestId("answer").textContent()).toContain("Ridgeline Roofing Co.");
  });

  it("serves no files outside the reports folder", async () => {
    expect((await fetch(`${BASE}/files/..%2F..%2Fpackage.json`)).status).toBe(404);
  });
});
