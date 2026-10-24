import { NextResponse } from "next/server";
import { listAuditLog } from "@arc/core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const after = Number(new URL(req.url).searchParams.get("after") || 0);
  return NextResponse.json(listAuditLog({ afterId: after || undefined, limit: 200 }));
}
