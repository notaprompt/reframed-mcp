import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { callTailorApi } from "../tailor.js";

interface FakeResponseInit {
  status?: number;
  body?: unknown;
  bodyIsJson?: boolean;
  headers?: Record<string, string>;
}

function fakeResponse({ status = 200, body = {}, bodyIsJson = true, headers = {} }: FakeResponseInit) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    json: async () => {
      if (!bodyIsJson) throw new Error("not json");
      return body;
    },
  } as unknown as Response;
}

const OK_BODY = {
  result: {
    conservative: {
      label: "Conservative",
      resume: {
        contact: { name: "Pat Lee", email: "pat@example.com" },
        experience: [
          { title: "Operations Lead", company: "Northwind", startDate: "2021", bullets: ["Ran the thing."] },
        ],
        education: [],
        skills: ["Logistics"],
      },
      changes: ["Tightened the opening bullet."],
    },
    hybrid: {
      label: "Reframed",
      resume: {
        contact: { name: "Pat Lee", email: "pat@example.com" },
        experience: [
          { title: "Operations Lead", company: "Northwind", startDate: "2021", bullets: ["Ran the thing, on time."] },
        ],
        education: [],
        skills: ["Logistics"],
      },
      changes: ["Reframed toward the posting."],
    },
  },
  provenance: {
    summary: { verbatimPct: 70, paraphrasedPct: 20, addedPct: 10 },
    segments: [],
  },
  tailorId: "abc123",
  verify_url: "https://reframed.works/verify/abc123",
  tier: "free",
};

type FetchArgs = [string, { headers: Record<string, string>; body: string; method: string }];

describe("callTailorApi", () => {
  let calls: FetchArgs[];
  const originalFetch = globalThis.fetch;

  function stubFetch(response: Response) {
    calls = [];
    globalThis.fetch = jest.fn(async (url: unknown, init: unknown) => {
      calls.push([String(url), init as FetchArgs[1]]);
      return response;
    }) as unknown as typeof fetch;
  }

  beforeEach(() => {
    calls = [];
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("keyless (free tier)", () => {
    it("calls the anonymous endpoint and sends no Authorization header", async () => {
      stubFetch(fakeResponse({ body: OK_BODY }));

      const result = await callTailorApi({
        resumeInput: "Pat Lee — operations.",
        jdInput: "Operations Lead at Northwind.",
        style: "both",
      });

      expect(calls).toHaveLength(1);
      const [url, init] = calls[0];
      expect(url).toBe("https://reframed.works/api/v1/tailor-anon");
      expect(init.headers.Authorization).toBeUndefined();
      expect(init.headers["Content-Type"]).toBe("application/json");
      expect(result.text).toContain("## Conservative version");
      expect(result.text).toContain("## Reframed version");
      expect(result.text).toContain("70% your words.");
    });

    it("treats an explicit null key the same as no key", async () => {
      stubFetch(fakeResponse({ body: OK_BODY }));

      await callTailorApi({
        resumeInput: "Pat Lee — operations.",
        jdInput: "Operations Lead at Northwind.",
        style: "conservative",
        apiKey: null,
      });

      expect(calls[0][0]).toBe("https://reframed.works/api/v1/tailor-anon");
      expect(calls[0][1].headers.Authorization).toBeUndefined();
    });

    it("surfaces the server's limit message on 429", async () => {
      stubFetch(
        fakeResponse({
          status: 429,
          body: { error: "3 free tailors a week — all used. Resets in 40h. More at https://reframed.works/pricing" },
        }),
      );

      await expect(
        callTailorApi({ resumeInput: "resume", jdInput: "jd", style: "both" }),
      ).rejects.toThrow("3 free tailors a week — all used. Resets in 40h. More at https://reframed.works/pricing");
    });

    it("falls back to a plain limit message when the 429 body isn't readable", async () => {
      stubFetch(fakeResponse({ status: 429, bodyIsJson: false }));

      await expect(
        callTailorApi({ resumeInput: "resume", jdInput: "jd", style: "both" }),
      ).rejects.toThrow("https://reframed.works/pricing");
    });

    it("surfaces the server message when free tailoring is paused", async () => {
      stubFetch(
        fakeResponse({ status: 503, body: { error: "Free tailoring runs weekday business hours for now." } }),
      );

      await expect(
        callTailorApi({ resumeInput: "resume", jdInput: "jd", style: "both" }),
      ).rejects.toThrow("Free tailoring runs weekday business hours for now.");
    });
  });

  describe("with an API key", () => {
    it("calls the keyed endpoint with a Bearer token", async () => {
      stubFetch(fakeResponse({ body: OK_BODY }));

      await callTailorApi({
        resumeInput: "Pat Lee — operations.",
        jdInput: "Operations Lead at Northwind.",
        style: "both",
        apiKey: "rt_live_abc",
      });

      expect(calls[0][0]).toBe("https://reframed.works/api/v1/tailor");
      expect(calls[0][1].headers.Authorization).toBe("Bearer rt_live_abc");
    });

    it("explains a rejected key and points at the keyless option", async () => {
      stubFetch(fakeResponse({ status: 401, body: { error: "Invalid or expired API key" } }));

      await expect(
        callTailorApi({ resumeInput: "resume", jdInput: "jd", style: "both", apiKey: "rt_live_stale" }),
      ).rejects.toThrow(/REFRAMED_API_KEY/);
    });
  });

  it("honors REFRAMED_API_BASE for preview deployments", async () => {
    const original = process.env.REFRAMED_API_BASE;
    process.env.REFRAMED_API_BASE = "http://localhost:3000/";
    try {
      stubFetch(fakeResponse({ body: OK_BODY }));
      await callTailorApi({ resumeInput: "resume", jdInput: "jd", style: "both" });
      expect(calls[0][0]).toBe("http://localhost:3000/api/v1/tailor-anon");
    } finally {
      if (original === undefined) delete process.env.REFRAMED_API_BASE;
      else process.env.REFRAMED_API_BASE = original;
    }
  });

  it("reports a missing provenance receipt instead of inventing one", async () => {
    stubFetch(fakeResponse({ body: { ...OK_BODY, provenance: null, tailorId: null, verify_url: null } }));

    const result = await callTailorApi({ resumeInput: "resume", jdInput: "jd", style: "both" });
    expect(result.text).toContain("Provenance not available");
  });
});
