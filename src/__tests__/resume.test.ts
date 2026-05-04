import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import fs from "fs";
import os from "os";
import path from "path";
import { resolveResume } from "../resume.js";

const TMP_DIR = path.join(os.tmpdir(), "reframed-mcp-test");
const TMP_MD = path.join(TMP_DIR, "resume.md");
const TMP_PDF = path.join(TMP_DIR, "resume.pdf");

beforeAll(() => {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  fs.writeFileSync(TMP_MD, "# John Doe\nSoftware Engineer");
  fs.writeFileSync(TMP_PDF, "%PDF-1.4 stub");
});

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

describe("resolveResume", () => {
  it("reads file content when given a valid .md path", () => {
    const result = resolveResume(TMP_MD);
    expect(result).toContain("John Doe");
  });

  it("returns raw text as-is when input contains newlines", () => {
    const raw = "John Doe\nSoftware Engineer\n5 years experience";
    expect(resolveResume(raw)).toBe(raw);
  });

  it("returns raw text as-is when path does not exist on disk", () => {
    const fakePath = "/nonexistent/resume.md";
    expect(resolveResume(fakePath)).toBe(fakePath);
  });

  it("throws for .pdf input when the file exists", () => {
    expect(() => resolveResume(TMP_PDF)).toThrow(/PDF not supported/);
  });

  it("treats single-line non-path strings as raw text", () => {
    const oneliner = "Name: John Doe | SWE | 5yr";
    expect(resolveResume(oneliner)).toBe(oneliner);
  });
});
