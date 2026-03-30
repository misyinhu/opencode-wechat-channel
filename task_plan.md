# opencode-wechat-channel 实施计划

> 基于 SPEC.md 转化为原子任务清单

## 项目信息
- **项目**: opencode-wechat-channel
- **类型**: OpenCode MCP Channel 插件
- **核心功能**: 将微信消息桥接到 OpenCode 会话

---

## 阶段 1: 核心功能 (MVP)

### Task 1.1: OAuth 登录模块
- [x] 创建 `src/auth/oauth.ts`
- [x] 实现 buildWxLoginUrl (生成微信扫码登录 URL)
- [x] 实现 getWxLoginState (轮询登录状态)
- [x] 实现 wxLogin (完成登录获取 token)
- [x] 实现凭据保存/加载/刷新
- [x] 测试: buildWxLoginUrl

### Task 1.2: WebSocket AGP 客户端
- [x] 创建 `src/websocket/client.ts`
- [x] 实现 WeChatAGPClient 类
- [x] 实现 WebSocket 连接
- [x] 实现消息接收 (session.prompt)
- [x] 实现消息发送 (session.promptResponse)
- [x] 实现流式消息 (session.update)
- [x] 实现心跳机制
- [x] 实现重连逻辑 (max 5 次)
- [x] 测试: WeChatAGPClient 基本功能

### Task 1.3: MCP 服务器集成
- [x] 创建 `src/wechat-channel.ts`
- [x] 集成 MCP Server
- [x] 实现 notifications/claude/channel
- [x] 实现 wechat_reply 工具
- [x] 修复 sendMessage 功能 (使用 userSessions 追踪)
- [x] 测试: WeChatChannel

### Task 1.4: CLI 入口
- [x] 创建 `src/index.ts`
- [x] 创建 `bin/cli.js`
- [x] 实现 npm 包导出

---

## 阶段 2: 测试覆盖

### Task 2.1: 单元测试
- [x] tests/auth.test.ts - OAuth 基本测试 (3 tests)
- [x] tests/mcp.test.ts - MCP 客户端测试 (3 tests)
- [x] tests/oauth.test.ts - OAuth URL 生成测试 (4 tests)
- [x] tests/websocket.test.ts - WebSocket 客户端测试 (7 tests)
- [x] tests/wechat-channel.test.ts - Channel 测试 (3 tests)

**当前状态**: 20/20 tests passed

---

## 阶段 3: 工程规范

### Task 3.1: 项目文件
- [x] package.json 配置
- [x] tsconfig.json 配置
- [x] .gitignore (添加)
- [x] LICENSE (添加 - MIT)
- [ ] CHANGELOG.md
- [ ] CONTRIBUTING.md

### Task 3.2: 文档
- [x] README.md - 用户文档
- [x] SPEC.md - 产品规格

---

## 阶段 4: 高级功能 (后续)

### Task 4.1: 消息类型支持
- [ ] 图片消息处理
- [ ] 语音消息处理
- [ ] 文件消息处理
- [ ] 视频消息处理

### Task 4.2: 群聊支持
- [ ] 群聊消息识别
- [ ] @提及处理
- [ ] 群聊回复

### Task 4.3: 错误处理
- [ ] 完善错误处理
- [ ] 优雅关闭 (graceful shutdown)
- [ ] 日志优化

### Task 4.4: CI/CD
- [ ] GitHub Actions
- [ ] npm publish 配置

---

## 实施检查点

### 已完成
- [x] 核心 MVP 功能
- [x] 20 个单元测试通过
- [x] 构建成功
- [x] .gitignore 添加
- [x] LICENSE 添加
- [x] sendMessage 功能修复

### 待完成 (P1)
- [x] 集成 tools.ts 到 MCP (已实现)
- [x] graceful shutdown (已实现)
- [x] 清理未使用导入 (已完成)

### 待完成 (低优先级)
- [ ] CHANGELOG.md
- [ ] CONTRIBUTING.md
- [ ] 高级消息类型
- [ ] 群聊支持

---

## 技术约束

- Node.js >= 18
- TypeScript >= 5.0
- @modelcontextprotocol/sdk
- 微信 ilink API (AGP Protocol)

---

*最后更新: 2026-03-29*
