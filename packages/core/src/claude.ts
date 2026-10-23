import Anthropic from "@anthropic-ai/sdk";

/**
 * Claude access in one place.
 *
 * With ANTHROPIC_API_KEY set ("live mode") the report narrative, recap email, ad copy and the Ask panel use Claude.
 * Without it ("test mode") every caller falls back to deterministic template responses so the whole system,
 * the tests and CI run with no network and no cost.
 */
export function isLive(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY) && process.env.CLAUDE_TEST_MODE !== "1";
}

export function modelId(): string {
  return process.env.CLAUDE_MODEL || "claude-opus-5-5";
}

export function modeLabel(): string {
  return isLive() ? modelId() : "test mode (template responses)";
}

let client: Anthropic | null = null;
export function anthropic(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

/**
 * Shared request settings. `fallbacks: "default"` lets the API re-run a request on another model if a safety
 * classifier declines it, instead of failing the weekly job.
 */
export function requestDefaults(): { betas: Anthropic.Beta.AnthropicBeta[]; fallbacks: "default" } {
  return { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" };
}

/** One structured-output call: Claude must return JSON matching `schema`. */
export async function generateJson<T>(opts: { system: string; prompt: string; schema: Record<string, unknown>; maxTokens?: number }): Promise<T> {
  const response = await anthropic().beta.messages.create({
    ...requestDefaults(),
    model: modelId(),
    max_tokens: opts.maxTokens ?? 8000,
    system: opts.system,
    output_config: { effort: "medium", format: { type: "json_schema", schema: opts.schema } },
    messages: [{ role: "user", content: opts.prompt }],
  });
  if (response.stop_reason === "refusal") throw new Error("Claude declined this request");
  if (response.stop_reason === "max_tokens") throw new Error("Claude response was cut off (max_tokens)");
  const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  return JSON.parse(text) as T;
}
