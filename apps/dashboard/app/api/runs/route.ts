import { NextResponse } from "next/server";
import { listRuns } from "@arc/core";
import { startWeeklyRun } from "@arc/agent";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(listRuns(20));
}

/** Start the weekly job. Called by the dashboard button, or by the scheduler with `Authorization: Bearer $CRON_SECRET`. */
export async function POST(req: Request) {
  const scheduled = Boolean(process.env.CRON_SECRET) && req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
  const { run_id, done } = startWeeklyRun({ trigger: scheduled ? "schedule" : "manual" });
  done.catch((err) => console.error("weekly run failed", err));
  return NextResponse.json({ run_id }, { status: 202 });
}
