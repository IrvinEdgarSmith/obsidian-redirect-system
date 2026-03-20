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
Browser fires obsidian:// URI via hidden anchor click
    |
    v
Obsidian opens the note
```

The link format is a **stable contract** — the URL never changes even if the backend, server, or URI scheme changes:

```
https://{subdomain}.{domain}/v1/open?vault={vault}&file={url-encoded-path}
```

## Architecture Decisions

**Why not just use `obsidian://` links directly?**
Native `obsidian://` links don't render as clickable hyperlinks in most apps (Notion, Slack, email). HTTPS links work everywhere. The redirect server converts them at click time.

**Why the adapter pattern?**
`config/adapter.json` decouples the URI scheme from the link format. Switching from standard Obsidian URIs to Advanced URI (or any future handler) is a config change + container restart — zero link breakage.

**Why the hidden anchor technique?**
`window.location.href = "obsidian://..."` navigates the browser tab, leaving a dead page. The hidden anchor `.click()` fires the protocol handler without navigating, so the user's browser stays clean.

**Why `/v1/` in the URL path?**
Version namespace. If the API contract ever needs breaking changes, `/v2/` handles them. `/v1/` keeps working forever.

## Deploy the Server

```bash
git clone https://github.com/IrvinEdgarSmith/obsidian-redirect-system.git
cd obsidian-redirect-system/obsidian-redirect/
cp .env.example .env
# Edit .env — add your Cloudflare Tunnel token
docker compose build
docker compose up -d
```

Verify: `docker compose ps` — both `obsidian-redirect` and `obsidian-cloudflared` should be running (healthy).

## Install the Plugin

See **[obsidian-redirect-link](https://github.com/IrvinEdgarSmith/obsidian-redirect-link)** for install instructions (BRAT or manual download).

## Use It

Right-click any file in Obsidian → **Copy Redirect Link** → paste the HTTPS URL anywhere.

---

<!-- AI-CONTEXT: This repo contains the server half of the Obsidian redirect system — a
Docker stack (nginx:1.27-alpine + cloudflare/cloudflared:2024.12.2) that converts HTTPS
URLs into obsidian:// protocol handler calls. The canonical link format is
https://{base}/v1/open?vault={vault}&file={file}. The adapter pattern in
config/adapter.json maps handler names to URI schemes. The HTML redirect page uses a
hidden <a> element .click() to fire obsidian:// URIs without orphaning browser tabs.
Key files: docker-entrypoint.sh (config validation + scheme injection),
html/index.html (redirect logic), nginx.conf (security headers + health endpoint).
The companion Obsidian plugin lives in a separate repo:
github.com/IrvinEdgarSmith/obsidian-redirect-link -->
