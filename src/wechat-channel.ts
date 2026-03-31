/**
 * WeChat Channel - 将微信消息桥接到 OpenCode ACP 会话
 * 
 * 基于 formulahendry/wechat-acp 架构：
 * - 启动 opencode acp 子进程
 * - 通过 ClientSideConnection 连接到子进程
 * - 微信消息通过 ACP prompt 发送
 */

import * as os from "os";
import * as path from "path";
import * as fs from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import { Writable, Readable } from "node:stream";
import * as acp from "@agentclientprotocol/sdk";
import { WeixinBotClient, type InboundMessage } from "weixin-bot-plugin";
import qrcodeTerminal from "qrcode-terminal";

const DEFAULT_ACP_PORT = "4097";
const OPENCODE_ACP_PORT = process.env.OPENCODE_ACP_PORT || DEFAULT_ACP_PORT;
const WECHAT_BASE_URL = "https://ilinkai.weixin.qq.com";
const BOT_TYPE = "3";
const STATE_DIR = path.join(os.homedir(), ".opencode", "channels", "wechat");

interface TokenData {
  token: string;
  baseUrl: string;
  accountId: string;
  userId: string;
  savedAt: string;
}

function log(msg: string): void {
  process.stderr.write(`[wechat-channel] ${msg}\n`);
}

function getTokenPath(): string {
  return path.join(STATE_DIR, "token.json");
}

function loadToken(): TokenData | null {
  const tokenPath = getTokenPath();
  if (!fs.existsSync(tokenPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(tokenPath, "utf-8")) as TokenData;
  } catch {
    return null;
  }
}

function saveToken(data: TokenData): void {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const tokenPath = getTokenPath();
  fs.writeFileSync(tokenPath, JSON.stringify(data, null, 2), "utf-8");
}

function saveWechatAccount(accountId: string, token: string, baseUrl: string, userId?: string): void {
  const accountsDir = path.join(STATE_DIR, "accounts");
  fs.mkdirSync(accountsDir, { recursive: true });
  
  const accountData = {
    token,
    baseUrl,
    savedAt: new Date().toISOString(),
    userId,
  };
  fs.writeFileSync(path.join(accountsDir, `${accountId}.json`), JSON.stringify(accountData, null, 2), "utf-8");
  
  const accountsListPath = path.join(STATE_DIR, "accounts.json");
  let accountsList: string[] = [];
  if (fs.existsSync(accountsListPath)) {
    try {
      accountsList = JSON.parse(fs.readFileSync(accountsListPath, "utf-8"));
    } catch {}
  }
  if (!accountsList.includes(accountId)) {
    accountsList.push(accountId);
    fs.writeFileSync(accountsListPath, JSON.stringify(accountsList, null, 2), "utf-8");
  }
}

async function getBotQrcode(): Promise<{ qrcode: string; qrcode_img_content: string }> {
  const res = await fetch(`${WECHAT_BASE_URL}/ilink/bot/get_bot_qrcode?bot_type=${BOT_TYPE}`, {
    headers: { "Content-Type": "application/json" },
  });
  return res.json() as Promise<{ qrcode: string; qrcode_img_content: string }>;
}

async function getQrcodeStatus(qrcode: string): Promise<{
  status: string;
  bot_token?: string;
  baseurl?: string;
  ilink_bot_id?: string;
  ilink_user_id?: string;
}> {
  const res = await fetch(
    `${WECHAT_BASE_URL}/ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcode)}`,
    { headers: { "Content-Type": "application/json" } }
  );
  return res.json() as Promise<{
    status: string;
    bot_token?: string;
    baseurl?: string;
    ilink_bot_id?: string;
    ilink_user_id?: string;
  }>;
}

const CHANNEL_VERSION = "1.0.2";

function buildHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "AuthorizationType": "ilink_bot_token",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

interface WechatMessage {
  msg_id?: string;
  from_user_id?: string;
  to_user_id?: string;
  message_type?: string;
  group_id?: string;
  context_token?: string;
  item_list?: Array<{
    type: number;
    text_item?: { text: string };
    voice_item?: { text: string };
    file_item?: { file_name: string };
  }>;
}

interface GetUpdatesResp {
  ret: number;
  msgs: WechatMessage[];
}

async function getUpdates(baseUrl: string, token: string, getUpdatesBuf: string, timeoutMs = 38000): Promise<WechatMessage[]> {
  const res = await fetch(`${baseUrl}/ilink/bot/getupdates`, {
    method: "POST",
    headers: buildHeaders(token),
    body: JSON.stringify({
      get_updates_buf: getUpdatesBuf,
      base_info: { channel_version: CHANNEL_VERSION },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = (await res.json()) as GetUpdatesResp;
  return data.msgs || [];
}

async function sendTextMessage(baseUrl: string, token: string, toUserId: string, text: string, contextToken?: string): Promise<void> {
  await fetch(`${baseUrl}/ilink/bot/sendmessage`, {
    method: "POST",
    headers: buildHeaders(token),
    body: JSON.stringify({
      to_user_id: toUserId,
      msg_type: 1,
      text_card: { text },
      ...(contextToken ? { context_token: contextToken } : {}),
      base_info: { channel_version: CHANNEL_VERSION },
    }),
  });
}

/**
 * ACP 客户端实现 - 处理会话更新
 */
class WeChatAcpClient implements acp.Client {
  private chunks: string[] = [];
  private thoughtChunks: string[] = [];
  private sendTyping: () => Promise<void>;
  private onReply: (text: string) => Promise<void>;
  private showThoughts: boolean;
  private log: (msg: string) => void;
  private lastTypingAt = 0;
  private static readonly TYPING_INTERVAL_MS = 5000;

  constructor(opts: {
    sendTyping: () => Promise<void>;
    onReply: (text: string) => Promise<void>;
    showThoughts: boolean;
    log: (msg: string) => void;
  }) {
    this.sendTyping = opts.sendTyping;
    this.onReply = opts.onReply;
    this.showThoughts = opts.showThoughts;
    this.log = opts.log;
  }

  updateCallbacks(callbacks: { sendTyping: () => Promise<void>; onReply: (text: string) => Promise<void> }): void {
    this.sendTyping = callbacks.sendTyping;
    this.onReply = callbacks.onReply;
  }

  async requestPermission(params: acp.RequestPermissionRequest): Promise<acp.RequestPermissionResponse> {
    const allowOpt = params.options.find(o => o.kind === "allow_once" || o.kind === "allow_always");
    const optionId = allowOpt?.optionId ?? params.options[0]?.optionId ?? "allow";
    this.log(`[permission] auto-allowed: ${params.toolCall?.title ?? "unknown"} → ${optionId}`);
    return { outcome: { outcome: "selected", optionId } };
  }

  async sessionUpdate(params: acp.SessionNotification): Promise<void> {
    const update = params.update;

    switch (update.sessionUpdate) {
      case "agent_message_chunk":
        await this.maybeFlushThoughts();
        if (update.content.type === "text") {
          this.chunks.push(update.content.text);
        }
        await this.maybeSendTyping();
        break;

      case "tool_call":
        await this.maybeFlushThoughts();
        this.log(`[tool] ${update.title} (${update.status})`);
        await this.maybeSendTyping();
        break;

      case "agent_thought_chunk":
        if (update.content.type === "text") {
          const text = update.content.text;
          this.log(`[thought] ${text.length > 80 ? text.substring(0, 80) + "..." : text}`);
          if (this.showThoughts) {
            this.thoughtChunks.push(text);
          }
        }
        await this.maybeSendTyping();
        break;

      case "tool_call_update":
        if (update.status === "completed" && update.content) {
          for (const c of update.content) {
            if (c.type === "diff") {
              const diff = c as acp.Diff;
              const header = `--- ${diff.path}`;
              const lines: string[] = [header];
              if (diff.oldText != null) {
                for (const l of diff.oldText.split("\n")) lines.push(`- ${l}`);
              }
              if (diff.newText != null) {
                for (const l of diff.newText.split("\n")) lines.push(`+ ${l}`);
              }
              this.chunks.push("\n```diff\n" + lines.join("\n") + "\n```\n");
            }
          }
        }
        if (update.status) {
          this.log(`[tool] ${update.toolCallId} → ${update.status}`);
        }
        break;

      case "plan":
        if (update.entries) {
          const items = update.entries
            .map((e: acp.PlanEntry, i: number) => `  ${i + 1}. [${e.status}] ${e.content}`)
            .join("\n");
          this.log(`[plan]\n${items}`);
        }
        break;
    }
  }

  async readTextFile(params: acp.ReadTextFileRequest): Promise<acp.ReadTextFileResponse> {
    try {
      const content = await fs.promises.readFile(params.path, "utf-8");
      return { content };
    } catch (err) {
      throw new Error(`Failed to read file ${params.path}: ${String(err)}`);
    }
  }

  async writeTextFile(params: acp.WriteTextFileRequest): Promise<acp.WriteTextFileResponse> {
    try {
      await fs.promises.writeFile(params.path, params.content, "utf-8");
      return {};
    } catch (err) {
      throw new Error(`Failed to write file ${params.path}: ${String(err)}`);
    }
  }

  async flush(): Promise<string> {
    await this.maybeFlushThoughts();
    const text = this.chunks.join("");
    this.chunks = [];
    this.lastTypingAt = 0;
    return text;
  }

  private async maybeFlushThoughts(): Promise<void> {
    if (this.thoughtChunks.length === 0) return;
    const thoughtText = this.thoughtChunks.join("");
    this.thoughtChunks = [];
    if (thoughtText.trim()) {
      try {
        await this.onReply(`💭 [Thinking]\n${thoughtText}`);
      } catch {
        // best effort
      }
    }
  }

  private async maybeSendTyping(): Promise<void> {
    const now = Date.now();
    if (now - this.lastTypingAt < WeChatAcpClient.TYPING_INTERVAL_MS) return;
    this.lastTypingAt = now;
    try {
      await this.sendTyping();
    } catch {
      // typing is best-effort
    }
  }
}

interface AgentProcessInfo {
  process: ChildProcess;
  connection: acp.ClientSideConnection;
  sessionId: string;
}

async function spawnAgent(params: {
  cwd: string;
  port: string;
  client: WeChatAcpClient;
  log: (msg: string) => void;
}): Promise<AgentProcessInfo> {
  const { cwd, port, client, log } = params;

  // 使用 opencode acp 命令启动
  const command = "opencode";
  const args = ["acp", "--port", port];

  log(`Spawning agent: ${command} ${args.join(" ")} (cwd: ${cwd})`);

  const proc = spawn(command, args, {
    stdio: ["pipe", "pipe", "inherit"],
    cwd,
    env: { ...process.env, OPENCODE_ACP_PORT: port },
  });

  proc.on("error", (err) => {
    log(`Agent process error: ${String(err)}`);
  });

  proc.on("exit", (code, signal) => {
    log(`Agent process exited: code=${code} signal=${signal}`);
  });

  if (!proc.stdin || !proc.stdout) {
    proc.kill();
    throw new Error("Failed to get agent process stdio");
  }

  const input = Writable.toWeb(proc.stdin);
  const output = Readable.toWeb(proc.stdout) as ReadableStream<Uint8Array>;
  const stream = acp.ndJsonStream(input, output);

  const connection = new acp.ClientSideConnection(() => client, stream);

  // Initialize
  log("Initializing ACP connection...");
  const initResult = await connection.initialize({
    protocolVersion: acp.PROTOCOL_VERSION,
    clientInfo: {
      name: "opencode-wechat-channel",
      title: "OpenCode WeChat Channel",
      version: "0.1.0",
    },
    clientCapabilities: {
      fs: {
        readTextFile: true,
        writeTextFile: true,
      },
    },
  });
  log(`ACP initialized (protocol v${initResult.protocolVersion})`);

  // Create session
  log("Creating ACP session...");
  await new Promise(resolve => setTimeout(resolve, 3000));
  try {
    const sessionResult = await connection.newSession({
      cwd,
      mcpServers: [],
    });
    log(`ACP session created: ${sessionResult.sessionId}`);
    
    return {
      process: proc,
      connection,
      sessionId: sessionResult.sessionId,
    };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : JSON.stringify(e);
    log(`Failed to create ACP session: ${errMsg}`);
    killAgent(proc);
    throw e;
  }
}

function killAgent(proc: ChildProcess): void {
  if (!proc.killed) {
    proc.kill("SIGTERM");
    setTimeout(() => {
      if (!proc.killed) proc.kill("SIGKILL");
    }, 5000).unref();
  }
}

export class WeChatChannel {
  private wechatClient: WeixinBotClient | null = null;
  private agentProcess: AgentProcessInfo | null = null;
  private acpClient: WeChatAcpClient | null = null;
  private tokenData: TokenData | null = null;
  private isRunning = false;
  private cachedSessions: Array<{ sessionId: string; cwd: string; title: string }> = [];

  async initialize(): Promise<void> {
    const tempDir = path.join(os.tmpdir(), "weixin-opencode");

    if (!fs.existsSync(STATE_DIR)) {
      fs.mkdirSync(STATE_DIR, { recursive: true });
    }

    this.wechatClient = new WeixinBotClient({
      stateDir: STATE_DIR,
      tempDir,
      clientIdPrefix: "opencode-weixin",
    });

    this.wechatClient.on("loginSuccess", (accountId: string) => {
      log(`✅ 微信登录成功: ${accountId}`);
    });

    this.wechatClient.on("qrRefresh", (info: { qrcodeUrl: string; qrAscii?: string }) => {
      log("🔄 QR码已刷新，请重新扫描:");
      if (info.qrAscii) {
        console.log(info.qrAscii);
      } else if (info.qrcodeUrl) {
        qrcodeTerminal.generate(info.qrcodeUrl, { small: true }, (qr: string) => {
          console.log(qr);
        });
      }
    });

    this.wechatClient.on("message", async (msg: InboundMessage) => {
      log(`收到微信消息: ${msg.text?.slice(0, 30)}`);
      await this.handleMessage(msg);
    });

    this.wechatClient.on("error", (err: Error) => {
      log(`❌ 微信客户端错误: ${err.message}`);
    });

    const savedToken = loadToken();
    if (savedToken) {
      log(`找到已保存账号: ${savedToken.accountId}`);
      const started = await this.wechatClient.start(savedToken.accountId);
      if (started) {
        log("✅ 使用已保存账号登录成功");
        this.tokenData = savedToken;
      } else {
        log("账号已过期，需要重新登录");
        await this.doLoginAndWait();
      }
    } else {
      log("未找到已保存账号，开始登录...");
      await this.doLoginAndWait();
    }
  }

  private async doLoginAndWait(): Promise<void> {
    log("开始获取登录二维码...");
    
    const deadline = Date.now() + 5 * 60 * 1000;
    const qrResp = await getBotQrcode();
    let currentQrcode = qrResp.qrcode;
    let qrcodeUrl = qrResp.qrcode_img_content;
    let refreshCount = 0;

    const displayQr = (url: string) => {
      console.log("\n=== 请使用微信扫描二维码登录 ===\n");
      qrcodeTerminal.generate(url, { small: true }, (qr: string) => {
        console.log(qr);
      });
      console.log(`\n或者点击链接: ${url}\n`);
    };

    displayQr(qrcodeUrl);

    while (Date.now() < deadline) {
      const statusResp = await getQrcodeStatus(currentQrcode);

      switch (statusResp.status) {
        case "wait":
          break;
        case "scaned":
          log("已扫描，请在微信上确认...");
          break;
        case "expired": {
          refreshCount++;
          if (refreshCount > 3) {
            throw new Error("二维码多次过期，请重试");
          }
          log(`二维码过期，正在刷新 (${refreshCount}/3)...`);
          const newQr = await getBotQrcode();
          currentQrcode = newQr.qrcode;
          qrcodeUrl = newQr.qrcode_img_content;
          displayQr(qrcodeUrl);
          break;
        }
        case "confirmed": {
          log("登录成功!");
          const tokenData: TokenData = {
            token: statusResp.bot_token!,
            baseUrl: statusResp.baseurl || WECHAT_BASE_URL,
            accountId: statusResp.ilink_bot_id!,
            userId: statusResp.ilink_user_id!,
            savedAt: new Date().toISOString(),
          };
          saveToken(tokenData);
          
          // Save account config for weixin-bot-plugin
          const accountDir = path.join(STATE_DIR, "accounts", tokenData.accountId);
          fs.mkdirSync(accountDir, { recursive: true });
          fs.writeFileSync(
            path.join(accountDir, "config.json"),
            JSON.stringify({
              token: tokenData.token,
              baseUrl: tokenData.baseUrl,
              savedAt: tokenData.savedAt,
              userId: tokenData.userId,
            }, null, 2),
            "utf-8"
          );
          
          this.tokenData = tokenData;
          log(`Bot ID: ${tokenData.accountId}`);
          log(`凭证已保存到 ${getTokenPath()}`);
          log("✅ 登录完成");
          return;
        }
      }

      await new Promise((r) => setTimeout(r, 1500));
    }

    throw new Error("登录超时 (5分钟)");
  }

  async start(): Promise<void> {
    if (!this.wechatClient) {
      throw new Error("微信客户端未初始化");
    }

    await this.startOpenCodeAgent();
    log("✅ WeChat Channel 启动完成");
  }

  private async handleWechatMessage(fromUserId: string, contextToken: string, text: string): Promise<void> {
    if (!this.agentProcess || !this.acpClient || !this.tokenData) return;
    
    log(`处理消息: ${text}`);
    
    try {
      await this.acpClient.flush();
      
      const result = await this.agentProcess.connection.prompt({
        sessionId: this.agentProcess.sessionId,
        prompt: [{ type: "text" as const, text: `[微信消息] ${text}` }],
      });
      
      let replyText = await this.acpClient.flush();
      
      if (result.stopReason === "cancelled") {
        replyText += "\n[cancelled]";
      } else if (result.stopReason === "refusal") {
        replyText += "\n[agent refused]";
      }
      
      if (replyText.trim()) {
        await sendTextMessage(this.tokenData.baseUrl, this.tokenData.token, fromUserId, replyText, contextToken);
        log(`已回复: ${replyText.slice(0, 30)}...`);
      }
    } catch (e) {
      log(`处理消息失败: ${e}`);
      await sendTextMessage(this.tokenData.baseUrl, this.tokenData.token, fromUserId, `处理失败: ${e}`, contextToken);
    }
  }

  private async handleMessage(msg: InboundMessage): Promise<void> {
    let retries = 0;
    while ((!this.agentProcess || !this.acpClient) && retries < 30) {
      await new Promise(r => setTimeout(r, 500));
      retries++;
    }
    if (!this.agentProcess || !this.acpClient) {
      if (this.wechatClient && content.trim().startsWith("/")) {
        await this.wechatClient.sendText(msg.chatId, "OpenCode 未连接，请确保 ACP 正常运行");
      }
      return;
    }

    const content = msg.text || "[无文本内容]";
    log(`处理消息: ${content}`);

    const trimmed = content.trim();
    
    if (trimmed === "/list") {
      try {
          const sessions = await this.agentProcess!.connection.listSessions({});
          const sessionList = sessions.sessions || [];
          log(`/list 返回 ${sessionList.length} 个会话，完整ID: ${JSON.stringify(sessionList.slice(0, 3).map(s => s.sessionId))}`);
        
        if (sessionList.length > 0) {
          this.cachedSessions = sessionList.slice(0, 5).map(s => ({
            sessionId: String(s.sessionId),
            cwd: s.cwd || "",
            title: s.title || "-"
          }));
          let table = "序号 | 项目 | 会话名\n--|---|--\n";
          table += this.cachedSessions.map((s, i) => {
            const project = s.cwd ? s.cwd.split("/").pop() || s.cwd : "-";
            return `${i + 1} | ${project} | ${s.title}`;
          }).join("\n");
          table += "\n\n/send 0 = 新会话\n/send 1 = 第一个会话";
          await this.wechatClient!.sendText(msg.chatId, `最近会话:\n${table}`);
        } else {
          await this.wechatClient!.sendText(msg.chatId, "暂无活跃会话");
        }
      } catch (e) {
        await this.wechatClient!.sendText(msg.chatId, `获取会话列表失败: ${e}`);
      }
      return;
    }

    if (trimmed.startsWith("/send ")) {
      const match = trimmed.match(/^\/send\s+(\d+)\s+(.+)$/);
      if (match) {
        const idx = parseInt(match[1]);
        const text = match[2];
        
        if (idx === 0) {
          log(`/send 0 创建新会话`);
          try {
            await this.acpClient!.flush();
            
            const newSession = await this.agentProcess.connection.newSession({
              cwd: process.env.HOME || "/tmp",
              mcpServers: [],
            });
            log(`新会话创建: ${newSession.sessionId}`);
            
            const result = await this.agentProcess.connection.prompt({
              sessionId: newSession.sessionId,
              prompt: [{ type: "text", text: `[微信消息] ${text}` }],
            });
            
            let replyText = await this.acpClient!.flush();
            
            if (result.stopReason === "cancelled") {
              replyText += "\n[cancelled]";
            } else if (result.stopReason === "refusal") {
              replyText += "\n[agent refused to continue]";
            }

            if (replyText.trim()) {
              await this.wechatClient!.sendText(msg.chatId, replyText);
              log(`回复: ${replyText.slice(0, 30)}...`);
            } else {
              await this.wechatClient!.sendText(msg.chatId, `已发送到新会话`);
            }

            try {
              const sessions = await this.agentProcess.connection.listSessions({});
              log(`/send 0 后更新会话列表: ${sessions.sessions?.length || 0} 个`);
            } catch (e) {
              log(`更新会话列表失败: ${e}`);
            }
          } catch (e) {
            const errMsg = e instanceof Error ? e.message : JSON.stringify(e);
            log(`newSession/prompt 失败: ${errMsg}`);
            await this.wechatClient!.sendText(msg.chatId, `发送失败: ${errMsg}`);
          }
          return;
        }
        
        if (this.cachedSessions.length === 0) {
          const sessions = await this.agentProcess.connection.listSessions({});
          const fullList = sessions.sessions || [];
          this.cachedSessions = fullList.slice(0, 5).map(s => ({
            sessionId: String(s.sessionId),
            cwd: s.cwd || "",
            title: s.title || "-"
          }));
        }
        
        const sessionIdx = idx - 1;
        if (sessionIdx < 0 || sessionIdx >= this.cachedSessions.length) {
          await this.wechatClient!.sendText(msg.chatId, `序号无效，共 ${this.cachedSessions.length} 个会话 (0=新会话)`);
          return;
        }
        
        const targetSession = this.cachedSessions[sessionIdx];
        const sessionId = targetSession.sessionId;
        log(`/send ${idx} 使用缓存会话: ${sessionId.slice(0, 20)}...`);
        
        try {
          await this.acpClient!.flush();
          
          try {
            await this.agentProcess.connection.loadSession({ sessionId, cwd: targetSession.cwd || process.env.HOME || "/tmp", mcpServers: [] });
            log(`loadSession 成功: ${sessionId.slice(0, 20)}...`);
          } catch (e) {
            const loadErr = e instanceof Error ? e.message : JSON.stringify(e);
            log(`loadSession 失败: ${loadErr}`);
          }
          
          const result = await this.agentProcess.connection.prompt({
            sessionId: sessionId,
            prompt: [{ type: "text", text: `[微信消息] ${text}` }],
          });
          
          let replyText = await this.acpClient!.flush();
          
          if (result.stopReason === "cancelled") {
            replyText += "\n[cancelled]";
          } else if (result.stopReason === "refusal") {
            replyText += "\n[agent refused to continue]";
          }

          if (replyText.trim()) {
            const title = targetSession.title || sessionId.slice(0, 12);
            await this.wechatClient!.sendText(msg.chatId, `[${title}]\n${replyText}`);
            log(`回复: ${replyText.slice(0, 30)}...`);
          } else {
            const title = targetSession.title || sessionId.slice(0, 12);
            await this.wechatClient!.sendText(msg.chatId, `已发送到: ${title}`);
          }
          
          try {
            const sessions = await this.agentProcess.connection.listSessions({});
            log(`发送后更新会话列表: ${sessions.sessions?.length || 0} 个`);
          } catch (e) {
            log(`更新会话列表失败: ${e}`);
          }
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : JSON.stringify(e);
          log(`prompt 失败: ${errMsg}`);
          await this.wechatClient!.sendText(msg.chatId, `会话已失效，请使用 /send 0 创建新会话`);
        }
        return;
      } else {
        await this.wechatClient!.sendText(msg.chatId, "用法: /send 序号 消息\n例: /send 0 你好");
        return;
      }
    }

    let targetSessionId: string | undefined;
    let targetTitle: string = "默认";
    try {
      const sessions = await this.agentProcess.connection.listSessions({});
      log(`收到消息，更新会话列表: ${sessions.sessions?.length || 0} 个`);
      
      if (sessions.sessions && sessions.sessions.length > 0) {
        const current = sessions.sessions.find(s => String(s.sessionId) === this.agentProcess.sessionId);
        if (current) {
          targetSessionId = this.agentProcess.sessionId;
          targetTitle = current.title || targetSessionId.slice(0, 12);
          log(`使用当前会话: ${targetSessionId.slice(0, 20)}... 标题: ${targetTitle}`);
        }
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : JSON.stringify(e);
      log(`获取会话列表失败: ${errMsg}`);
    }

    if (!targetSessionId) {
      targetSessionId = this.agentProcess.sessionId;
      targetTitle = targetSessionId.slice(0, 12);
      log(`无可用会话，使用当前会话: ${targetSessionId.slice(0, 20)}...`);
    }

    log(`发送 typing: ${msg.chatId}`);
    try {
      this.wechatClient.startTyping(msg.chatId);
    } catch (e) {
      log(`typing错误: ${e}`);
    }

    try {
      await this.acpClient.flush();

      const result = await this.agentProcess.connection.prompt({
        sessionId: targetSessionId,
        prompt: [{ type: "text", text: `[微信消息] ${content}` }],
      });

      let replyText = await this.acpClient.flush();

      if (result.stopReason === "cancelled") {
        replyText += "\n[cancelled]";
      } else if (result.stopReason === "refusal") {
        replyText += "\n[agent refused to continue]";
      }

      if (replyText.trim()) {
        await this.wechatClient.sendText(msg.chatId, `[${targetTitle}]\n${replyText}`);
        log(`已回复: ${replyText.slice(0, 30)}...`);
      }

      try {
        const sessions = await this.agentProcess.connection.listSessions({});
        log(`更新会话列表: ${sessions.sessions?.length || 0} 个会话`);
      } catch (e) {
        log(`更新会话列表失败: ${e}`);
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : JSON.stringify(e);
      log(`处理消息失败: ${errMsg}`);
      await this.wechatClient.sendText(msg.chatId, `处理失败: ${errMsg}`);
    } finally {
      this.wechatClient.stopTyping(msg.chatId);
    }
  }

  private async startOpenCodeAgent(): Promise<void> {
    if (!this.tokenData) throw new Error("Not logged in");

    this.acpClient = new WeChatAcpClient({
      sendTyping: async () => {},
      onReply: async () => {},
      showThoughts: true,
      log,
    });

    try {
      log(`Using ACP port: ${OPENCODE_ACP_PORT}`);
      this.agentProcess = await spawnAgent({
        cwd: os.homedir(),
        port: OPENCODE_ACP_PORT,
        client: this.acpClient,
        log,
      });
      log("OpenCode ACP 代理已启动");
    } catch (e) {
      log(`启动 OpenCode ACP 失败: ${e}`);
      throw e;
    }
  }

  stop(): void {
    if (this.wechatClient) {
      this.wechatClient.stop();
      this.wechatClient = null;
    }
    if (this.agentProcess) {
      killAgent(this.agentProcess.process);
      this.agentProcess = null;
    }
    this.acpClient = null;
    this.tokenData = null;
  }
}

export async function main(): Promise<void> {
  log("Starting WeChat Channel...");
  const channel = new WeChatChannel();

  const shutdown = (signal: string) => {
    log(`收到 ${signal} 信号，开始关闭...`);
    channel.stop();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  try {
    log("Initializing WeChat client...");
    await channel.initialize();
    log("Starting channel...");
    await channel.start();
    log("Channel started, waiting for messages...");
    // Keep the process running
    await new Promise(() => {}); // Never resolves
  } catch (err) {
    log(`启动失败: ${err}`);
    process.exit(1);
  }
}
