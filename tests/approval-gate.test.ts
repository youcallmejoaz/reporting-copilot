import { beforeEach, describe, expect, it } from "vitest";
import { createPausedDraft, decideDraft, getDraft, listAuditLog, listDrafts, MockAdsAdapter, planAdRefresh, setAdapter, type NewDraft } from "@arc/core";

let adapter: MockAdsAdapter;
beforeEach(() => {
  adapter = new MockAdsAdapter();
  setAdapter(adapter);
});

async function newDraft(extra: Record<string, unknown> = {}) {
  const plan = await planAdRefresh("glowfield-skincare", "cmp_gf_01");
  return createPausedDraft({ ...plan, ...extra } as NewDraft, "test");
}

describe("approval gate", () => {
  it("creates drafts PAUSED on the platform and in the database", async () => {
    const d = await newDraft();
    expect(d.status).toBe("PAUSED");
    expect(getDraft(d.id)?.status).toBe("PAUSED");
    expect(adapter.created.get(d.external_id!)?.status).toBe("PAUSED");
  });

  it("ignores any attempt to create a draft that is already live", async () => {
    const d = await newDraft({ status: "ACTIVE" });
    expect(getDraft(d.id)?.status).toBe("PAUSED");
    expect(adapter.created.get(d.external_id!)?.status).toBe("PAUSED");
  });

  it("only goes live after approval, and logs who approved it", async () => {
    const d = await newDraft();
    const approved = await decideDraft(d.id, "APPROVED", "dashboard:alex");
    expect(approved.status).toBe("APPROVED");
    expect(getDraft(d.id)).toMatchObject({ status: "APPROVED", decided_by: "dashboard:alex" });
    expect(adapter.created.get(d.external_id!)?.status).toBe("ACTIVE");
    expect(listAuditLog({ limit: 1 })[0]).toMatchObject({ action: "approve_draft", scope: "approve", actor: "dashboard:alex", result: "ok" });
  });

  it("rejecting keeps the ad paused", async () => {
    const d = await newDraft();
    await decideDraft(d.id, "REJECTED", "dashboard");
    expect(getDraft(d.id)?.status).toBe("REJECTED");
    expect(adapter.created.get(d.external_id!)?.status).toBe("PAUSED");
  });

  it("cannot decide the same draft twice", async () => {
    const d = await newDraft();
    await decideDraft(d.id, "REJECTED", "dashboard");
    await expect(decideDraft(d.id, "APPROVED", "dashboard")).rejects.toThrow(/already rejected/);
    expect(adapter.created.get(d.external_id!)?.status).toBe("PAUSED");
    expect(listAuditLog({ limit: 1 })[0]).toMatchObject({ action: "approve_draft", result: "denied" });
  });

  it("lists drafts waiting for review", async () => {
    const d = await newDraft();
    expect(listDrafts({ status: "PAUSED" }).map((x) => x.id)).toContain(d.id);
  });
});
