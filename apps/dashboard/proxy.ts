import { NextResponse, type NextRequest } from "next/server";

/**
 * Optional basic auth for the whole dashboard (set DASHBOARD_USER + DASHBOARD_PASSWORD; always set them when deployed).
 * The scheduler can call POST /api/runs with `Authorization: Bearer $CRON_SECRET` instead.
 */
export function proxy(req: NextRequest) {
  const user = process.env.DASHBOARD_USER;
  const pass = process.env.DASHBOARD_PASSWORD;
  if (!user || !pass) return NextResponse.next();

  const auth = req.headers.get("authorization") ?? "";
  const cron = process.env.CRON_SECRET;
  if (cron && req.method === "POST" && req.nextUrl.pathname === "/api/runs" && auth === `Bearer ${cron}`) return NextResponse.next();

  if (auth.startsWith("Basic ")) {
    const [u, ...rest] = atob(auth.slice(6)).split(":");
    if (u === user && rest.join(":") === pass) {
      const headers = new Headers(req.headers);
      headers.set("x-dashboard-user", u);
      return NextResponse.next({ request: { headers } });
    }
  }
  return new NextResponse("Authentication required", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Reporting Copilot"' } });
}

export const config = { matcher: "/((?!_next/static|_next/image|favicon.ico).*)" };
