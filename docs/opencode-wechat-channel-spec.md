# OpenCode WeChat Channel 插件规范

## 1. 产品概述

### 1.1 基本信息
- **产品名称**: opencode-wechat-channel
- **类型**: OpenCode MCP Channel 插件
- **核心价值**: 将微信消息桥接到 OpenCode 会话，实现微信与 AI 助手的双向对话
- **参考项目**: [Johnixr/claude-code-wechat-channel](https://github.com/Johnixr/claude-code-wechat-channel)

### 1.2 目标用户
- OpenCode 用户
- 需要在微信中便捷使用 AI 助手的开发者
- 中文开发者社区

### 1.3 变现模式
- 开源免费 (MIT License)
- 社区贡献

---

## 2. 竞品分析

### 2.1 现有竞品

| 竞品 | 核心功能 | 不足 | 我们的机会 |
|------|---------|------|-----------|
| claude-code-wechat-channel | 微信→Claude Code 双向消息 | 仅支持 Claude Code | +适配 OpenCode |
| m1heng/claude-plugin-weixin | 微信消息转发 | 功能较基础 | +更多消息类型支持 |
| sitarua/wechat-agent-channel | 支持 Claude Code/Codex | Python 实现 | +TypeScript 实现 |
| BiboyQG/WeChat-MCP | macOS 微信自动化 | 需 macOS + Accessibility | +ilink API (跨平台) |

### 2.2 核心差异化
**一句话差异化定位**: 专为 OpenCode 打造的微信 Channel 插件，通过官方 ilink API 实现稳定可靠的双向消息传递。

---

## 3. 专家建议总结

### 3.1 领域专家建议
- 🔴 **必须**: 支持所有消息类型 (文本/图片/语音/文件/视频)
- 🔴 **必须**: 群聊消息支持
- 🟡 **重要**: 消息撤回/删除处理
- 🟢 **建议**: Typing 状态指示

### 3.2 技术专家建议
- 🔴 **必须**: MCP Channel 协议正确实现
- 🔴 **必须**: ilink API 错误处理与重试机制
- 🟡 **重要**: Context Token 缓存持久化
- 🟢 **建议**: 媒体文件 CDN 加密传输

### 3.3 运营专家建议
- 🔴 **必须**: 详细的 README + 快速开始指南
- 🟡 **重要**: 与 OpenCode 官方文档集成
- 🟢 **建议**: 社区支持 (Discord/微信群)

---

## 4. 技术架构

### 4.1 技术栈
| 组件 | 技术选型 | 版本 |
|------|---------|------|
| 语言 | TypeScript | >= 5.0 |
| 运行时 | Node.js | >= 18 |
| MCP SDK | @modelcontextprotocol/sdk | latest |
| 包管理 | npm | >= 9 |
| 协议 | 微信 ilink API | ClawBot (AGP Protocol) |
| 消息传输 | WebSocket | wss://mmgrcalltoken.3g.qq.com/agentwss |
| 可选依赖 | qclaw-wechat-client | MIT License (参考实现) |

### 4.2 系统架构
```
┌─────────────────────────────────────────────────────────────┐
│                     opencode-wechat-channel                  │
├─────────────────────────────────────────────────────────────┤
│  CLI (setup, install, start)                               │
├─────────────────────────────────────────────────────────────┤
│  Auth Module                                                 │
│  ├── OAuth Login (QR Code)                                  │
│  ├── Token Management (JWT)                                 │
│  └── Token Refresh                                          │
├─────────────────────────────────────────────────────────────┤
│  WebSocket Client (AGP Protocol)                            │
│  ├── session.prompt (receive)                               │
│  ├── session.update (stream chunks)                         │
│  └── session.promptResponse (send final)                   │
├─────────────────────────────────────────────────────────────┤
│  MCP Server                                                 │
│  ├── notifications/claude/channel                          │
│  └── tools: wechat_reply, wechat_send_image                │
└─────────────────────────────────────────────────────────────┘
                              ↓
微信 (iOS) → WeChat ClawBot → WebSocket (AGP) → OpenCode Session
                                                              ↕
OpenCode ← MCP Channel Protocol ← wechat_reply tool
```

### 4.3 目录结构
```
opencode-wechat-channel/
├── src/
│   ├── index.ts              # 入口文件
│   ├── wechat-channel.ts     # 核心逻辑
│   ├── auth/                 # 认证模块
│   │   ├── oauth.ts          # OAuth 登录流程
│   │   └── token.ts          # JWT Token 管理
│   ├── websocket/            # WebSocket 模块
│   │   ├── client.ts         # AGP WebSocket 客户端
│   │   └── protocol.ts       # AGP 协议解析
│   ├── api.ts                # ilink HTTP API 封装
│   ├── mcp-server.ts         # MCP 服务器
│   ├── tools.ts              # 工具定义
│   └── types.ts              # 类型定义
├── bin/
│   └── cli.js                # CLI 入口
├── package.json
├── tsconfig.json
└── README.md
```

### 4.4 依赖库选择

**强烈推荐**: 直接使用或封装 [qclaw-wechat-client](https://github.com/photon-hq/qclaw-wechat-client) (MIT License)

该库已完整实现：
- ✅ OAuth 登录流程 (`getWxLoginState`, `wxLogin`, `buildWxLoginUrl`)
- ✅ Token 管理 (`refreshChannelToken`, JWT 自动刷新)
- ✅ AGP WebSocket 客户端 (`AGPClient` 类)
- ✅ 心跳保活、自动重连、消息去重

**备选方案**: 如果需要更多定制，可参考微信官方 [@tencent-weixin/openclaw-weixin](https://www.npmjs.com/package/@tencent-weixin/openclaw-weixin) NPM 包

---

## 5. 功能规格

### 5.1 P0 - MVP 必须 (核心体验)

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 微信扫码登录 | 通过 ilink/bot/get_bot_qrcode 获取二维码并轮询状态 | 🔴 |
| 消息接收 | 长轮询 ilink/bot/getupdates 获取微信消息 | 🔴 |
| 消息发送 | 通过 ilink/bot/sendmessage 发送文本回复 | 🔴 |
| 文本消息 | 支持接收和发送纯文本 | 🔴 |
| MCP Channel | 实现 notifications/claude/channel 协议 | 🔴 |
| wechat_reply 工具 | OpenCode 可调用的回复工具 | 🔴 |

### 5.2 P1 - 重要 (影响转化)

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 图片消息 | 接收和发送图片 (CDN 加密) | 🟡 |
| 语音消息 | 接收语音 (微信转文字) | 🟡 |
| 群聊支持 | 识别群 ID 和发送者 | 🟡 |
| Context Token 缓存 | 持久化缓存实现会话恢复 | 🟡 |
| Typing 指示器 | 发送 "正在输入" 状态 | 🟡 |

### 5.3 P2 - 增强 (后续迭代)

| 功能 | 描述 | 优先级 |
|------|------|--------|
| 文件消息 | 接收和发送文件 | 🟢 |
| 视频消息 | 接收视频 | 🟢 |
| 引用消息 | 支持引用回复 | 🟢 |
| 多账户支持 | 同时连接多个微信 | 🟢 |

---

## 6. API 接口

### 6.1 ilink API 端点 (HTTP)

**基础 URL**: `https://jprx.m.qq.com/`

| 端点 | 方法 | 描述 |
|------|------|------|
| `/data/4050/forward` | POST | getWxLoginState - 获取 OAuth CSRF 状态 (需要 guid 参数) |
| `/data/4026/forward` | POST | wxLogin - 换取 JWT Token + channel_token |
| `/data/4055/forward` | POST | createApiKey - 创建 API Key |
| `/data/4058/forward` | POST | refreshChannelToken - 刷新 channel token |
| WebSocket `/agentwss` | WS | `wss://mmgrcalltoken.3g.qq.com/agentwss` - 实时消息传输 |

### 6.2 认证流程

**完整 OAuth 登录流程**:
```
1. generateGuid() → 生成唯一的设备 guid
2. getWxLoginState({ guid }) → 获取 CSRF state
3. buildWxLoginUrl(state, appId: 'wx9d11056dd75b7240') → 构建微信 OAuth URL
4. 用户扫码 → 微信返回 code
5. wxLogin({ guid, code, state }) → 换取 JWT + channel_token
6. refreshChannelToken() → 定期刷新 token
```

**微信 OAuth 配置**:
- appid: `wx9d11056dd75b7240`
- redirect_uri: `https://security.guanjia.qq.com/login`
- scope: `snsapi_login` (硬编码)

### 6.3 AGP WebSocket 消息类型

| 消息类型 | 方向 | 描述 |
|---------|------|------|
| `session.prompt` | Server → Client | 用户消息到达 |
| `session.update` | Server → Client | 流式响应片段 |
| `session.promptResponse` | Client → Server | 发送最终回复 |

### 6.4 MCP 工具

### 6.2 MCP 工具

#### wechat_reply
```typescript
{
  name: "wechat_reply",
  input: {
    sender_id: string,    // 用户 ID (xxx@im.wechat) 或群 ID
    text: string          // 纯文本消息
  }
}
```

#### wechat_send_image
```typescript
{
  name: "wechat_send_image",
  input: {
    sender_id: string,    // 用户 ID 或群 ID
    file_path: string     // 图片绝对路径
  }
}
```

---

## 7. 消息格式

### 7.1 Channel Event 格式
```xml
<channel source="wechat" 
         sender="xxx" 
         sender_id="xxx@im.wechat" 
         msg_type="text"
         can_reply="true"
         is_group="false">
消息内容
</channel>
```

### 7.2 消息类型映射
| ilink 类型 | msg_type | 说明 |
|-----------|----------|------|
| 1 (text) | text | 文本消息 |
| 2 (image) | image | 图片消息 |
| 3 (voice) | voice | 语音消息 (含转文字) |
| 4 (file) | file | 文件消息 |
| 5 (video) | video | 视频消息 |

---

## 8. 配置文件

### 8.1 凭据存储
路径: `~/.opencode/channels/wechat/account.json`
```json
{
  "token": "xxx",
  "baseUrl": "https://ilinkai.weixin.qq.com",
  "accountId": "xxx",
  "userId": "xxx",
  "savedAt": "2026-01-01T00:00:00Z"
}
```

### 8.2 Context Token 缓存
路径: `~/.opencode/channels/wechat/context_tokens.json`
```json
{
  "xxx@im.wechat": "context_token_xxx"
}
```

### 8.3 同步缓冲
路径: `~/.opencode/channels/wechat/sync_buf.txt`

---

## 9. CLI 命令

| 命令 | 描述 |
|------|------|
| `npx opencode-wechat-channel setup` | 微信扫码登录 |
| `npx opencode-wechat-channel install` | 生成 MCP 配置 |
| `npx opencode-wechat-channel start` | 启动 MCP 服务器 |
| `npx opencode-wechat-channel help` | 显示帮助 |

---

## 10. 使用方式

### 10.1 安装
```bash
npm install -g opencode-wechat-channel
```

### 10.2 配置 MCP
在项目目录生成 `.mcp.json`:
```bash
npx opencode-wechat-channel install
```

### 10.3 启动
```bash
opencode --channel wechat
# 或开发模式
opencode --dangerously-load-development-channels channel:wechat
```

---

## 11. 注意事项

1. **微信版本要求**: 需要微信 iOS 最新版 (支持 ClawBot)
2. **开发模式**: 当前为预览阶段，需使用 `--dangerously-load-development-channels`
3. **单实例限制**: 每个 ClawBot 只能连接一个 agent 实例
4. **会话持久性**: OpenCode 会话关闭后通道断开

---

## 12. 验收标准

### 12.1 功能验收
- [ ] 微信扫码登录成功
- [ ] 接收到微信文本消息
- [ ] OpenCode 可发送文本回复
- [ ] 接收到微信图片消息
- [ ] 可发送图片回复
- [ ] 群聊消息正常处理

### 12.2 质量验收
- [ ] 错误处理完善 (网络断开自动重试)
- [ ] 凭据安全存储
- [ ] 日志输出清晰
- [ ] README 文档完整

---

## 13. 许可

MIT License
