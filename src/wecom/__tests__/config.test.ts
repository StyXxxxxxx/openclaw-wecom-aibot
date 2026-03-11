import { describe, expect, test } from "vitest";
import { resolveWeComAccount } from "../config.js";

describe("resolveWeComAccount", () => {
  test("resolves default from top-level", () => {
    const cfg: any = {
      channels: {
        "wecom-aibot": {
          botId: "b1",
          secret: "s1",
          allowFrom: ["*"],
        },
      },
    };

    const a = resolveWeComAccount(cfg, "default");
    expect(a.botId).toBe("b1");
    expect(a.secret).toBe("s1");
    expect(a.allowFrom).toEqual(["*"]);
  });

  test("resolves named account", () => {
    const cfg: any = {
      channels: {
        "wecom-aibot": {
          accounts: {
            bot2: { botId: "b2", secret: "s2", allowFrom: ["u1"] },
          },
        },
      },
    };

    const a = resolveWeComAccount(cfg, "bot2");
    expect(a.botId).toBe("b2");
    expect(a.allowFrom).toEqual(["u1"]);
  });
});

