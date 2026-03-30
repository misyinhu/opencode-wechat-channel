# OpenCode WeChat Channel

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> 将微信消息桥接到 OpenCode ACP 会话，实现微信与 AI 助手的双向对话。

## 功能特性

- ✅ 微信扫码登录
- ✅ 微信消息自动转发到 OpenCode
- ✅ OpenCode 回复自动发送到微信
- ✅ 支持"正在输入"状态显示
- ✅ /list 命令查看最近会话
- ✅ /send 命令发送消息到指定会话

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

1. 启动 OpenCode ACP 服务（端口 4097）
2. 运行插件：

```bash
opencode-wechat-channel
```

3. 扫描显示的二维码登录微信

## 使用方式

### 微信命令

| 命令 | 说明 |
|------|------|
| `/list` | 显示最近 5 个活跃会话 |
| `/send 序号 消息` | 发送消息到指定会话 |

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
→ 已发送给: 接口调试
```

## 工作原理

```
微信用户 → /send 序号 消息 → WeChat Channel → ACP → OpenCode 会话
                                   ↓
                              发送回复 → 微信用户
```

## 配置

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
