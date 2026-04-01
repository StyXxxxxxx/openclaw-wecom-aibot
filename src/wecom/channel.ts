import type { ChannelPlugin } from "openclaw/plugin-sdk";
import { DEFAULT_ACCOUNT_ID } from "openclaw/plugin-sdk/account-id";
import type { WeComAiBotAccount, WeComAiBotChannelConfig, WeComAiBotProbe } from "./types.js";
import { listWeComAccountIds, resolveWeComAccount } from "./config.js";
import { wecomGateway } from "./gateway.js";

export const wecomAiBotChannelPlugin: ChannelPlugin<WeComAiBotAccount, WeComAiBotProbe> = {
  id: "wecom-aibot",
  meta: {
    id: "wecom-aibot",
    label: "WeCom AI Bot",
    selectionLabel: "WeCom (AI Bot via WebSocket)",
    docsPath: "/channels/wecom-aibot",
    blurb: "Connect OpenClaw to WeCom AI Bot (WebSocket long connection)",
    aliases: ["wecom", "wxwork"],
    quickstartAllowFrom: true,
  },
  capabilities: {
    chatTypes: ["direct", "group"],
    reactions: false,
    threads: false,
    media: false,
    reply: true,
    blockStreaming: true,
  },
  streaming: {
    blockStreamingCoalesceDefaults: {
      minChars: 24,
      idleMs: 500,
    },
  },
  configSchema: {
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        enabled: { type: "boolean", default: true },
        botId: { type: "string" },
        secret: { type: "string" },
        defaultTo: { type: "string" },
        allowFrom: { type: "array", items: { type: "string" }, default: [] },
        accounts: {
          type: "object",
          additionalProperties: {
            type: "object",
            additionalProperties: false,
            properties: {
              enabled: { type: "boolean", default: true },
              name: { type: "string" },
              botId: { type: "string" },
              secret: { type: "string" },
              defaultTo: { type: "string" },
              allowFrom: { type: "array", items: { type: "string" }, default: [] },
            },
            required: ["botId", "secret"],
          },
          default: {},
        },
      },
    },
    uiHints: {
      secret: { sensitive: true, label: "botSecret" },
      botId: { label: "botId" },
      defaultTo: { label: "默认发送目标 (chatid)", placeholder: "xxxx" },
    },
  },
  reload: {
    configPrefixes: ["channels.wecom-aibot"],
  },
  config: {
    listAccountIds: (cfg: any) => listWeComAccountIds(cfg),
    resolveAccount: (cfg: any, accountId?: string | null) => resolveWeComAccount(cfg, accountId),
    defaultAccountId: () => DEFAULT_ACCOUNT_ID,
  },
  outbound: {
    deliveryMode: "direct",
    sendText: async ({ cfg, to, text, replyToId, accountId }: any) => {
      const account = resolveWeComAccount(cfg, accountId);
      const targetChatId = to?.trim?.() || account.defaultTo;
      if (!targetChatId && !replyToId) {
        throw new Error("wecom-aibot: 缺少目标 chatid（请设置 channels.wecom-aibot.defaultTo 或在出站目标里指定）");
      }

      if (replyToId) {
        await wecomGateway.sendReplyMarkdown({
          account,
          reqId: String(replyToId),
          markdown: text ?? "",
        });
        return { channel: "wecom-aibot", messageId: `wecom-reply-${Date.now()}`, chatId: targetChatId };
      }

      await wecomGateway.sendChatMarkdown({
        account,
        chatid: String(targetChatId),
        markdown: text ?? "",
      });
      return { channel: "wecom-aibot", messageId: `wecom-send-${Date.now()}`, chatId: targetChatId };
    },
  },
  gateway: {
    startAccount: async (ctx: any) => {
      return wecomGateway.startAccount(ctx);
    },
    stopAccount: async (ctx: any) => {
      await wecomGateway.stopAccount(ctx);
    },
  },
};
