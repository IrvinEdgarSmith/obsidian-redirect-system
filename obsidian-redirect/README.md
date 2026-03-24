# Obsidian Redirect Server — Docker Stack

Docker Compose stack that converts stable HTTPS links into `obsidian://redirect-link` protocol handler calls. nginx serves a single-page redirect, cloudflared tunnels it through Cloudflare for HTTPS, DDoS protection, and zero exposed ports.

## What Each File Does

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Defines two services: nginx (redirect page) + cloudflared (tunnel). Pinned image versions. Health checks. HTTP/2 transport. |
| `docker-entrypoint.sh` | Starts nginx. The HTML is fully static — no injection or templating needed. |
| `Dockerfile` | Builds the nginx image with `jq` pre-installed (legacy, kept for compatibility). |
| `nginx.conf` | Serves from `/usr/share/nginx/html`. Security headers (CSP, X-Frame-Options, nosniff). Health check at `/health`. |
| `html/index.html` | The redirect page. Reads `vault`, `uid`, and `file` from query params, constructs an `obsidian://redirect-link` URI, fires it via hidden anchor `.click()`. Falls back to a manual link after 2 seconds. |
| `config/adapter.json` | Legacy file — no longer used. Kept for reference only. |
| `.env` / `.env.example` | Template for the required `TUNNEL_TOKEN` environment variable. |

## Prerequisites

- **Docker** with Docker Compose v2 (`docker compose` command)
- **Cloudflare account** with a domain managed by Cloudflare DNS
- **Cloudflare Tunnel token** (see setup below)

## Cloudflare Tunnel Setup

1. Log in to [Cloudflare Zero Trust](https://one.dash.cloudflare.com/)
2. Go to **Networks → Tunnels → Create a tunnel**
3. Choose **Cloudflared** as the connector type
4. Name the tunnel (e.g. `obsidian-redirect`)
5. **Copy the tunnel token** from the install command (the long string after `--token`)
6. Under **Public Hostnames**, add a route:
   - **Subdomain**: your chosen subdomain (e.g. `links`)
   - **Domain**: your Cloudflare-managed domain
   - **Service**: `http://localhost:8880`

**Important:** The service URL must be `http://localhost:8880` because cloudflared runs with `network_mode: host` and nginx exposes port 8880 on the host.

**Important:** Only have ONE connector per tunnel. Multiple connectors (e.g. one on Linux, one on Windows) cause intermittent 502 errors because Cloudflare load-balances across them.

## DNS Setup

The tunnel usually creates DNS automatically. If you need to do it manually:

1. Go to your domain's **DNS** settings in Cloudflare
2. Add a CNAME record:
   - **Name**: your subdomain (e.g. `links`)
   - **Target**: `<tunnel-id>.cfargotunnel.com`
   - **Proxy status**: Proxied (orange cloud ON)

**Important:** Only have ONE DNS record for the subdomain. Duplicate records (e.g. a CNAME and a Tunnel route) cause intermittent 502 errors.

## Deploy

```bash
cp .env.example .env
nano .env              # paste your TUNNEL_TOKEN
docker compose build   # build the nginx image
docker compose up -d   # start both services
docker compose ps      # verify both are running (healthy)
```

## Deploy via Portainer

1. **Stacks → Add stack**
2. Choose **Repository** or paste the `docker-compose.yml` content
3. Under **Environment variables**, add:
   - `TUNNEL_TOKEN` = your tunnel token
4. Click **Deploy the stack**

## Canonical URL Format

Every redirect link follows this format — this is the stable contract that never changes:

```
https://{subdomain}.{domain}/v1/open?vault={vault}&uid={uid}&file={url-encoded-path}
```

**Example:**
```
https://links.example.com/v1/open?vault=Work&uid=a1b2c3d4&file=Projects%2FQ1%20Roadmap
```

- `vault` — the Obsidian vault name (case-sensitive)
- `uid` — permanent unique ID stored in the note's frontmatter (rename-proof)
- `file` — URL-encoded file path (fallback if UID not found)

## Updating

```bash
git pull origin master
docker compose build
docker compose up -d
```

The redirect page is mounted as a volume (`./html:/usr/share/nginx/html:ro`), so changes to `html/index.html` take effect after `docker compose restart obsidian-redirect` — no rebuild needed for HTML-only changes.

## Future-Proofing

- **`/v1/` stays stable forever.** If breaking changes are needed, they go to `/v2/`. Existing links always work.
- **Links include both UID and file path.** UID is primary (rename-proof), file path is fallback. Even if the UID system changes, file-path links still work.
- **The plugin handles resolution.** The server just redirects to `obsidian://redirect-link` — all intelligence is in the plugin. Server updates don't break link resolution.

## Troubleshooting

**Check if both containers are running:**
```bash
docker compose ps
# Both should show "running" / "healthy"
```

**Cloudflared connection issues:**
```bash
docker compose logs cloudflared
# Good: "Registered tunnel connection" (should see 4 connections)
# Bad: "token is invalid" — check your .env file
# Bad: "failed to connect" — check firewall/network
```

**Nginx startup issues:**
```bash
docker compose logs obsidian-redirect
# Should show nginx startup messages
```

**502 Bad Gateway (intermittent):**
1. Check for duplicate tunnel connectors: Zero Trust → Tunnels → your tunnel → Connectors. Should be only ONE.
2. Check for duplicate DNS records: Cloudflare Dashboard → DNS. Should be only ONE record for your subdomain.
3. Check cloudflared protocol: logs should show `protocol=http2`. If QUIC, the `--protocol http2` flag may be missing.

**502 Bad Gateway (all requests):**
1. Check `.env` has the real tunnel token (not the placeholder)
2. Check the tunnel's public hostname service URL is `http://localhost:8880`
3. Check port 8880 is accessible: `curl http://localhost:8880/health`

**Test locally (without tunnel):**
```bash
curl http://localhost:8880/health
# Should return: ok

curl http://localhost:8880/v1/open?vault=TestVault&uid=abc123&file=TestNote
# Should return HTML with obsidian://redirect-link URI
```

---

<!-- AI-CONTEXT: This is the Docker stack for the Obsidian redirect system. Traffic flow:
internet → Cloudflare CDN → cloudflared container (HTTP/2, network_mode: host) →
nginx container (port 8880 on host). The HTML is fully static — no server-side injection
or templating. index.html always builds obsidian://redirect-link?vault=X&uid=Y&file=Z URIs.
The companion Obsidian plugin registers the "redirect-link" protocol handler and resolves
UIDs to notes via MetadataCache. nginx.conf serves from /usr/share/nginx/html (read-only
mount). Security headers: CSP, X-Frame-Options DENY, X-Content-Type-Options nosniff,
Referrer-Policy no-referrer. /health returns 200 for health checks. docker-entrypoint.sh
just runs exec nginx. The Dockerfile includes jq (legacy, not currently used).
cloudflared uses --protocol http2 to avoid QUIC/UDP buffer issues. -->
