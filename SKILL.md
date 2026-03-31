---
name: opencode-wechat-channel
description: |
  OpenCode 微信通道插件 - 将微信消息桥接到 OpenCode ACP 会话。
  
  当用户需要时使用：
  - 在微信中使用 OpenCode AI 助手
  - 微信消息自动转发到 OpenCode
  - 通过 /list 命令查看会话列表
  - 通过 /send 命令发送消息到指定会话
  - 直接发送消息到当前会话
---

# OpenCode WeChat Channel

## 安装

```bash
scripts/install.sh
```

## 使用方式

### 启动通道

```bash
node bin/cli.js
```

首次启动会显示微信二维码，扫码登录后自动保存凭证。后续启动自动登录。

### 前置条件

确保 `~/.config/opencode/opencode.json` 中设置了默认模型：

```json
{
  "model": "opencode/qwen3.6-plus-free"
}
```

### 微信命令

| 命令 | 说明 |
|------|------|
| `/list` | 显示最近 5 个活跃会话（序号 1-5） |
| `/send 0 消息` | 创建新会话并发送消息 |
| `/send N 消息` | 发送消息到第 N 个会话（N 对应 /list 中的序号） |
| 直接发送消息 | 发送到当前会话（启动时创建的会话） |

### 消息处理

- 微信消息自动转发到 OpenCode
- OpenCode 回复自动发送到微信（带会话名标注）
- 支持"正在输入"状态显示

## 工作原理

```
微信用户 → 消息 → WeChat Channel → ACP (port 4097) → OpenCode 会话
                                    ↓
                               发送回复 → 微信用户
```

## 相关文件

- `src/wechat-channel.ts` - 核心实现
- `scripts/install.sh` - 安装脚本
- `README.md` - 详细文档
