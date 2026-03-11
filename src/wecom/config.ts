import type { OpenClawConfig } from "openclaw/plugin-sdk";
import type { WeComAiBotAccount, WeComAiBotAccountConfig, WeComAiBotChannelConfig } from "./types.js";

function normalizeAccountId(accountId: string | undefined | null): string {
  const trimmed = (accountId ?? "default").trim();
  return trimmed.length ? trimmed : "default";
}

function readChannelConfig(cfg: OpenClawConfig): WeComAiBotChannelConfig {
  const channels = (cfg as any)?.channels as Record<string, any> | undefined;
  const channelCfg = channels?.["wecom-aibot"] as WeComAiBotChannelConfig | undefined;
  return channelCfg ?? {};
}

function toResolvedAccount(accountId: string, partial: Partial<WeComAiBotAccountConfig> & { botId?: string; secret?: string }, fallback: Partial<WeComAiBotAccountConfig>): WeComAiBotAccount {
  const botId = partial.botId ?? fallback.botId;
  const secret = partial.secret ?? fallback.secret;
  if (!botId || !secret) {
    throw new Error(`channels.wecom-aibot: 账号 ${accountId} 缺少 botId/secret`);
  }

  return {
    accountId,
    enabled: partial.enabled ?? true,
    name: partial.name,
    botId,
    secret,
    defaultTo: partial.defaultTo ?? fallback.defaultTo,
    allowFrom: partial.allowFrom ?? fallback.allowFrom ?? [],
  };
}

export function resolveWeComAccount(cfg: OpenClawConfig, accountId?: string | null): WeComAiBotAccount {
  const normalized = normalizeAccountId(accountId);
  const channelCfg = readChannelConfig(cfg);

  const accounts = channelCfg.accounts ?? {};
  const defaultAccount = accounts.default;
  const selected = accounts[normalized];

  const topLevelFallback: Partial<WeComAiBotAccountConfig> = {
    botId: channelCfg.botId,
    secret: channelCfg.secret,
    defaultTo: channelCfg.defaultTo,
    allowFrom: channelCfg.allowFrom ?? [],
  };

  if (normalized === "default") {
    if (defaultAccount) return toResolvedAccount("default", defaultAccount, topLevelFallback);
    return toResolvedAccount("default", topLevelFallback, {});
  }

  if (!selected) {
    if (defaultAccount) return toResolvedAccount(normalized, defaultAccount, topLevelFallback);
    return toResolvedAccount(normalized, topLevelFallback, {});
  }

  return toResolvedAccount(normalized, selected, defaultAccount ?? topLevelFallback);
}

export function listWeComAccounts(cfg: OpenClawConfig): { accountId: string; enabled: boolean; name?: string }[] {
  const channelCfg = readChannelConfig(cfg);
  const accounts = channelCfg.accounts ?? {};
  const ids = new Set<string>(["default", ...Object.keys(accounts)]);
  return [...ids]
    .map((accountId) => {
      try {
        const resolved = resolveWeComAccount(cfg, accountId);
        return { accountId, enabled: resolved.enabled, name: resolved.name };
      } catch {
        const rec = accounts[accountId] as WeComAiBotAccountConfig | undefined;
        return { accountId, enabled: rec?.enabled ?? true, name: rec?.name };
      }
    })
    .sort((a, b) => a.accountId.localeCompare(b.accountId));
}

export function listWeComAccountIds(cfg: OpenClawConfig): string[] {
  return listWeComAccounts(cfg).map((a) => a.accountId);
}
