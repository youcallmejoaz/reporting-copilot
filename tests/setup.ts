import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Every test file gets its own throwaway database and reports folder, and always runs in test mode.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "arc-test-"));
process.env.DB_PATH = path.join(dir, "test.db");
process.env.REPORTS_DIR = path.join(dir, "reports");
process.env.AS_OF_DATE = "2026-10-22";
process.env.CLAUDE_TEST_MODE = "1";
process.env.ADS_ADAPTER = "mock";
delete process.env.MCP_SCOPES;
