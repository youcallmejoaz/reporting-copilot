"use client";
import { marked } from "marked";
import { useRef, useState } from "react";

interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  summary: string;
  is_error: boolean;
}
interface Turn {
  question: string;
  answer?: string;
  tool_calls?: ToolCall[];
  error?: string;
}

const SUGGESTIONS = ["How did the roofing client do this month?", "Anything wrong with the law firm account?", "Which skincare campaigns are underperforming?", "Draft a creative refresh for the white label account"];

export function AskChat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function send(q: string) {
    if (!q.trim() || busy) return;
    setInput("");
    setBusy(true);
    setTurns((t) => [...t, { question: q }]);
    try {
      const res = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: q }) });
      const data = (await res.json()) as { answer?: string; tool_calls?: ToolCall[]; error?: string };
      setTurns((t) => [...t.slice(0, -1), { question: q, ...data }]);
    } catch (err) {
      setTurns((t) => [...t.slice(0, -1), { question: q, error: String(err) }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div>
      {turns.length === 0 ? (
        <div className="chips" style={{ marginBottom: 12 }}>
          {SUGGESTIONS.map((s) => (
            <button key={s} className="chip" onClick={() => send(s)}>
              {s}
            </button>
          ))}
        </div>
      ) : null}
      <div className="chat">
        {turns.map((t, i) => (
          <div key={i} className="chat">
            <div className="bubble-q">{t.question}</div>
            {t.answer === undefined && !t.error ? <div className="thinking">Calling the ads-data MCP server…</div> : null}
            {t.tool_calls?.length ? (
              <div data-testid="tool-calls">
                {t.tool_calls.map((c, j) => (
                  <div key={j} className="toolcall">
                    <div className="row spread">
                      <span>
                        <span className="muted">tool call · ads-data ›</span> <span className="tname">{c.name}</span>
                      </span>
                      <span className={`pill ${c.is_error ? "bad" : "good"}`}>{c.is_error ? "error" : "ok"}</span>
                    </div>
                    <div className="mono ink2" style={{ marginTop: 4 }}>
                      {JSON.stringify(c.args)}
                    </div>
                    <div className="small muted" style={{ marginTop: 2 }}>
                      → {c.summary}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            {t.answer ? <div className="answer" data-testid="answer" dangerouslySetInnerHTML={{ __html: marked.parse(t.answer, { async: false }) as string }} /> : null}
            {t.error ? <div className="answer" style={{ color: "var(--bad-text)" }}>{t.error}</div> : null}
          </div>
        ))}
      </div>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about a client, e.g. How did the roofing client do this month?" data-testid="ask-input" />
        <button className="btn primary" disabled={busy || !input.trim()} data-testid="ask-send">
          Ask
        </button>
      </form>
    </div>
  );
}
