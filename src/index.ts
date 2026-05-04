#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { resolveApiKey } from "./auth.js";
import { resolveResume } from "./resume.js";
import { callTailorApi } from "./tailor.js";

const server = new McpServer({
  name: "reframed",
  version: "1.0.0",
});

// Resolve key at startup. If missing, every tool call returns the setup error
// rather than crashing — harnesses can still discover the tool.
let apiKey: string | null = null;
let keyError: string | null = null;
try {
  apiKey = resolveApiKey();
} catch (e) {
  keyError = e instanceof Error ? e.message : String(e);
}

server.tool(
  "reframed_tailor",
  "Tailor a resume to a specific job. Preserves your voice. Returns two versions and a provenance summary.",
  {
    resume: z
      .string()
      .describe("File path to a .md resume, or paste raw resume text. PDF not supported."),
    jd: z
      .string()
      .describe("Raw job description text (paste from the posting)."),
    style: z
      .enum(["conservative", "reframed", "both"])
      .optional()
      .default("both")
      .describe(
        "Which version to return. 'conservative' = light edits. 'reframed' = voice-preserving rewrite. 'both' = both (default)."
      ),
  },
  async ({ resume, jd, style }) => {
    if (!apiKey) {
      return {
        content: [
          {
            type: "text" as const,
            text: keyError ?? "No API key found. Set REFRAMED_API_KEY or write it to ~/.config/reframed/key.",
          },
        ],
        isError: true,
      };
    }

    let resumeText: string;
    try {
      resumeText = resolveResume(resume);
    } catch (e) {
      return {
        content: [{ type: "text" as const, text: e instanceof Error ? e.message : "Failed to read resume." }],
        isError: true,
      };
    }

    try {
      const result = await callTailorApi({
        resumeInput: resumeText,
        jdInput: jd,
        style: style ?? "both",
        apiKey,
      });
      return { content: [{ type: "text" as const, text: result.text }] };
    } catch (e) {
      return {
        content: [{ type: "text" as const, text: e instanceof Error ? e.message : "Tailoring failed." }],
        isError: true,
      };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
