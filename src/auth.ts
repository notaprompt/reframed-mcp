import fs from "fs";
import os from "os";
import path from "path";

/**
 * Resolve the Reframed API key.
 * Priority: REFRAMED_API_KEY env var → ~/.config/reframed/key file → error
 */
export function resolveApiKey(): string {
  const fromEnv = process.env.REFRAMED_API_KEY;
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv.trim();

  const keyFile = path.join(os.homedir(), ".config", "reframed", "key");
  if (fs.existsSync(keyFile)) {
    const key = fs.readFileSync(keyFile, "utf8").trim();
    if (key.length > 0) return key;
  }

  throw new Error(
    "No Reframed API key found.\n" +
      "Get one at https://reframed.works/settings → API Keys, then either:\n" +
      "  export REFRAMED_API_KEY=rt_live_...\n" +
      "or write it to ~/.config/reframed/key"
  );
}
