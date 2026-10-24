import type { Metadata } from "next";
import { asOfDate, isLive, listDrafts, modeLabel, prettyRange } from "@arc/core";
import { Nav } from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = { title: "Agency Reporting Copilot", description: "Weekly ad reports, audits and paused-by-default ad changes" };
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pending = listDrafts({ status: "PAUSED" }).length;
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <aside className="side">
            <div className="brand">
              <div className="brand-mark">AR</div>
              <div>
                <b>Reporting Copilot</b>
                <span>Paid media agency</span>
              </div>
            </div>
            <Nav pendingDrafts={pending} />
            <div className="side-foot">
              <span className={`pill ${isLive() ? "good" : "warn"}`}>
                <span className="dot" />
                {isLive() ? modeLabel() : "Test mode"}
              </span>
              <span>Data as of {prettyRange({ start: asOfDate(), end: asOfDate() }).split(" – ")[1]}</span>
              <span>Sample data · fictional clients</span>
            </div>
          </aside>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
