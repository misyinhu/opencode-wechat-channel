import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import qrcode from "qrcode-terminal";

const DEFAULT_BASE_URL = "https://ilinkai.weixin.qq.com";
const BOT_TYPE = "3";

/**
 * WeChat ilink credentials format
 */
export interface WechatCredentials {
  token: string;        // bot_token from ilink API
  baseUrl: string;      // ilink API base URL
  accountId: string;     // ilink_bot_id
  userId: string;       // ilink_user_id
  savedAt: string;
}

interface QRCodeResponse {
  qrcode: string;
  qrcode_img_content: string;
}

interface QRStatusResponse {
  status: "wait" | "scaned" | "confirmed" | "expired";
  bot_token?: string;
  ilink_bot_id?: string;
  baseurl?: string;
  ilink_user_id?: string;
}

function getCredentialsPath(): string {
  const homeDir = os.homedir();
  const configDir = path.join(homeDir, ".opencode", "channels", "wechat");
  return path.join(configDir, "account.json");
}

function ensureConfigDir(): string {
  const homeDir = os.homedir();
  const configDir = path.join(homeDir, ".opencode", "channels", "wechat");
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  return configDir;
}

export async function saveCredentials(credentials: WechatCredentials): Promise<void> {
  const configDir = ensureConfigDir();
  const filePath = path.join(configDir, "account.json");
  await fs.promises.writeFile(filePath, JSON.stringify(credentials, null, 2), "utf-8");
}

export async function loadCredentials(): Promise<WechatCredentials | null> {
  const filePath = getCredentialsPath();
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const content = await fs.promises.readFile(filePath, "utf-8");
    return JSON.parse(content) as WechatCredentials;
  } catch {
    return null;
  }
}

export async function clearCredentials(): Promise<void> {
  const filePath = getCredentialsPath();
  if (fs.existsSync(filePath)) {
    await fs.promises.unlink(filePath);
  }
}

/**
 * Fetch QR code for WeChat login
 * API: GET /ilink/bot/get_bot_qrcode?bot_type=3
 */
export async function fetchQRCode(baseUrl: string = DEFAULT_BASE_URL): Promise<QRCodeResponse> {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const url = `${base}ilink/bot/get_bot_qrcode?bot_type=${BOT_TYPE}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`QR fetch failed: ${response.status}`);
  }
  
  return (await response.json()) as QRCodeResponse;
}

/**
 * Poll QR code scan status
 * API: GET /ilink/bot/get_qrcode_status?qrcode=xxx
 */
export async function pollQRCodeStatus(
  baseUrl: string,
  qrcodeValue: string,
  timeout: number = 35000
): Promise<QRStatusResponse> {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const url = `${base}ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcodeValue)}`;
  
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      headers: { "iLink-App-ClientVersion": "1" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    
    if (!response.ok) {
      throw new Error(`QR status failed: ${response.status}`);
    }
    
    return (await response.json()) as QRStatusResponse;
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      return { status: "wait" };
    }
    throw err;
  }
}

/**
 * Check if already logged in
 */
export async function isLoggedIn(): Promise<boolean> {
  const credentials = await loadCredentials();
  return credentials !== null;
}

/**
 * Get existing credentials (for debugging/info)
 */
export async function getExistingCredentials(): Promise<WechatCredentials | null> {
  return loadCredentials();
}

/**
 * Start OAuth login flow with QR code
 */
export async function startOAuthLogin(baseUrl: string = DEFAULT_BASE_URL): Promise<WechatCredentials> {
  // Check existing credentials
  const existingPath = getCredentialsPath();
  if (fs.existsSync(existingPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(existingPath, "utf-8"));
      console.log(`已有保存的账号: ${existing.accountId}`);
      console.log(`保存时间: ${existing.savedAt}`);
      console.log();
      
      const readline = await import("node:readline");
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      
      const answer = await new Promise<string>((resolve) => {
        rl.question("是否重新登录？(y/N) ", resolve);
      });
      rl.close();
      
      if (answer.toLowerCase() !== "y") {
        console.log("保持现有凭据，退出。");
        process.exit(0);
      }
    } catch {
      // Continue with login if read fails
    }
  }

  console.log("正在获取微信登录二维码...\n");
  const qrResp = await fetchQRCode(baseUrl);

  // Display QR code URL (always show this first as fallback)
  console.log(`扫码链接（可复制到浏览器或用"从相册选取"扫描）:\n${qrResp.qrcode_img_content}\n`);

  // Try to render QR code in terminal
  try {
    qrcode.generate(qrResp.qrcode_img_content, { small: true }, (qr: string) => {
      console.log(qr);
    });
  } catch {
    // If terminal rendering fails, URL above is sufficient
  }

  console.log("请用微信扫描上方二维码（或复制链接到浏览器打开）...\n");

  const deadline = Date.now() + 480_000; // 8 minutes timeout
  let scannedPrinted = false;

  while (Date.now() < deadline) {
    const status = await pollQRCodeStatus(baseUrl, qrResp.qrcode);

    switch (status.status) {
      case "wait":
        process.stdout.write(".");
        break;
        
      case "scaned":
        if (!scannedPrinted) {
          console.log("\n已扫码，请在微信中确认...");
          scannedPrinted = true;
        }
        break;
        
      case "expired":
        console.log("\n二维码已过期，请重新运行。");
        process.exit(1);
        break;
        
      case "confirmed": {
        if (!status.ilink_bot_id || !status.bot_token) {
          console.error("\n登录失败：服务器未返回完整信息。");
          process.exit(1);
        }

        const credentials: WechatCredentials = {
          token: status.bot_token,
          baseUrl: status.baseurl || baseUrl,
          accountId: status.ilink_bot_id,
          userId: status.ilink_user_id || "",
          savedAt: new Date().toISOString(),
        };

        await saveCredentials(credentials);

        console.log(`\n✅ 微信连接成功！`);
        console.log(`   账号 ID: ${credentials.accountId}`);
        console.log(`   用户 ID: ${credentials.userId}`);
        console.log(`   凭据保存至: ${getCredentialsPath()}`);
        console.log();
        
        return credentials;
      }
    }
    
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log("\n登录超时，请重新运行。");
  process.exit(1);
}

/**
 * Refresh credentials (placeholder for future token refresh logic)
 */
export async function refreshCredentials(
  credentials: WechatCredentials
): Promise<WechatCredentials | null> {
  // TODO: Implement token refresh if ilink API supports it
  // For now, return existing credentials
  console.log("Token refresh not yet implemented");
  return credentials;
}
