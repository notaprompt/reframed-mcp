import fs from "fs";
import path from "path";

/**
 * Resolve resume input to raw text.
 * - Single-line string that exists on disk → read the file (.pdf → error)
 * - Multi-line string or non-existent path → return as-is (raw text)
 */
export function resolveResume(input: string): string {
  const looksLikePath = !input.includes("\n");

  if (looksLikePath && fs.existsSync(input)) {
    const ext = path.extname(input).toLowerCase();
    if (ext === ".pdf") {
      throw new Error(
        "PDF not supported in V1. Convert to .md or paste raw resume text."
      );
    }
    return fs.readFileSync(input, "utf8");
  }

  return input;
}
