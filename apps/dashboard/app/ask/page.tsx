import { isLive, modeLabel } from "@arc/core";
import { AskChat } from "@/components/AskChat";

export const dynamic = "force-dynamic";

export default function AskPage() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Ask</h1>
          <p className="lede">Ask about any client. Answers come from the Ads Data MCP tools. Every tool call is shown and logged.</p>
        </div>
        <span className={`pill ${isLive() ? "good" : "warn"}`}>
          <span className="dot" />
          {isLive() ? `Claude · ${modeLabel()}` : "Test mode: rule-based answers, real MCP tool calls"}
        </span>
      </div>
      <AskChat />
    </>
  );
}
