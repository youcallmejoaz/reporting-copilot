import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer, type ServerOptions } from "./server";

/**
 * Connect an MCP client to a fresh in-process server. The weekly runner and the dashboard's Ask panel use this,
 * so they go through exactly the same tools (and the same audit log) as Claude Desktop / Claude Code.
 */
export async function connectInProcess(opts: ServerOptions = {}): Promise<{ client: Client; close: () => Promise<void> }> {
  const server = createServer(opts);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: `arc-${opts.actor ?? "in-process"}`, version: "0.1.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

/** Call a tool and parse the JSON payload that follows the one-line summary. */
export async function callJson<T>(client: Client, name: string, args: Record<string, unknown>): Promise<T> {
  const res = await client.callTool({ name, arguments: args });
  const text = (res.content as { type: string; text?: string }[]).find((c) => c.type === "text")?.text ?? "";
  if (res.isError) throw new Error(text);
  const start = text.indexOf("\n\n");
  return JSON.parse(start === -1 ? text : text.slice(start + 2)) as T;
}
