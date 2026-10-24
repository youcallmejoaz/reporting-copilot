import { NextResponse } from "next/server";
import { listDrafts } from "@arc/core";
import { callJson, connectInProcess } from "@arc/mcp-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(listDrafts());
}

/** Create a PAUSED draft through the MCP draft tool. */
export async function POST(req: Request) {
  const { client_id, campaign_id } = (await req.json()) as { client_id: string; campaign_id: string };
  const { client, close } = await connectInProcess({ scopes: ["draft"], actor: "dashboard" });
  try {
    return NextResponse.json(await callJson(client, "draft_ad_refresh", { client_id, campaign_id }), { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  } finally {
    await close();
  }
}
