// Minimal subset of types matching the V1 API contract.
// Full types live in reframed/src/lib/types.ts.

interface ResumeData {
  contact: { name: string; email: string };
  experience: Array<{
    title: string;
    company: string;
    startDate: string;
    endDate?: string;
    bullets: string[];
  }>;
  education: never[];
  skills: string[];
  projects?: never[];
}

interface JobDescription {
  title: string;
  company: string;
  description: string;
  requirements: string[];
  keywords: string[];
  rawText: string;
}

interface TailorVersion {
  label: string;
  resume: ResumeData;
  changes: string[];
  recruiterPerception?: string;
}

interface ProvenanceSummary {
  verbatimPct: number;
  paraphrasedPct: number;
  addedPct: number;
}

interface ProvenanceReport {
  summary: ProvenanceSummary;
  segments: Array<{ text: string; type: "verbatim" | "paraphrased" | "added" }>;
  headline?: string;
}

interface ApiResponse {
  result: {
    conservative: TailorVersion;
    hybrid: TailorVersion;
  };
  // V2.1: real provenance from /api/v1/tailor — replaces the local
  // change-count heuristic that used to fabricate the percentages.
  provenance?: ProvenanceReport | null;
  tailorId?: string | null;
  verify_url?: string | null;
  tier?: string;
}

const DEFAULT_API_BASE = "https://reframed.works";

/** Points at production unless REFRAMED_API_BASE overrides it (preview deploys, local dev). */
function apiBase(): string {
  const override = process.env.REFRAMED_API_BASE?.trim();
  return override && override.length > 0 ? override.replace(/\/+$/, "") : DEFAULT_API_BASE;
}

function wrapRawResume(text: string): ResumeData {
  return {
    contact: { name: "", email: "" },
    experience: [{ title: "", company: "", startDate: "", bullets: [text] }],
    education: [],
    skills: [],
  };
}

function wrapRawJd(text: string): JobDescription {
  return {
    title: "",
    company: "",
    description: text,
    requirements: [],
    keywords: [],
    rawText: text,
  };
}

function resumeToMarkdown(resume: ResumeData): string {
  const lines: string[] = [];

  if (resume.contact?.name) lines.push(`# ${resume.contact.name}`, "");
  if (resume.contact?.email) lines.push(resume.contact.email, "");

  for (const exp of resume.experience ?? []) {
    if (exp.title || exp.company) {
      lines.push(`**${[exp.title, exp.company].filter(Boolean).join(" — ")}**`);
    }
    for (const bullet of exp.bullets ?? []) {
      lines.push(`- ${bullet}`);
    }
    lines.push("");
  }

  if (resume.skills?.length) {
    lines.push("**Skills**");
    lines.push(resume.skills.join(", "), "");
  }

  return lines.join("\n").trim();
}

export interface TailorToolArgs {
  resumeInput: string;
  jdInput: string;
  style: "conservative" | "reframed" | "both";
  /** Omit or pass null to use the free tier. */
  apiKey?: string | null;
}

export interface TailorToolResult {
  text: string;
}

/** Best-effort read of the `error` field from a JSON error body. */
async function readErrorMessage(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body?.error === "string" && body.error.trim().length > 0
      ? body.error.trim()
      : null;
  } catch {
    return null;
  }
}

export async function callTailorApi(args: TailorToolArgs): Promise<TailorToolResult> {
  const { resumeInput, jdInput, style } = args;
  const apiKey = args.apiKey ?? null;

  // No key → free tier. Key → the account's quota on the keyed route.
  const endpoint = apiKey ? "/api/v1/tailor" : "/api/v1/tailor-anon";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const response = await fetch(`${apiBase()}${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      resume: wrapRawResume(resumeInput),
      jd: wrapRawJd(jdInput),
    }),
  });

  if (response.status === 401) {
    throw new Error(
      "API key invalid or expired. Rotate at https://reframed.works/settings → API Keys, or unset REFRAMED_API_KEY to use the free tier."
    );
  }
  if (response.status === 429) {
    const serverMessage = await readErrorMessage(response);
    if (!apiKey) {
      throw new Error(
        serverMessage ??
          "Free tailors for this week are used up — more at https://reframed.works/pricing"
      );
    }
    const retryAfter = response.headers.get("Retry-After");
    const hint = retryAfter ? ` Try again in ${retryAfter} seconds.` : "";
    throw new Error(serverMessage ?? `Rate limit hit (100/hour).${hint}`);
  }
  if (response.status === 409) {
    throw new Error("Duplicate request detected. Wait a moment and try again.");
  }
  if (response.status === 503 || response.status === 451) {
    const serverMessage = await readErrorMessage(response);
    throw new Error(
      serverMessage ?? "Free tailoring is paused right now. See https://reframed.works/pricing"
    );
  }
  if (!response.ok) {
    throw new Error(
      `Engine error (HTTP ${response.status}). Try again or report at https://github.com/notaprompt/reframed-mcp/issues.`
    );
  }

  const data = (await response.json()) as ApiResponse;
  const { conservative, hybrid } = data.result;

  const sections: string[] = [];

  if (style === "conservative" || style === "both") {
    sections.push("## Conservative version");
    sections.push(resumeToMarkdown(conservative.resume));
    if (conservative.changes?.length) {
      sections.push("", "### Changes");
      for (const c of conservative.changes) sections.push(`- ${c}`);
    }
  }

  if (style === "reframed" || style === "both") {
    sections.push("", "## Reframed version");
    sections.push(resumeToMarkdown(hybrid.resume));
    if (hybrid.changes?.length) {
      sections.push("", "### Changes");
      for (const c of hybrid.changes) sections.push(`- ${c}`);
    }
  }

  // Provenance — use real signed receipt from the API, not local heuristic.
  // The /api/v1/tailor endpoint computes deterministic provenance and signs
  // an Honesty Receipt. If for any reason the API didn't return one (older
  // server, transient signing failure), fall back gracefully but mark it.
  sections.push("", "## Provenance");
  if (data.provenance?.summary) {
    const { verbatimPct, paraphrasedPct, addedPct } = data.provenance.summary;
    sections.push(`${verbatimPct}% your words. ${paraphrasedPct}% reworded. ${addedPct}% added to bridge to the role.`);
    if (data.tailorId && data.verify_url) {
      sections.push("", `Honesty Receipt signed: ${data.verify_url}`);
      sections.push(`Receipt ID: ${data.tailorId}`);
    }
  } else {
    sections.push("Provenance not available for this response (server didn't sign a receipt).");
  }

  return { text: sections.join("\n").trim() };
}
