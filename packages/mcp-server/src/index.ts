#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer, scopesFromEnv } from "./server";

// stdout is the MCP channel: keep Node's SQLite experimental warning (and any other noise) on stderr only.
const scopes = scopesFromEnv();
const server = createServer({ scopes, actor: "mcp" });
await server.connect(new StdioServerTransport());
console.error(`ads-data MCP server ready (scopes: ${scopes.join(", ")})`);
