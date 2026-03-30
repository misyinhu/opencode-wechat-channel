#!/bin/bash
set -e

echo "🔧 安装 OpenCode WeChat Channel..."

npm install

npm run build

echo "✅ 安装完成！"
echo "🚀 运行 'node bin/cli.js' 启动通道"
