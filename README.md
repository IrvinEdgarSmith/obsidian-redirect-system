# Obsidian Redirect System

A production-grade system for sharing Obsidian notes via stable HTTPS links. Clicking a link fires an `obsidian://` protocol handler call that opens the note directly — no orphaned browser tabs.

## Components

### [obsidian-redirect/](obsidian-redirect/)
Docker Compose stack (nginx + Cloudflare Tunnel) that serves the redirect page. The adapter pattern decouples URI scheme from link format — changing backends requires only a config edit and container restart.

### [obsidian-redirect-plugin/](obsidian-redirect-plugin/)
Obsidian plugin that generates redirect links. Right-click any file in the explorer or use the command palette to copy a canonical HTTPS redirect URL to your clipboard.

## Canonical Link Format

```
https://{your-subdomain}.{your-domain}/v1/open?vault={vault}&file={url-encoded-path}
```

- `/v1/` is a version namespace. Future breaking changes go to `/v2/`. `/v1/` always keeps working.
- The plugin is a dumb link factory — it knows the base URL and vault name, nothing else.
- Links are the stable contract. Everything behind them can change.

## Quick Start

1. **Server**: See [obsidian-redirect/README.md](obsidian-redirect/README.md) for Cloudflare Tunnel setup and deployment
2. **Plugin**: Copy `obsidian-redirect-plugin/manifest.json` and `obsidian-redirect-plugin/main.js` into your vault's `.obsidian/plugins/obsidian-redirect-link/` directory, then enable in Settings > Community Plugins
