import fs from "fs";
import os from "os";
import path from "path";

/**
 * Resolve the Reframed API key, if there is one.
 * Priority: REFRAMED_API_KEY env var → ~/.config/reframed/key file → null.
 *
 * A missing key is a normal state, not an error. Without one the server uses
 * the free tier; with one it uses the account's quota.
 */
export function resolveApiKey(): string | null {
  const fromEnv = process.env.REFRAMED_API_KEY;
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv.trim();

  const keyFile = path.join(os.homedir(), ".config", "reframed", "key");
  try {
    if (fs.existsSync(keyFile)) {
      const key = fs.readFileSync(keyFile, "utf8").trim();
      if (key.length > 0) return key;
    }
  } catch {
    // Unreadable key file falls back to the free tier rather than failing.
  }

  return null;
}
