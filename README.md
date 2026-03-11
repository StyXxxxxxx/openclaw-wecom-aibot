# wecom-aibot（OpenClaw Channel Plugin）

把 OpenClaw 接入企业微信「智能机器人」的 WebSocket 长连接通道。

本项目基于 `@wecom/aibot-node-sdk`，在 OpenClaw 侧实现一个 `wecom-aibot` 渠道插件：

- 企业微信 ⇄（WebSocket）⇄ 本插件 ⇄ OpenClaw Agent/Models

## 能做到什么

- 接收企业微信机器人推送的 **文本消息**（单聊/群聊）。
- 将入站消息转换为 OpenClaw 的标准上下文，交由默认/绑定的 agent 处理。
- 将 OpenClaw 的回复以 **Markdown 文本**回发到企业微信（通过 WebSocket 回复通道）。
- 支持 **流式输出**：当 OpenClaw 对当前模型/路由产生 `block` 分段时，本插件会用同一个 `streamId` 持续刷新内容，并在本轮结束时 `finish=true` 完成流式消息。
- 支持多账号配置（`channels.wecom-aibot.accounts`）。
- 支持基础 allowlist（`allowFrom`）。

## 还没做到什么（已知限制）

- 受限于@wecom/aibot-node-sdk@1.0.1目前的能力，未实现理想的流式传输
- 实现了 **文本** 入站与文本/markdown 出站；图片/文件/语音/图文混排目前未接入。
- 未实现企业微信侧的模板卡片（Template Card）与交互事件回调。
- 群聊的更细粒度权限（比如群里 @ 提及才响应）未做专门适配，依赖 OpenClaw 的通用群策略/路由能力。

## 安装方式（OpenClaw）

### 方式 A：从 npm 安装（推荐用于部署/服务器）

```bash
openclaw plugins install wecom-aibot@latest --pin
openclaw plugins enable wecom-aibot
```

### 方式 B：从本地目录安装（会拷贝文件）

```bash
openclaw plugins install /path/to/wecom-aibot
openclaw plugins enable wecom-aibot
```

### 方式 C：开发模式（link，不拷贝，适合迭代）

```bash
openclaw plugins install -l /path/to/wecom-aibot
openclaw plugins enable wecom-aibot
```

修改代码后：

```bash
npm run build
```

然后重启 `openclaw gateway`。

## 配置（openclaw.json）

编辑 `~/.openclaw/openclaw.json`

### 单账号

```json
{
  "channels": {
    "wecom-aibot": {
      "enabled": true,
      "botId": "YOUR_BOT_ID",
      "secret": "YOUR_BOT_SECRET",
      "defaultTo": "DEFAULT_CHATID",
      "allowFrom": ["*"]
    }
  }
}
```

### 多账号

```json
{
  "channels": {
    "wecom-aibot": {
      "accounts": {
        "default": { "botId": "BOT1", "secret": "SECRET1", "allowFrom": ["*"] },
        "bot2": { "botId": "BOT2", "secret": "SECRET2", "defaultTo": "CHATID2" }
      }
    }
  }
}
```

字段说明：

- `botId` / `secret`：企业微信智能机器人凭据。
- `allowFrom`：允许的 `userid` 列表；包含 `"*"` 表示放行全部。
- `defaultTo`：当 OpenClaw 主动出站且未指定目标时使用的 `chatid`（仅用于主动发送）。

## 运行

```bash
openclaw gateway
```

如果看到 OpenClaw 提示 `plugins.allow is empty`，建议显式加白名单：

```json
{
  "plugins": {
    "allow": ["wecom-aibot"],
    "entries": { "wecom-aibot": { "enabled": true } }
  }
}
```

## 代码结构

- `src/wecom/channel.ts`：ChannelPlugin 定义、配置 schema、出站发送、streaming 能力声明
- `src/wecom/gateway.ts`：WebSocket 客户端管理、入站处理、会话与流式回复桥接
- `src/wecom/config.ts`：`channels.wecom-aibot` 配置解析与多账号解析
