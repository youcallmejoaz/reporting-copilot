import { NextResponse } from "next/server";
import { callJson, connectInProcess } from "@arc/mcp-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Runs the audit through the MCP server (read scope) so it is logged like any other tool call. */
export async function POST(req: Request) {
  const { client_id } = (await req.json()) as { client_id: string };
  const { client, close } = await connectInProcess({ scopes: ["read"], actor: "dashboard" });
  try {
    return NextResponse.json(await callJson(client, "audit_account", { client_id }));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  } finally {
    await close();
  }
}
