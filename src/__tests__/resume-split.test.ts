import { describe, it, expect } from "@jest/globals";
import { splitResumeLines } from "../tailor.js";

/**
 * The server classifies each tailored bullet by Sørensen-Dice overlap against
 * the original bullets, normalized by the SUM of both token counts. Handing it
 * one giant bullet makes a verbatim/paraphrased verdict unreachable no matter
 * how much text is shared, so every receipt reads 100% "added".
 *
 * These tests pin the arithmetic, not just the splitting.
 */

/** Mirrors wordOverlap() in the server's src/lib/provenance.ts. */
function dice(a: string, b: string): number {
  const tok = (s: string) => s.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const wa = tok(a);
  const wb = tok(b);
  if (wa.length === 0 || wb.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const w of wa) counts.set(w, (counts.get(w) ?? 0) + 1);
  let common = 0;
  const cb = new Map<string, number>();
  for (const w of wb) cb.set(w, (cb.get(w) ?? 0) + 1);
  for (const [w, n] of cb) common += Math.min(counts.get(w) ?? 0, n);
  return (2 * common) / (wa.length + wb.length);
}

const PARAPHRASE_THRESHOLD = 0.55;

const RESUME = `Alex Rivera
Senior Backend Engineer

EXPERIENCE
Staff Engineer, Acme Payments (2021-2026)
- Built a payment ledger in Go handling 40,000 transactions per second across three regions
- Led the migration from a Rails monolith to twelve Go services, cutting p99 latency from 800ms to 90ms
- Ran the on-call rotation for six engineers and cut paging volume 60% by fixing retry storms

SKILLS
Go, PostgreSQL, Kafka, Kubernetes, AWS`;

describe("splitResumeLines", () => {
  it("splits into bullet-sized lines rather than one blob", () => {
    const lines = splitResumeLines(RESUME);
    expect(lines.length).toBeGreaterThan(2);
    expect(lines.every((l) => l.length < 200)).toBe(true);
  });

  it("strips bullet markers", () => {
    const lines = splitResumeLines(RESUME);
    expect(lines.some((l) => l.startsWith("-") || l.startsWith("•"))).toBe(false);
    expect(lines.some((l) => l.startsWith("Built a payment ledger"))).toBe(true);
  });

  it("drops section headers and other short noise", () => {
    const lines = splitResumeLines(RESUME);
    expect(lines).not.toContain("EXPERIENCE");
    expect(lines).not.toContain("SKILLS");
  });

  it("a near-verbatim bullet clears the threshold after splitting, and cannot before it", () => {
    const tailored = "Built a payment ledger in Go handling 40,000 transactions per second across three regions";

    // Before: one blob. Arithmetically unreachable.
    expect(dice(tailored, RESUME)).toBeLessThan(PARAPHRASE_THRESHOLD);

    // After: compared against same-scale units, it matches.
    const best = Math.max(...splitResumeLines(RESUME).map((l) => dice(tailored, l)));
    expect(best).toBeGreaterThan(PARAPHRASE_THRESHOLD);
  });

  it("breaks a long run-on paragraph down by sentence", () => {
    // Over the 300-char long-line threshold, so newline splitting alone would
    // leave it blob-shaped — the exact failure this function exists to prevent.
    const para = [
      "Built a payment ledger in Go handling forty thousand transactions per second across three separate regions.",
      "Led the migration from a Rails monolith to twelve Go services and cut p99 latency from eight hundred to ninety milliseconds.",
      "Ran the on-call rotation for six engineers and cut paging volume by sixty percent by fixing retry storms.",
    ].join(" ");
    expect(para.length).toBeGreaterThan(300);

    const lines = splitResumeLines(para);
    expect(lines.length).toBe(3);
    expect(lines.every((l) => l.length < 300)).toBe(true);
  });

  it("leaves a short paragraph alone rather than over-splitting it", () => {
    const short = "Built a payment ledger in Go handling high volume.";
    expect(splitResumeLines(short)).toEqual([short]);
  });

  it("never returns an empty list for non-empty input", () => {
    expect(splitResumeLines("short").length).toBe(1);
    expect(splitResumeLines("")).toEqual([]);
  });
});
