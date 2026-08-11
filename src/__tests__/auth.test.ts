import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import fs from "fs";
import os from "os";
import path from "path";

describe("resolveApiKey", () => {
  const keyFilePath = path.join(os.homedir(), ".config", "reframed", "key");
  const keyFileDir = path.dirname(keyFilePath);
  let originalEnv: string | undefined;
  // These tests read and delete the real key file location, so any key the
  // developer actually has is stashed and put back afterwards.
  let stashedKeyFile: string | null = null;

  beforeEach(() => {
    originalEnv = process.env.REFRAMED_API_KEY;
    delete process.env.REFRAMED_API_KEY;
    stashedKeyFile = fs.existsSync(keyFilePath) ? fs.readFileSync(keyFilePath, "utf8") : null;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.REFRAMED_API_KEY = originalEnv;
    } else {
      delete process.env.REFRAMED_API_KEY;
    }
    if (stashedKeyFile !== null) {
      if (!fs.existsSync(keyFileDir)) fs.mkdirSync(keyFileDir, { recursive: true });
      fs.writeFileSync(keyFilePath, stashedKeyFile);
    } else if (fs.existsSync(keyFilePath)) {
      fs.unlinkSync(keyFilePath);
    }
  });

  it("returns the env var when REFRAMED_API_KEY is set", async () => {
    process.env.REFRAMED_API_KEY = "rt_live_test_env";
    const { resolveApiKey } = await import("../auth.js");
    expect(resolveApiKey()).toBe("rt_live_test_env");
  });

  it("trims whitespace from env var", async () => {
    process.env.REFRAMED_API_KEY = "  rt_live_trimmed  ";
    const { resolveApiKey } = await import("../auth.js");
    expect(resolveApiKey()).toBe("rt_live_trimmed");
  });

  it("reads from ~/.config/reframed/key when env var is absent", async () => {
    if (!fs.existsSync(keyFileDir)) fs.mkdirSync(keyFileDir, { recursive: true });
    fs.writeFileSync(keyFilePath, "rt_live_from_file\n");
    const { resolveApiKey } = await import("../auth.js");
    expect(resolveApiKey()).toBe("rt_live_from_file");
  });

  it("returns null when neither env var nor key file exists — free tier, not an error", async () => {
    if (fs.existsSync(keyFilePath)) fs.unlinkSync(keyFilePath);
    const { resolveApiKey } = await import("../auth.js");
    expect(resolveApiKey()).toBeNull();
  });

  it("returns null when the env var is set but blank and no key file exists", async () => {
    process.env.REFRAMED_API_KEY = "   ";
    if (fs.existsSync(keyFilePath)) fs.unlinkSync(keyFilePath);
    const { resolveApiKey } = await import("../auth.js");
    expect(resolveApiKey()).toBeNull();
  });
});
