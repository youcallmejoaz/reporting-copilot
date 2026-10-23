import { describe, expect, it } from "vitest";
import { fmtMoney, getMtdSummary, listDrafts } from "@arc/core";
import { ask, matchClient } from "@arc/agent";

describe("Ask (test mode)", () => {
  it("matches clients by their profile aliases", () => {
    expect(matchClient("How did the roofing client do this month?")).toBe("ridgeline-roofing");
    expect(matchClient("anything wrong with the law firm?")).toBe("harbor-law");
    expect(matchClient("white label account status")).toBe("northstar-partners");
    expect(matchClient("what's the weather")).toBeNull();
  });

  it("answers the roofing question from the MCP tool's numbers", async () => {
    const r = await ask("How did the roofing client do this month?");
    expect(r.tool_calls.map((c) => c.name)).toEqual(["get_mtd_summary"]);
    expect(r.tool_calls[0].args).toEqual({ client_id: "ridgeline-roofing" });
    const m = await getMtdSummary("ridgeline-roofing");
    expect(r.answer).toContain(fmtMoney(m.totals.spend));
    expect(r.answer).toContain(String(m.totals.conversions));
    expect(r.answer).toContain(m.totals.roas!.toFixed(2));
  });

  it("runs the audit when asked what is wrong", async () => {
    const r = await ask("Audit the skincare account, anything wrong?");
    expect(r.tool_calls[0].name).toBe("audit_account");
    expect(r.answer).toContain("GF_META_PROS_BroadVideo");
  });

  it("drafts refreshes as PAUSED", async () => {
    const r = await ask("Draft a creative refresh for the white label account");
    expect(r.answer).toContain("PAUSED");
    expect(listDrafts({ clientId: "northstar-partners" })[0].status).toBe("PAUSED");
  });
});
