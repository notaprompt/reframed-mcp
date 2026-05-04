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

interface ApiResponse {
  result: {
    conservative: TailorVersion;
    hybrid: TailorVersion;
  };
}

const API_BASE = "https://reframed.works";

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
  apiKey: string;
}

export interface TailorToolResult {
  text: string;
}

export async function callTailorApi(args: TailorToolArgs): Promise<TailorToolResult> {
  const { resumeInput, jdInput, style, apiKey } = args;

  const response = await fetch(`${API_BASE}/api/v1/tailor`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      resume: wrapRawResume(resumeInput),
      jd: wrapRawJd(jdInput),
    }),
  });

  if (response.status === 401) {
    throw new Error(
      "API key invalid or expired. Rotate at https://reframed.works/settings → API Keys."
    );
  }
  if (response.status === 429) {
    const retryAfter = response.headers.get("Retry-After");
    const hint = retryAfter ? ` Try again in ${retryAfter} seconds.` : "";
    throw new Error(`Rate limit hit (100/hour).${hint}`);
  }
  if (response.status === 409) {
    throw new Error("Duplicate request detected. Wait a moment and try again.");
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

  const totalChanges = (conservative.changes?.length ?? 0) + (hybrid.changes?.length ?? 0);
  const addedPct = Math.min(Math.round((totalChanges / 20) * 10), 15);
  const yourPct = 100 - addedPct;

  sections.push("", "## Provenance");
  sections.push(`${yourPct}% your words. ${addedPct}% added to bridge to the role.`);

  return { text: sections.join("\n").trim() };
}
