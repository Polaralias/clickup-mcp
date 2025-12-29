import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js"
import { createServer } from "./server/factory.js"
import { parseSessionConfig } from "./server/sessionConfig.js"
import { createApplicationConfig } from "./application/config/applicationConfig.js"
import { SessionCache } from "./application/services/SessionCache.js"

// Define types for Cloudflare Workers
interface Env {
  MCP_SESSION: DurableObjectNamespace;
}

class WorkerSSETransport implements Transport {
  onmessage?: (message: JSONRPCMessage) => void;
  onclose?: () => void;
  onerror?: (error: Error) => void;
  private writer: WritableStreamDefaultWriter<any>;

  constructor(writer: WritableStreamDefaultWriter<any>) {
    this.writer = writer;
  }

  async start(): Promise<void> {
    // No-op for SSE
  }

  async send(message: JSONRPCMessage): Promise<void> {
    try {
        const event = `event: message\ndata: ${JSON.stringify(message)}\n\n`;
        await this.writer.write(new TextEncoder().encode(event));
    } catch (e) {
        console.error("Error writing to stream", e);
        this.onerror?.(e as Error);
    }
  }

  async close(): Promise<void> {
    try {
        await this.writer.close();
    } catch (e) {
        // Ignore
    }
    this.onclose?.();
  }

  handlePostMessage(message: JSONRPCMessage) {
      if (this.onmessage) {
        this.onmessage(message);
      }
  }
}

export class McpSession implements DurableObject {
  state: DurableObjectState;
  server?: McpServer;
  transport?: WorkerSSETransport;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/connect") {
      return this.handleConnect(request);
    }

    if (url.pathname === "/message") {
      return this.handleMessage(request);
    }

    return new Response("Not found", { status: 404 });
  }

  async handleConnect(request: Request): Promise<Response> {
    // Parse config from query params passed to the DO
    const url = new URL(request.url);
    const queryObj: Record<string, any> = {};
    for (const [key, value] of url.searchParams) {
        // Simplified query parsing
        queryObj[key] = value;
    }

    // We might have serialized complex config in a single param or reconstruction
    // For now, let's assume the query params forwarded are sufficient.
    const { config, error } = parseSessionConfig(queryObj);

    if (!config) {
        return new Response(JSON.stringify({ error: error || "Invalid config" }), { status: 400 });
    }

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    this.transport = new WorkerSSETransport(writer);

    const appConfig = createApplicationConfig(config, undefined);
    const sessionCache = new SessionCache(appConfig.hierarchyCacheTtlMs, appConfig.spaceConfigCacheTtlMs);

    this.server = createServer(appConfig, sessionCache);

    this.server.connect(this.transport).catch(e => {
        console.error("Server connect error", e);
    });

    // Handle client disconnect
    request.signal.addEventListener("abort", () => {
        this.transport?.close();
        this.server?.close();
    });

    return new Response(readable, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        }
    });
  }

  async handleMessage(request: Request): Promise<Response> {
      if (!this.server || !this.transport) {
          return new Response("Session not initialized", { status: 400 });
      }

      try {
          const body = await request.json() as JSONRPCMessage;
          this.transport.handlePostMessage(body);
          return new Response("Accepted", { status: 202 });
      } catch (e) {
          return new Response("Invalid JSON", { status: 400 });
      }
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Serve schema config
    if (url.pathname === "/" || url.pathname === "/.well-known/mcp-config") {
         const { sessionConfigJsonSchema } = await import("./server/sessionConfig.js");
         return new Response(JSON.stringify(sessionConfigJsonSchema, null, 2), {
             headers: { "Content-Type": "application/json" }
         });
    }

    if (url.pathname === "/mcp") {
      const sessionId = url.searchParams.get("sessionId") || crypto.randomUUID();
      const id = env.MCP_SESSION.idFromName(sessionId);
      const stub = env.MCP_SESSION.get(id);

      if (request.method === "GET") {
        // Forward the request to the DO's /connect endpoint
        // Pass the session config query params along
        const newUrl = new URL(request.url);
        newUrl.pathname = "/connect";
        // We ensure sessionId is in response header so client knows it
        const response = await stub.fetch(new Request(newUrl.toString(), request));

        // Wrap response to inject X-Session-ID header if successful
        if (response.status === 200) {
            const newHeaders = new Headers(response.headers);
            newHeaders.set("X-Session-ID", sessionId);
            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: newHeaders
            });
        }
        return response;
      }
      else if (request.method === "POST") {
        const querySessionId = url.searchParams.get("sessionId");
        if (!querySessionId) {
            return new Response("Missing sessionId parameter", { status: 400 });
        }
        // Use the ID from the param to route to the correct DO
        const targetId = env.MCP_SESSION.idFromName(querySessionId);
        const targetStub = env.MCP_SESSION.get(targetId);

        const newUrl = new URL(request.url);
        newUrl.pathname = "/message";
        return targetStub.fetch(new Request(newUrl.toString(), request));
      }
    }

    return new Response("Not Found", { status: 404 });
  }
};
