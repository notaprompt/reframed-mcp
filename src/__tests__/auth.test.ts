import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import fs from "fs";
import os from "os";
import path from "path";

describe("resolveApiKey", () => {
  const keyFilePath = path.join(os.homedir(), ".config", "reframed", "key");
  const keyFileDir = path.dirname(keyFilePath);
  let originalEnv: string | undefined;
  let wroteKeyFile = false;

  beforeEach(() => {
    originalEnv = process.env.REFRAMED_API_KEY;
    delete process.env.REFRAMED_API_KEY;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.REFRAMED_API_KEY = originalEnv;
    } else {
      delete process.env.REFRAMED_API_KEY;
    }
    if (wroteKeyFile && fs.existsSync(keyFilePath)) {
      fs.unlinkSync(keyFilePath);
      wroteKeyFile = false;
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
    wroteKeyFile = true;
    const { resolveApiKey } = await import("../auth.js");
    expect(resolveApiKey()).toBe("rt_live_from_file");
  });

  it("throws a descriptive error when neither env var nor key file exists", async () => {
    if (fs.existsSync(keyFilePath)) fs.unlinkSync(keyFilePath);
    const { resolveApiKey } = await import("../auth.js");
    expect(() => resolveApiKey()).toThrow(/No Reframed API key found/);
    expect(() => resolveApiKey()).toThrow(/reframed\.works\/settings/);
  });
});
