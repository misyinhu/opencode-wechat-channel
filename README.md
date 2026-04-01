# OpenCode WeChat Channel

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> 将微信消息桥接到 OpenCode ACP 会话，实现微信与 AI 助手的双向对话。

## 功能特性

- ✅ 微信扫码登录（支持自动恢复登录）
- ✅ 微信消息自动转发到 OpenCode
- ✅ OpenCode 回复自动发送到微信（带会话名标注）
- ✅ 支持"正在输入"状态显示
- ✅ /list 命令查看最近 5 个会话
- ✅ /send 命令发送消息到指定会话
- ✅ 默认消息发送到当前会话

## 安装

```bash
npm install -g opencode-wechat-channel
```

或从源码安装：

```bash
git clone https://github.com/misyinhu/opencode-wechat-channel.git
cd opencode-wechat-channel
scripts/install.sh
```

## 快速开始

### 1. 配置默认模型

确保 `~/.config/opencode/opencode.json` 中设置了默认模型：

```json
{
  "model": "opencode/qwen3.6-plus-free"
}
```

### 2. 运行插件

```bash
opencode-wechat-channel
```

### 3. 扫码登录微信

首次启动时，终端会显示一个二维码：

```
█████████████████████████████████
█████████████████████████████████
████ ▄▄▄▄▄ ██▀▀▄▀█ ▄▄▄▄▄ ████
████ █   █ █▄  ▀▄▀█ █   █ ████
████ █▄▄▄█ ██▀▄ █▀▄█ █▄▄▄█ ████
████▄▄▄▄▄▄▄█ ▀ █ ▀ █▄▄▄▄▄▄▄████
████▄▄▄▄ ▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀▄▀████
████▄ ▄▀▄▄▄▀▀█▀▀▄▄▀▄▄▀▄▄▀▄████
████▀▄▀▄▀▄▄▀█▀▄▄▀▄▀▄▀▄▀▄▀▄████
████ ▄▄▄▄▄ █▄▀▀▄▀▄▀█ ▄▄█▄ ████
████ █   █ ██▄▀█▄▀▄▀ ▄▀ ▀▄████
████ █▄▄▄█ █ ▄▄▀▀▄▀▄▀▄▀▄▀▄████
████▄▄▄▄▄▄▄█▄▄▄██▄▄▄▄▄▄▄▄▄████
█████████████████████████████████
█████████████████████████████████
```

**操作步骤：**
1. 打开手机微信
2. 点击右上角 **+** → **扫一扫**
3. 扫描终端中的二维码
4. 在手机上确认登录

**登录成功后：**
- 凭证自动保存到 `~/.opencode/channels/wechat/token.json`
- 下次启动自动登录，无需再次扫码

**注意事项：**
- 二维码有时效性，超时需重新启动
- 如果登录失败，删除 `~/.opencode/channels/wechat/` 目录后重试
- 确保网络畅通，二维码加载可能需要几秒钟

## 使用方式

### 微信命令

| 命令 | 说明 |
|------|------|
| `/list` | 显示最近 5 个活跃会话（序号 1-5） |
| `/send 0 消息` | 创建新会话并发送消息 |
| `/send N 消息` | 发送消息到第 N 个会话（N 对应 /list 中的序号） |
| 直接发送消息 | 发送到当前会话（启动时创建的会话） |
| `/lastreply` | 查看当前对话中 OpenCode 最近一次的回复 |

### 示例

```
/list
→ 最近会话:
序号 | 项目 | 会话名
--|---|--
1 | opencode-wechat | 微信插件开发
2 | api-server | 接口调试
3 | frontend | UI 优化

/send 2 你好，请查看这个接口
→ [接口调试]
好的，我来帮你查看...

hello
→ [当前会话名]
你好！有什么可以帮你的？

/send 0 帮我写个 Python 脚本
→ [新会话]
好的，我来帮你写...

/lastreply
→ [最后回复]
好的，我来帮你写...
```

## 工作原理

```
微信用户 → 消息 → WeChat Channel → ACP (port 4097) → OpenCode 会话
                                    ↓
                               发送回复 → 微信用户
```

## 配置

### OpenCode 默认模型

在 `~/.config/opencode/opencode.json` 中设置默认模型：

```json
{
  "model": "opencode/qwen3.6-plus-free"
}
```

### 凭据存储

凭证保存在 `~/.opencode/channels/wechat/` 目录：
- `token.json` - 微信 token
- `accounts/` - 账号配置

### ACP 端口

默认端口：4097

可通过环境变量修改：
```bash
OPENCODE_ACP_PORT=4098 opencode-wechat-channel
```

## 开发

```bash
# 开发模式
npm run dev

# 构建
npm run build

# 类型检查
npm run typecheck

# 测试
npm run test
```

## 文件结构

```
opencode-wechat-channel/
├── src/
│   ├── index.ts              # 入口文件
│   ├── wechat-channel.ts     # 核心逻辑
│   ├── auth/                 # 认证模块
│   └── websocket/            # WebSocket 客户端
├── scripts/
│   └── install.sh            # 安装脚本
├── tests/                    # 测试用例
└── docs/                     # 文档
```

## 依赖

- weixin-bot-plugin - 微信 Bot SDK
- @agentclientprotocol/sdk - ACP 协议实现

## 许可

MIT License
