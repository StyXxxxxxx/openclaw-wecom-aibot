export type WeComAiBotChannelConfig = {
  enabled?: boolean;
  botId?: string;
  secret?: string;
  defaultTo?: string;
  allowFrom?: string[];
  accounts?: Record<string, WeComAiBotAccountConfig>;
};

export type WeComAiBotAccountConfig = {
  enabled?: boolean;
  name?: string;
  botId: string;
  secret: string;
  defaultTo?: string;
  allowFrom?: string[];
};

export type WeComAiBotAccount = {
  accountId: string;
  enabled: boolean;
  name?: string;
  botId: string;
  secret: string;
  defaultTo?: string;
  allowFrom: string[];
};

export type WeComAiBotProbe = {
  accountId: string;
  botId: string;
};

export type WeComTarget =
  | { kind: "reply"; reqId: string }
  | { kind: "chat"; chatid: string };

