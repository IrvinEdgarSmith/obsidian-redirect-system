# Obsidian Redirect System

Share Obsidian notes via stable HTTPS links that work anywhere — Notion, Slack, email, bookmarks. Clicking a link fires an `obsidian://` protocol handler that opens the note directly in the desktop app, without leaving an orphaned browser tab.

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

## Components

| Component | Directory | What it does |
|-----------|-----------|-------------|
| **Redirect Server** | [`obsidian-redirect/`](obsidian-redirect/) | Docker stack: nginx serves the redirect page, cloudflared tunnels it to the internet |
| **Obsidian Plugin** | [`obsidian-redirect-plugin/`](obsidian-redirect-plugin/) | Right-click any file → "Copy Redirect Link" copies the HTTPS URL to clipboard |

## Architecture Decisions

**Why not just use `obsidian://` links directly?**
Native `obsidian://` links don't render as clickable hyperlinks in most apps (Notion, Slack, email). HTTPS links work everywhere. The redirect server converts them at click time.

**Why the adapter pattern?**
`config/adapter.json` decouples the URI scheme from the link format. Switching from standard Obsidian URIs to Advanced URI (or any future handler) is a config change + container restart — zero link breakage.

**Why the hidden anchor technique?**
`window.location.href = "obsidian://..."` navigates the browser tab, leaving a dead page. The hidden anchor `.click()` fires the protocol handler without navigating, so the user's browser stays clean.

**Why `/v1/` in the URL path?**
Version namespace. If the API contract ever needs breaking changes, `/v2/` handles them. `/v1/` keeps working forever.

## Quick Start

### 1. Deploy the server
```bash
cd obsidian-redirect/
cp .env.example .env
# Edit .env with your Cloudflare Tunnel token
docker compose up -d
```

### 2. Install the plugin
Copy `obsidian-redirect-plugin/main.js` and `manifest.json` into:
```
<your-vault>/.obsidian/plugins/obsidian-redirect-link/
```
Enable in Settings → Community Plugins. Configure your server URL and vault name.

### 3. Use it
Right-click any file → **Copy Redirect Link** → paste anywhere.

---

<!-- AI-CONTEXT: This is a monorepo containing a Docker-based HTTP-to-obsidian:// redirect
server and an Obsidian plugin that generates redirect URLs. The canonical link format is
https://{base}/v1/open?vault={vault}&file={file}. The server uses nginx:1.27-alpine +
cloudflare/cloudflared:2024.12.2. The plugin is built with esbuild (CJS, es2018 target)
and uses the Obsidian Plugin API (file-menu event, addCommand, PluginSettingTab). The
adapter pattern in config/adapter.json maps handler names to URI schemes. The HTML redirect
page uses a hidden <a> element .click() to fire obsidian:// URIs without orphaning tabs.
Key files: obsidian-redirect/docker-entrypoint.sh (config injection),
obsidian-redirect/html/index.html (redirect logic), obsidian-redirect-plugin/src/main.ts
(plugin source). Build: cd obsidian-redirect-plugin && npm install && npm run build. -->
