import { describe, expect, it } from "vitest";
import { auditAccount } from "@arc/core";
import { CLIENT_IDS, planted } from "./helpers";

describe("account audit", () => {
  it.each(CLIENT_IDS)("finds exactly the planted problems for %s", async (clientId) => {
    const { findings } = await auditAccount(clientId);
    const got = findings.map((f) => `${f.rule}:${f.entity_id}`).sort();
    const expected = planted()
      .filter((p) => p.client_id === clientId)
      .map((p) => `${p.rule}:${p.entity_id}`)
      .sort();
    expect(got).toEqual(expected);
  });

  it("flags the ROAS < 1 campaign red with a reason", async () => {
    const { findings } = await auditAccount("glowfield-skincare");
    const f = findings.find((x) => x.rule === "roas_below_1")!;
    expect(f.severity).toBe("red");
    expect(f.entity_name).toBe("GF_META_PROS_BroadVideo");
    expect(Number(f.metric?.roas)).toBeLessThan(1);
    expect(f.reason).toMatch(/ROAS 0\.\d\d/);
  });

  it("flags both broken campaign names for the roofing client", async () => {
    const { findings } = await auditAccount("ridgeline-roofing");
    expect(findings.filter((f) => f.rule === "broken_naming").map((f) => f.entity_name).sort()).toEqual(["Copy of RR_META_LEADS_Homeowners", "roof ads new FINAL"]);
  });

  it("reports the overspend ratio and the low CTR value", async () => {
    const hl = await auditAccount("harbor-law");
    expect(Number(hl.findings.find((f) => f.rule === "overspend")?.metric?.ratio_pct)).toBeGreaterThan(120);
    const np = await auditAccount("northstar-partners");
    expect(Number(np.findings.find((f) => f.rule === "low_ctr")?.metric?.ctr)).toBeLessThan(0.5);
  });
});
