import { NextResponse } from "next/server";
import { ask } from "@arc/agent";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const { question } = (await req.json()) as { question?: string };
  if (!question?.trim()) return NextResponse.json({ error: "question is required" }, { status: 400 });
  try {
    return NextResponse.json(await ask(question.slice(0, 2000)));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
