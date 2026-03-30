# OpenCode WeChat Channel

将微信消息桥接到 OpenCode 会话的 Channel 插件。

基于微信官方 ClawBot ilink API（与 `@tencent-weixin/openclaw-weixin` 使用相同协议），让你在微信中直接与 OpenCode 对话。

## 工作原理

```
微信 (iOS) → WeChat ClawBot → ilink API → [本插件] → OpenCode Session
                                                  ↕
OpenCode ← MCP Channel Protocol ← wechat_reply tool
```

## 前置要求

- [Node.js](https://nodejs.org) >= 18
- [OpenCode](https://opencode.ai) >= 最新版本
- 微信 iOS 最新版（需支持 ClawBot 插件）

## 快速开始

### 1. 安装

```bash
npm install -g opencode-wechat-channel
```

### 2. 微信扫码登录

```bash
opencode-wechat-channel setup
```

终端会显示二维码，用微信扫描并确认。凭据保存到 `~/.opencode/channels/wechat/account.json`。

### 3. 生成 MCP 配置

```bash
opencode-wechat-channel install
```

这会在当前目录生成（或更新） `.mcp.json`，指向本插件。

### 4. 启动 OpenCode + WeChat 通道

```bash
opencode --channel wechat
```

### 5. 在微信中发消息

打开微信，找到 ClawBot 对话，发送消息。消息会出现在 OpenCode 终端中，OpenCode 的回复会自动发回微信。

## 命令说明

| 命令 | 说明 |
|------|------|
| `opencode-wechat-channel setup` | 微信扫码登录 |
| `opencode-wechat-channel install` | 生成 .mcp.json 配置 |
| `opencode-wechat-channel start` | 启动 MCP Channel 服务器 |
| `opencode-wechat-channel help` | 显示帮助 |

## 技术细节

- **消息接收**: 通过 ilink/bot/getupdates 长轮询获取微信消息
- **消息发送**: 通过 ilink/bot/sendmessage 发送回复
- **认证**: 使用 ilink/bot/get_bot_qrcode QR 码登录获取 Bearer Token
- **协议**: 基于 MCP (Model Context Protocol) 的 Channel 扩展

## 注意事项

- 当前为 research preview 阶段，需要使用 `--dangerously-load-development-channels` 标志
- OpenCode 会话关闭后通道也会断开
- 微信 ClawBot 目前仅支持 iOS 最新版
- 每个 ClawBot 只能连接一个 agent 实例

## 开发

### 安装依赖

```bash
npm install
```

### 编译

```bash
npm run build
```

### 运行测试

```bash
npm test
```

## License

MIT
