import type { PluginRuntime } from "openclaw/plugin-sdk";

let runtime: PluginRuntime | undefined;

export function setWeComRuntime(next: PluginRuntime) {
  runtime = next;
}

export function getWeComRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("WeCom AI Bot runtime not initialized - plugin not registered");
  }
  return runtime;
}
