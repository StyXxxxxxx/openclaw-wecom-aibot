import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { wecomAiBotChannelPlugin } from "./wecom/channel.js";
import { setWeComRuntime } from "./wecom/runtime.js";

const plugin = {
  id: "wecom-aibot",
  name: "WeCom AI Bot",
  description: "WeCom AI Bot channel plugin (WebSocket long connection)",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setWeComRuntime(api.runtime);
    api.registerChannel(wecomAiBotChannelPlugin as any);
  },
};

export default plugin;
