# Obsidian Redirect Server

Docker Compose stack that converts stable HTTPS links into `obsidian://` protocol handler calls. nginx serves a single-page redirect, cloudflared tunnels it through Cloudflare for HTTPS, DDoS protection, and zero exposed ports.

## What Each File Does

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Defines two services: nginx (redirect page) + cloudflared (tunnel). Pinned image versions. Health checks. |
| `docker-entrypoint.sh` | Runs at container start: installs `jq`, reads `adapter.json`, injects the active URI scheme into `index.html` via `sed`, then starts nginx. |
| `nginx.conf` | Serves from `/usr/share/nginx/html-live` (the injected copy). Includes security headers (CSP, X-Frame-Options, nosniff). Health check endpoint at `/health`. |
| `html/index.html` | The redirect page. Reads `vault` and `file` from query params, constructs an `obsidian://` URI, fires it via hidden anchor `.click()`. Falls back to a manual link after 2 seconds. |
| `html/error.html` | Shown when vault or file params are missing. |
| `config/adapter.json` | Maps handler names to URI schemes. Change `"handler"` to switch backends without changing any links. |
| `.env.example` | Template for the required `TUNNEL_TOKEN` environment variable. |

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
   - **Service**: `http://obsidian-redirect:80`

## DNS Setup

The tunnel usually creates DNS automatically. If you need to do it manually:

1. Go to your domain's **DNS** settings in Cloudflare
2. Add a CNAME record:
   - **Name**: your subdomain (e.g. `links`)
   - **Target**: `<tunnel-id>.cfargotunnel.com`
   - **Proxy status**: Proxied (orange cloud ON)

## Deploy

```bash
cp .env.example .env
nano .env              # paste your TUNNEL_TOKEN
docker compose up -d   # start both services
docker compose ps      # verify both are running
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
https://{subdomain}.{domain}/v1/open?vault={vault}&file={url-encoded-path}
```

**Example:**
```
https://links.example.com/v1/open?vault=Work&file=Projects%2FQ1%20Roadmap
```

Both `vault` and `file` are URL-encoded. The path uses forward slashes (`/`), encoded as `%2F`.

## Changing Backends

The adapter pattern means you can switch URI handlers without changing any links:

1. Edit `config/adapter.json`:
   ```json
   {
     "handler": "advanced-uri"
   }
   ```
2. Restart the nginx container:
   ```bash
   docker compose restart obsidian-redirect
   ```

The entrypoint re-reads the config and re-injects the scheme on every start.

**Available handlers** (defined in `adapter.json`):
| Handler | Scheme | Notes |
|---------|--------|-------|
| `obsidian` | `obsidian` | Standard Obsidian URI scheme |
| `advanced-uri` | `obsidian` | Same scheme, supports extended params from the Advanced URI plugin |

Add new handlers by adding entries to the `handlers` object in `adapter.json`.

## Future-Proofing

- **`/v1/` stays stable forever.** If breaking changes are needed, they go to `/v2/`. Existing links always work.
- **New handlers** can be added to `adapter.json` without touching HTML, nginx, or Docker config.
- **Links are the contract.** Everything behind them — server, tunnel, handler — can change independently.

## Troubleshooting

**Check if both containers are running:**
```bash
docker compose ps
```

**Cloudflared connection issues:**
```bash
docker compose logs cloudflared
# Look for: "Registered tunnel connection"
# Bad sign: "failed to connect" or "token is invalid"
```

**Nginx startup issues:**
```bash
docker compose logs obsidian-redirect
# Look for: "Ready: serving from /usr/share/nginx/html-live with scheme=obsidian"
# Bad sign: "FATAL:" messages from the entrypoint
```

**Verify scheme injection worked:**
```bash
docker exec obsidian-redirect grep 'HANDLER_SCHEME' /usr/share/nginx/html-live/index.html
# Should show: window.HANDLER_SCHEME = "obsidian";
# Bad sign: window.HANDLER_SCHEME = "__HANDLER_SCHEME__";
```

**Test locally (without tunnel):**
Add a temporary port mapping to `docker-compose.yml`:
```yaml
# Under obsidian-redirect service:
ports:
  - "8080:80"
```
Then visit: `http://localhost:8080/v1/open?vault=TestVault&file=TestNote`

**Health check:**
```bash
curl http://localhost:8080/health
# Should return: ok
```

---

<!-- AI-CONTEXT: This is the Docker stack component of the obsidian-redirect-system.
Traffic flow: internet -> Cloudflare CDN -> cloudflared container -> nginx container -> index.html.
The entrypoint (docker-entrypoint.sh) is the critical startup script: it installs jq,
validates adapter.json, extracts the URI scheme, copies HTML to a writable dir, injects
the scheme via sed, then execs nginx. The nginx.conf serves from /usr/share/nginx/html-live
(not the mounted /html which is :ro). Security headers include CSP, X-Frame-Options,
X-Content-Type-Options, Referrer-Policy. The /health endpoint returns 200 for container
health checks. cloudflared depends_on nginx with condition: service_healthy.
To modify the redirect behavior, edit html/index.html (the template) and restart.
To change URI schemes, edit config/adapter.json and restart. -->
