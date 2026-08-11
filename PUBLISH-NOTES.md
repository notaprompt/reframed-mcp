# reframed-mcp 1.1.0 — staged, not published

_2026-08-11._ Built, tested (19 passing), and the server side it depends on is
live. **Deliberately not published to npm.** One thing should be checked first.

## Why it's staged

`npm publish` is a one-way door — versions cannot be reused and unpublish is
restricted after 72 hours. The keyless free tier is verified working end to
end against production:

```
POST https://reframed.works/api/v1/tailor-anon   → HTTP 200
  returns result, provenance, tailorId, verify_url, tier: "free"
  receipt issued and publicly verifiable, Ed25519, key id rfm-2026-1
```

That call used exactly the body this client builds (`wrapRawResume` /
`wrapRawJd`), so the wire contract is confirmed, not assumed.

## Status: the blocker below was diagnosed and fixed

**Resolved 2026-08-11.** The cause was confirmed by reading the server, not
guessed. `wordOverlap()` in `src/lib/provenance.ts` is Sørensen-Dice
normalized by the **sum** of both token counts:

```
score = (2 * shared) / (len(tailored) + len(original))
```

A ~20-word tailored bullet against one ~600-word blob tops out near
`(2*20)/(20+600) ≈ 0.065`, against a paraphrase threshold of `0.55`. It was
arithmetically impossible for any MCP receipt to read anything but 100%
"added" — matching the live call exactly.

`splitResumeLines()` now breaks the input into bullet-sized units, and
`src/__tests__/resume-split.test.ts` pins the arithmetic: it asserts a
near-verbatim bullet scores **below** threshold against the old blob and
**above** it after splitting. 26 tests pass.

**Still unconfirmed end to end:** the fixed path was not re-run against
production — verification exhausted this IP's 3 free weekly tailors and the
gate correctly returned 429. Before publishing, make one keyless call from a
fresh IP and check `provenance.summary` shows non-zero `verbatimPct` or
`paraphrasedPct`. If it does, publish. The original diagnostic procedure is
kept below for reference.

## The thing to check first

That verified call came back with provenance of **0% verbatim, 0% reworded,
100% added** — on input that shares obvious phrasing with the output.

The likely cause is `wrapRawResume()` in `src/tailor.ts`, which flattens the
user's entire resume into a single bullet inside a single experience entry:

```ts
experience: [{ title: "", company: "", startDate: "", bullets: [text] }]
```

The provenance diff works over structured segments. Handing it one undivided
blob may leave it nothing to match against, so every line reads as "added."

If that is what is happening, then **every receipt issued through the MCP
would claim the applicant wrote none of their own resume** — on a product
whose entire pitch is honest provenance. That is worse than shipping nothing.

**One observation is not a diagnosis.** It could equally be that the tailor
genuinely rewrote synthetic test input end to end. Before publishing:

1. Run the same JD through `/api/v1/tailor-anon` twice — once with the
   flattened `wrapRawResume` shape, once with a properly structured
   `ResumeData` (real `title` / `company` / separate `bullets`).
2. Compare the two `provenance.summary` blocks.
3. If the structured one shows real verbatim percentages and the flattened one
   does not, fix `wrapRawResume` to split the input into bullets before
   publishing — a blank-line or bullet-marker split is probably enough.

## Publishing, once that's settled

```bash
cd ~/Desktop/repos/reframed-mcp
npm run build && npm test
npm publish --access public
```

Then confirm the install path a stranger actually takes:

```bash
npx -y reframed-mcp@latest   # must start with no REFRAMED_API_KEY set
```

## What shipped on the server already

`/api/v1/tailor-anon` is live in production. It reuses the existing anonymous
IP branch of `checkTailorAllowed`, so it shares the web free tier's Redis
counter rather than granting a second allowance, and the free-tier bandages
apply to it. Publishing the client is the only remaining step.
