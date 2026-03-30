import WebSocket from "ws";
import { randomUUID } from "crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const AGP_WS_URL = "wss://mmgrcalltoken.3g.qq.com/agentwss";

export interface WeChatMessage {
  sessionId: string;
  promptId: string;
  content: string;
  userId: string;
  timestamp: number;
}

export interface AGPClientConfig {
  channelToken: string;
  guid: string;
  userId: string;
  onMessage: (msg: WeChatMessage) => void;
  onError?: (error: Error) => void;
  onConnected?: () => void;
  onDisconnected?: (reason?: string) => void;
}

interface AGPMessage {
  msg_id: string;
  guid: string;
  user_id: string;
  method: string;
  payload: unknown;
}

export class WeChatAGPClient {
  private ws: WebSocket | null = null;
  private config: AGPClientConfig;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private processedMessages = new Set<string>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: AGPClientConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(AGP_WS_URL, {
        headers: {
          Authorization: `Bearer ${this.config.channelToken}`,
        },
      });

      this.ws.on("open", () => {
        console.log("[wechat] WebSocket connected");
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.startCleanup();
        this.config.onConnected?.();
        resolve();
      });

      this.ws.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString()) as AGPMessage;
          this.handleMessage(msg);
        } catch (err) {
          console.error("[wechat] Failed to parse message:", err);
        }
      });

      this.ws.on("close", (code, reason) => {
        console.log(`[wechat] WebSocket closed: ${code} ${reason}`);
        this.stopHeartbeat();
        this.config.onDisconnected?.(reason.toString());
        this.attemptReconnect();
      });

      this.ws.on("error", (err) => {
        console.error("[wechat] WebSocket error:", err);
        this.config.onError?.(err);
        reject(err);
      });
    });
  }

  private handleMessage(msg: AGPMessage): void {
    if (this.processedMessages.has(msg.msg_id)) {
      return;
    }
    this.processedMessages.add(msg.msg_id);

    switch (msg.method) {
      case "session.prompt": {
        const payload = msg.payload as {
          session_id: string;
          prompt_id: string;
          content: Array<{ text?: string }>;
        };
        const text = payload.content
          .filter((c) => c.text)
          .map((c) => c.text!)
          .join("");

        const wechatMsg: WeChatMessage = {
          sessionId: payload.session_id,
          promptId: payload.prompt_id,
          content: text,
          userId: msg.user_id || "",
          timestamp: Date.now(),
        };

        console.log(`[wechat] Received: ${text.slice(0, 50)}...`);
        this.config.onMessage(wechatMsg);
        break;
      }

      case "session.cancel": {
        const payload = msg.payload as { session_id: string; prompt_id: string };
        console.log("[wechat] Session cancelled:", payload.session_id);
        break;
      }

      default:
        console.log("[wechat] Unknown method:", msg.method);
    }
  }

  sendTextResponse(sessionId: string, promptId: string, text: string): void {
    this.send("session.promptResponse", {
      session_id: sessionId,
      prompt_id: promptId,
      content: {
        type: "text",
        text,
      },
      stop_reason: "end_turn",
    });
  }

  sendMessageChunk(sessionId: string, promptId: string, chunk: string): void {
    this.send("session.update", {
      session_id: sessionId,
      prompt_id: promptId,
      content: {
        type: "text",
        text: chunk,
      },
    });
  }

  private send(method: string, payload: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error("[wechat] Cannot send: not connected");
      return;
    }

    const msg: AGPMessage = {
      msg_id: randomUUID(),
      guid: this.config.guid,
      user_id: this.config.userId,
      method,
      payload,
    };

    this.ws.send(JSON.stringify(msg));
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 20000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      if (this.processedMessages.size > 1000) {
        const arr = Array.from(this.processedMessages);
        this.processedMessages = new Set(arr.slice(-500));
      }
    }, 300000);
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[wechat] Max reconnect attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);

    console.log(`[wechat] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.start().catch((err) => {
        console.error("[wechat] Reconnect failed:", err);
      });
    }, delay);
  }

  stop(): void {
    this.stopHeartbeat();
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  getState(): string {
    if (!this.ws) return "disconnected";
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return "connecting";
      case WebSocket.OPEN:
        return "connected";
      case WebSocket.CLOSING:
        return "closing";
      case WebSocket.CLOSED:
        return "disconnected";
      default:
        return "unknown";
    }
  }
}

export function createMCPServer(
  wechatClient: WeChatAGPClient,
  sendMessageFn: (senderId: string, text: string) => Promise<void>
) {
  const mcp = new McpServer(
    { name: "opencode-wechat-channel", version: "0.1.0" },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  mcp.registerTool(
    "wechat_reply",
    {
      title: "WeChat Reply",
      description: "Send a plain-text reply to the WeChat user",
      inputSchema: z.object({
        sender_id: z.string().describe("User ID (xxx@im.wechat) or group ID"),
        text: z.string().describe("Plain text message to send"),
      }),
    },
    async ({ sender_id, text }) => {
      await sendMessageFn(sender_id, text);
      return { content: [{ type: "text", text: "sent" }] };
    }
  );

  return mcp.server;
}
