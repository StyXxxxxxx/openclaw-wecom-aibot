import AiBot, { generateReqId } from "@wecom/aibot-node-sdk";
import type { WSClient, WsFrame } from "@wecom/aibot-node-sdk";
import type { ChannelGatewayContext, OutboundReplyPayload } from "openclaw/plugin-sdk";
import { formatErrorMessage, waitUntilAbort } from "openclaw/plugin-sdk";
import type { WeComAiBotAccount } from "./types.js";
import { getWeComRuntime } from "./runtime.js";

const CHANNEL_ID = "wecom-aibot";

type ClientEntry = {
  accountId: string;
  account: WeComAiBotAccount;
  client: WSClient;
  handlersAttached: boolean;
};

type SendChatMarkdownParams = {
  account: WeComAiBotAccount;
  chatid: string;
  markdown: string;
};

type SendReplyMarkdownParams = {
  account: WeComAiBotAccount;
  reqId: string;
  markdown: string;
};

class WeComGateway {
  private clients = new Map<string, ClientEntry>();

  async startAccount(ctx: ChannelGatewayContext<WeComAiBotAccount>) {
    const { accountId, account, log, abortSignal } = ctx;
    if (!account.enabled) {
      log?.info?.(`[${CHANNEL_ID}] account ${accountId} disabled, skipping`);
      return waitUntilAbort(abortSignal);
    }

    if (!account.botId || !account.secret) {
      log?.warn?.(`[${CHANNEL_ID}] account ${accountId} missing botId/secret, skipping`);
      return waitUntilAbort(abortSignal);
    }

    const entry = this.ensureClient({ accountId, account, log });
    this.attachInboundHandlers(ctx);

    const onAbort = () => {
      try {
        entry.client.disconnect();
      } finally {
        this.clients.delete(accountId);
      }
    };

    return waitUntilAbort(abortSignal).finally(onAbort);
  }

  async stopAccount(ctx: ChannelGatewayContext<WeComAiBotAccount>) {
    const entry = this.clients.get(ctx.accountId);
    if (!entry) return;
    entry.client.disconnect();
    this.clients.delete(ctx.accountId);
  }

  async sendChatMarkdown(params: SendChatMarkdownParams) {
    const entry = this.ensureClient({ accountId: params.account.accountId, account: params.account });
    await entry.client.sendMessage(params.chatid, {
      msgtype: "markdown",
      markdown: { content: params.markdown },
    });
  }

  async sendReplyMarkdown(params: SendReplyMarkdownParams) {
    const entry = this.ensureClient({ accountId: params.account.accountId, account: params.account });
    await entry.client.reply({ headers: { req_id: params.reqId } }, {
      msgtype: "markdown",
      markdown: { content: params.markdown },
    });
  }

  private ensureClient(params: { accountId: string; account: WeComAiBotAccount; log?: any }): ClientEntry {
    const existing = this.clients.get(params.accountId);
    if (existing) return existing;

    const client = new AiBot.WSClient({ botId: params.account.botId, secret: params.account.secret });

    client.on("authenticated", () => {
      params.log?.info?.(`[${CHANNEL_ID}] authenticated account=${params.accountId}`);
    });

    client.connect();

    const entry = { accountId: params.accountId, account: params.account, client, handlersAttached: false };
    this.clients.set(params.accountId, entry);
    return entry;
  }

  attachInboundHandlers(ctx: ChannelGatewayContext<WeComAiBotAccount>) {
    const entry = this.ensureClient({ accountId: ctx.accountId, account: ctx.account, log: ctx.log });

    if (entry.handlersAttached) return;
    entry.handlersAttached = true;

    entry.client.on("message.text", (frame: WsFrame) => {
      this.onInboundText(ctx, frame).catch((err) => {
        ctx.log?.error?.(`[${CHANNEL_ID}] inbound text error account=${ctx.accountId} ${formatErrorMessage(err)}`);
      });
    });

    entry.client.on("event.enter_chat", (frame: WsFrame) => {
      this.onEnterChat(ctx, frame).catch((err) => {
        ctx.log?.error?.(`[${CHANNEL_ID}] enter_chat error account=${ctx.accountId} ${formatErrorMessage(err)}`);
      });
    });
  }

  private async onEnterChat(ctx: ChannelGatewayContext<WeComAiBotAccount>, frame: WsFrame) {
    const reqId = frame?.headers?.req_id;
    if (!reqId) return;
    const entry = this.ensureClient({ accountId: ctx.accountId, account: ctx.account, log: ctx.log });
    const streamId = generateReqId("stream");
    await entry.client.replyStream({ headers: { req_id: reqId } }, streamId, "欢迎使用，我是智能助手。", true);
  }

  private async onInboundText(ctx: ChannelGatewayContext<WeComAiBotAccount>, frame: WsFrame) {
    const reqId = frame?.headers?.req_id;
    const msg: any = frame?.body ?? {};
    const content = msg?.text?.content as string | undefined;
    if (!content) return;

    const chatType = msg?.chattype === "group" ? "group" : "direct";
    const senderId = String(msg?.from?.userid ?? "unknown");
    const chatId = msg?.chatid ? String(msg.chatid) : undefined;
    const conversationId = chatType === "group" ? chatId : senderId;
    if (!conversationId) {
      ctx.log?.warn?.(`[${CHANNEL_ID}] inbound missing conversation id account=${ctx.accountId}`);
      return;
    }

    const allowFrom = ctx.account.allowFrom ?? [];
    if (senderId && allowFrom.length && !allowFrom.includes("*") && !allowFrom.includes(senderId)) {
      return;
    }

    const channelRt = ctx.channelRuntime ?? getWeComRuntime().channel;
    const cfg = await getWeComRuntime().config.loadConfig();

    const peer = { kind: chatType as any, id: conversationId };
    const route = channelRt.routing.resolveAgentRoute({
      cfg,
      channel: CHANNEL_ID,
      accountId: ctx.accountId,
      peer,
    });

    ctx.log?.info?.(
      `[${CHANNEL_ID}] inbound route agent=${route.agentId} matchedBy=${route.matchedBy} sessionKey=${route.sessionKey}`,
    );

    const to = `${CHANNEL_ID}:${conversationId}`;

    const msgCtx = channelRt.reply.finalizeInboundContext({
      Body: content,
      RawBody: content,
      CommandBody: content,
      From: `${CHANNEL_ID}:${senderId}`,
      To: to,
      SessionKey: route.sessionKey,
      AccountId: route.accountId,
      MessageSid: String(msg?.msgid ?? reqId ?? ""),
      ReplyToId: reqId ? String(reqId) : undefined,
      ChatType: chatType,
      SenderId: senderId,
      SenderName: senderId,
      Provider: CHANNEL_ID,
      Surface: CHANNEL_ID,
      OriginatingChannel: CHANNEL_ID,
      OriginatingTo: to,
      ConversationLabel: chatType === "group" ? `group:${conversationId}` : senderId,
      Timestamp: Number.isFinite(msg?.create_time) ? Number(msg.create_time) * 1000 : Date.now(),
      NativeChannelId: conversationId,
    });

    const entry = this.ensureClient({ accountId: ctx.accountId, account: ctx.account, log: ctx.log });
    const streamId = generateReqId("stream");
    let lastStreamText: string | undefined;

    const dispatchResult = await channelRt.reply.dispatchReplyWithBufferedBlockDispatcher({
      ctx: msgCtx,
      cfg,
      dispatcherOptions: {
        deliver: async (payload: OutboundReplyPayload, info: { kind: string }) => {
          const rawText = (payload as any)?.text ?? (payload as any)?.body;
          const text = rawText === undefined || rawText === null ? undefined : String(rawText);

          const trimmed = text?.trim();
          ctx.log?.info?.(
            `[${CHANNEL_ID}] deliver kind=${info.kind} textLen=${text?.length ?? 0} trimLen=${trimmed?.length ?? 0} keys=${Object.keys(payload as any).join(",")}`,
          );
          if (trimmed) {
            ctx.log?.info?.(`[${CHANNEL_ID}] deliver preview=${JSON.stringify(trimmed.slice(0, 120))}`);
          }

          if (!trimmed) return;
          if (reqId) {
            lastStreamText = trimmed;
            await entry.client.replyStream({ headers: { req_id: reqId } }, streamId, lastStreamText, false);
            return;
          }

          if (info.kind !== "final") return;
          const fallbackChatId = chatId ?? ctx.account.defaultTo;
          if (!fallbackChatId) return;
          await entry.client.sendMessage(String(fallbackChatId), {
            msgtype: "markdown",
            markdown: { content: String(text) },
          });
        },
        onSkip: (_payload, info) => {
          ctx.log?.info?.(
            `[${CHANNEL_ID}] reply skipped kind=${info.kind} reason=${info.reason} account=${ctx.accountId} sender=${senderId}`,
          );
        },
        onError: (err, info) => {
          ctx.log?.error?.(
            `[${CHANNEL_ID}] reply dispatch error kind=${info.kind} account=${ctx.accountId} sender=${senderId} err=${formatErrorMessage(err)}`,
          );
        },
        onReplyStart: async () => {
          if (!reqId) return;
          lastStreamText = "正在思考中...";
          await entry.client.replyStream({ headers: { req_id: reqId } }, streamId, lastStreamText, false);
        },
      },
      replyOptions: {
        onModelSelected: (m) => {
          ctx.log?.info?.(`[${CHANNEL_ID}] model selected provider=${m.provider} model=${m.model} think=${m.thinkLevel ?? ""}`);
        },
      },
    });

    ctx.log?.info?.(
      `[${CHANNEL_ID}] dispatch result queuedFinal=${dispatchResult.queuedFinal} counts=${JSON.stringify(dispatchResult.counts)}`,
    );

    if (reqId) {
      const safeFinalText =
        !lastStreamText || lastStreamText === "正在思考中..."
          ? "抱歉，我现在暂时无法生成回复（请检查 OpenClaw 模型配置/鉴权日志）。"
          : lastStreamText;

      ctx.log?.info?.(
        `[${CHANNEL_ID}] finalize stream finish=true textLen=${safeFinalText.length} isFallback=${safeFinalText.startsWith("抱歉，我现在暂时无法生成回复")}`,
      );

      await entry.client.replyStream({ headers: { req_id: reqId } }, streamId, safeFinalText, true);
    }
  }
}

export const wecomGateway = new WeComGateway();
