# reframed-mcp

MCP server for [Reframed](https://reframed.works). Tailor a resume to a job from any MCP-compatible agent harness.

One tool: `reframed_tailor`. Accepts your resume (file path or raw text) and a job description. Returns two voice-preserving versions and a provenance summary.

---

## Get an API key

1. Sign in at [reframed.works](https://reframed.works)
2. Go to Settings → API Keys → Create key
3. Copy your key (`rt_live_...`)

---

## Install

### Claude Code

```bash
claude mcp add reframed -- npx -y reframed-mcp
export REFRAMED_API_KEY=rt_live_...
```

Or store the key permanently:

```bash
mkdir -p ~/.config/reframed
echo "rt_live_..." > ~/.config/reframed/key
```

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "reframed": {
      "command": "npx",
      "args": ["-y", "reframed-mcp"],
      "env": {
        "REFRAMED_API_KEY": "rt_live_..."
      }
    }
  }
}
```

Restart Claude Desktop.

### Cursor

In Cursor settings → Features → MCP:

```json
{
  "reframed": {
    "command": "npx",
    "args": ["-y", "reframed-mcp"],
    "env": { "REFRAMED_API_KEY": "rt_live_..." }
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
      "args": ["-y", "reframed-mcp"],
      "env": { "REFRAMED_API_KEY": "rt_live_..." }
    }
  ]
}
```

---

## Usage

Once installed, ask your assistant:

> Tailor my resume at ~/resume.md to this job: [paste JD text]

### Style options

| `style` | What you get |
|---|---|
| `conservative` | Light edits — your words, ATS-optimized |
| `reframed` | Voice-preserving rewrite — stronger framing |
| `both` (default) | Both versions + provenance summary |

---

## Limits

- 100 calls/hour per API key
- `.pdf` resume input not supported in V1 — convert to `.md` or paste raw text
- JD input: paste raw text (URL scraping coming in V2)

---

## License

MIT — see [LICENSE](./LICENSE).  
See [NOTICE.md](./NOTICE.md) for credits.
