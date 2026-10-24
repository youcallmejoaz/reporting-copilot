import { NextResponse } from "next/server";
import { decideDraft } from "@arc/core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** The human approval gate. Only reachable from the (password-protected) dashboard, never from MCP. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { decision } = (await req.json()) as { decision?: string };
  if (decision !== "APPROVED" && decision !== "REJECTED") return NextResponse.json({ error: "decision must be APPROVED or REJECTED" }, { status: 400 });
  const user = req.headers.get("x-dashboard-user") || "reviewer";
  try {
    const draft = await decideDraft((await params).id, decision, `dashboard:${user}`);
    return NextResponse.json(draft);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 409 });
  }
}
