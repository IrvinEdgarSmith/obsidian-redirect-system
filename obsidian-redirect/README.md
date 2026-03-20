# Obsidian Redirect Server

An nginx + Cloudflare Tunnel stack that converts stable HTTPS links into `obsidian://` protocol handler calls. The redirect page uses a hidden-anchor technique to fire the URI without leaving an orphaned browser tab.

## 1. Architecture

- **nginx** serves a single HTML page that reads `vault` and `file` query parameters, constructs an `obsidian://open` URI, and fires it via a programmatic anchor click.
- **cloudflared** exposes the nginx container to the internet through a Cloudflare Tunnel, providing HTTPS, DDoS protection, and WAF without opening any ports on your host.
- **adapter.json** decouples the URI scheme from the link format. Changing backends (e.g. from standard Obsidian to Advanced URI) requires only a config edit and container restart — links never change.

## 2. Prerequisites

- Docker and Docker Compose (v2)
- A Cloudflare account with a domain managed by Cloudflare DNS
- A Cloudflare Tunnel token (see step 3)

## 3. Cloudflare Tunnel Setup

1. Log in to the [Cloudflare Zero Trust dashboard](https://one.dash.cloudflare.com/)
2. Navigate to **Networks > Tunnels**
3. Click **Create a tunnel** and choose **Cloudflared** as the connector
4. Name the tunnel (e.g. `obsidian-redirect`)
5. Copy the tunnel token from the install instructions
6. Paste the token into your `.env` file (see step 5)
7. Under **Public Hostnames**, add a route:
   - Subdomain: your chosen subdomain (e.g. `ObsidianLink`)
   - Domain: your Cloudflare domain
   - Service: `http://obsidian-redirect:80`

## 4. DNS Setup

If not using the tunnel's automatic DNS:

1. Go to your domain's **DNS** settings in Cloudflare
2. Add a CNAME record:
   - Name: `ObsidianLink` (or your chosen subdomain)
   - Target: `<tunnel-id>.cfargotunnel.com`
   - Proxy status: **Proxied** (orange cloud ON)

## 5. Deploy

```bash
cp .env.example .env
# Edit .env and paste your TUNNEL_TOKEN
docker compose up -d
```

Verify both containers are running:

```bash
docker compose ps
```

## 6. Portainer Stack Import

1. In Portainer, go to **Stacks > Add stack**
2. Choose **Repository** and point to this directory's `docker-compose.yml`
3. Under **Environment variables**, add `TUNNEL_TOKEN` with your token value
4. Click **Deploy the stack**

## 7. Canonical URL Format

All redirect links follow this stable format:

```
https://{your-subdomain}.{your-domain}/v1/open?vault={vault}&file={url-encoded-path}
```

Example:

```
https://ObsidianLink.MycelialHost.net/v1/open?vault=MyVault&file=Projects%2FReadme
```

- `/v1/` is the version namespace. Future breaking changes go to `/v2/`. `/v1/` always keeps working.
- Both `vault` and `file` must be URL-encoded.

## 8. Changing Backends

To switch from the standard Obsidian URI handler to another backend (e.g. Advanced URI):

1. Edit `config/adapter.json` and change the `"handler"` field
2. Restart only the nginx container:

```bash
docker compose restart obsidian-redirect
```

No link changes required. The entrypoint re-reads the config and injects the new scheme on restart.

## 9. Future-Proofing

- `/v1/` stays stable indefinitely. Breaking changes go to `/v2/`.
- The adapter pattern means new handler types can be added to `adapter.json` without touching HTML or nginx config.
- Links are the stable contract. Everything behind them can change.

## 10. Troubleshooting

**Check cloudflared logs:**

```bash
docker compose logs cloudflared
```

**Check nginx logs:**

```bash
docker compose logs obsidian-redirect
docker exec obsidian-redirect cat /var/log/nginx/error.log
```

**Verify the scheme was injected correctly:**

```bash
docker exec obsidian-redirect grep 'HANDLER_SCHEME' /usr/share/nginx/html-live/index.html
```

**Test locally (without tunnel):**

Add a temporary port mapping to `docker-compose.yml` under `obsidian-redirect`:

```yaml
ports:
  - "8080:80"
```

Then visit `http://localhost:8080/v1/open?vault=TestVault&file=TestNote`.
