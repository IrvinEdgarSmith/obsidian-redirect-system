# Obsidian Redirect Server

Docker stack that converts HTTPS links into `obsidian://` protocol handler calls. Share Obsidian notes via stable HTTPS links that work anywhere — Notion, Slack, email, bookmarks. Clicking a link opens the note directly in Obsidian without leaving an orphaned browser tab.

**Companion plugin:** [obsidian-redirect-link](https://github.com/IrvinEdgarSmith/obsidian-redirect-link) — generates the redirect links from inside Obsidian.

## How It Works

```
User clicks HTTPS link
    |
    v
Cloudflare Tunnel (HTTPS termination, DDoS protection)
    |
    v
nginx serves redirect page
    |
    v
Browser fires obsidian://redirect-link URI via hidden anchor click
    |
    v
Plugin resolves UID → opens the note (rename-proof)
```

The link format is a **stable contract** — the URL never changes even if the note is renamed or moved:

```
https://{subdomain}.{domain}/v1/open?vault={vault}&uid={uid}&file={url-encoded-path}
```

## Architecture

**Why HTTPS links instead of `obsidian://` directly?**
Native `obsidian://` links don't render as clickable hyperlinks in most apps (Notion, Slack, email). HTTPS links work everywhere. The redirect server converts them at click time.

**Why the hidden anchor technique?**
`window.location.href = "obsidian://..."` navigates the browser tab, leaving a dead page. The hidden anchor `.click()` fires the protocol handler without navigating, so the user's browser stays clean.

**Why UIDs?**
File paths break when notes are renamed. Each note gets a permanent 8-character UID stored in frontmatter. The plugin resolves UIDs via MetadataCache — no external dependencies.

**Why `/v1/` in the URL path?**
Version namespace. If the API contract ever needs breaking changes, `/v2/` handles them. `/v1/` keeps working forever.

**Why self-contained?**
The plugin registers its own custom URI handler (`obsidian://redirect-link`). No dependency on Advanced URI or any other plugin. The redirect page always builds `obsidian://redirect-link?vault=...&uid=...&file=...`.

## Deploy the Server

See [`obsidian-redirect/README.md`](obsidian-redirect/README.md) for full deployment instructions.

Quick start:
```bash
git clone https://github.com/IrvinEdgarSmith/obsidian-redirect-system.git
cd obsidian-redirect-system/obsidian-redirect/
cp .env.example .env
# Edit .env — add your Cloudflare Tunnel token
docker compose build
docker compose up -d
```

## Install the Plugin

See **[obsidian-redirect-link](https://github.com/IrvinEdgarSmith/obsidian-redirect-link)** for install instructions (BRAT or manual download).

## Use It

Right-click any file in Obsidian → **Copy Redirect Link** → paste the HTTPS URL anywhere.

## Maintaining the System

### Updating the server
```bash
cd obsidian-redirect-system/obsidian-redirect/
git pull origin master
docker compose build
docker compose up -d
```

### Updating the plugin
BRAT handles this automatically. For manual installs, download the latest `main.js` and `manifest.json` from the [plugin releases](https://github.com/IrvinEdgarSmith/obsidian-redirect-link/releases/latest).

### Monitoring
```bash
docker compose ps          # both containers should be running (healthy)
docker compose logs -f     # live logs
curl https://your-domain/health  # should return "ok"
```

---

<!-- AI-CONTEXT: This repo contains the server half of the Obsidian redirect system — a
Docker stack (nginx:1.27-alpine + cloudflare/cloudflared:2024.12.2) that converts HTTPS
URLs into obsidian://redirect-link protocol handler calls. The canonical link format is
https://{base}/v1/open?vault={vault}&uid={uid}&file={file}. The HTML is fully static —
no server-side injection or templating. It always builds obsidian://redirect-link URIs
with vault, uid, and file params. The companion Obsidian plugin (separate repo:
github.com/IrvinEdgarSmith/obsidian-redirect-link) registers the redirect-link protocol
handler and resolves UIDs to notes via MetadataCache. Key files: html/index.html (redirect
logic), nginx.conf (security headers + /health endpoint), docker-compose.yml (nginx +
cloudflared with HTTP/2 protocol), docker-entrypoint.sh (just runs nginx). -->
