# reframed-mcp

Tailor a resume to a job posting, from inside whatever agent you already use.

No account. No API key. Install it and ask.

---

## Start

### Claude Code

```bash
claude mcp add reframed -- npx -y reframed-mcp
```

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "reframed": {
      "command": "npx",
      "args": ["-y", "reframed-mcp"]
    }
  }
}
```

Restart Claude Desktop.

### Cursor

Settings → Features → MCP:

```json
{
  "reframed": {
    "command": "npx",
    "args": ["-y", "reframed-mcp"]
  }
}
```

### Continue.dev

In `~/.continue/config.json`:

```json
{
  "mcpServers": [
    {
      "name": "reframed",
      "command": "npx",
      "args": ["-y", "reframed-mcp"]
    }
  ]
}
```

---

## Ask

> Tailor my resume at ~/resume.md to this job: *[paste the posting]*

That's the whole thing.

---

## What comes back

Two versions of the resume and a provenance summary — how much of the result is
still your own words.

| `style` | What you get |
|---|---|
| `conservative` | Light edits — your words, shaped for the ATS |
| `reframed` | Voice-preserving rewrite — stronger framing |
| `both` (default) | Both versions + provenance summary |

The provenance summary is backed by a signed receipt at
`reframed.works/verify/<id>` — the percentages are checkable, not just asserted.

---

## The free tier

Three tailors a week. No sign-up, nothing to configure.

Counted per network address, on the same weekly window the site uses.

When they're gone, the tool says so and points at
[reframed.works/pricing](https://reframed.works/pricing).

Other limits:

- `.pdf` resume input isn't supported — convert to `.md` or paste raw text
- Job description goes in as raw text (URL scraping comes later)

---

## For more than the free tier

An API key raises the ceiling to your plan's quota and runs the tailor against
your saved voice profile.

1. Sign in at [reframed.works](https://reframed.works)
2. Settings → API Keys → Create key
3. Copy the key (`rt_live_...`)

Then either export it:

```bash
export REFRAMED_API_KEY=rt_live_...
```

Or write it once and forget it:

```bash
mkdir -p ~/.config/reframed
echo "rt_live_..." > ~/.config/reframed/key
```

With a key present, calls run against the account. Without one, they run on the
free tier. Nothing else changes.

Plans and quotas: [reframed.works/pricing](https://reframed.works/pricing).

---

## Pointing somewhere else

`REFRAMED_API_BASE` overrides the host — useful against a preview deployment or
a local server. Defaults to `https://reframed.works`.

---

## License

MIT — see [LICENSE](./LICENSE).  
See [NOTICE.md](./NOTICE.md) for credits.
