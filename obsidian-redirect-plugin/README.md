# Copy Redirect Link — Obsidian Plugin

Right-click any file in the explorer or use the command palette to copy a shareable HTTPS redirect link. When someone clicks the link, it opens the note directly in Obsidian.

## Install

### Manual (from this repo)

1. Copy `main.js` and `manifest.json` into your vault:
   ```
   <vault>/.obsidian/plugins/obsidian-redirect-link/
     main.js
     manifest.json
   ```
2. Restart Obsidian (or `Ctrl+R` / `Cmd+R`)
3. Settings → Community Plugins → enable **Copy Redirect Link**

The folder name **must** be `obsidian-redirect-link` (matching the `id` in `manifest.json`).

### Build from source

```bash
npm install
npm run build    # type-checks then bundles src/main.ts -> main.js
```

## Configure

Settings → Copy Redirect Link:

| Setting | What to enter | Example |
|---------|--------------|---------|
| **Redirect server URL** | Your deployed redirect server base URL. `/v1/open` is appended automatically if missing. | `https://links.example.com` |
| **Vault name** | Exactly as shown in Obsidian's vault switcher. Case-sensitive. | `Work` |

Click **Test** to verify the server is reachable (5-second timeout).

## Use

**File explorer:** Right-click any file → **Copy Redirect Link**

**Command palette:** `Ctrl+P` → type "Copy Redirect Link" (only available when a note is open)

**What gets copied:**
```
https://links.example.com/v1/open?vault=Work&file=Projects%2FQ1%20Roadmap
```

Paste this URL anywhere — Notion, Slack, email, bookmarks. Clicking it opens the note in Obsidian.

## How It Works

The plugin is a **dumb link factory**. It knows two things:
1. The server base URL
2. The vault name

It combines them with the file path into a canonical HTTPS URL. It knows nothing about URI schemes, redirect behavior, or backends. That's all handled by the server.

```
baseUrl + "?vault=" + encode(vaultName) + "&file=" + encode(filePath)
```

## File Structure

```
src/main.ts         Source code (all plugin logic in one file)
main.js             Built output (committed for easy manual install)
manifest.json       Plugin metadata (id, name, version, minAppVersion)
versions.json       Maps plugin versions to minimum Obsidian versions
package.json        Dependencies and build scripts
tsconfig.json       TypeScript compiler options (matches official sample plugin)
esbuild.config.mjs  esbuild bundler config (CJS output, es2018 target)
```

## Development

```bash
npm install          # install dependencies
npm run dev          # watch mode — rebuilds on save
npm run build        # production build (type-check + minified bundle)
```

The `obsidian` package is externalized by esbuild — it's provided by Obsidian at runtime, not bundled.

## Source Code Overview

`src/main.ts` has four clearly separated sections:

1. **Settings interface + defaults** — the data contract
2. **Pure utility functions** — `normalizeBaseUrl()`, `isValidHttpUrl()`, `buildRedirectUrl()` — no side effects, easy to test
3. **Plugin class** — lifecycle (`onload`/`onunload`) and event registration only
4. **Settings tab class** — UI rendering only

---

<!-- AI-CONTEXT: This is an Obsidian community plugin built with the standard toolchain
(esbuild 0.25.5, TypeScript 5.x, obsidian API latest). Entry point: src/main.ts.
Build output: main.js (CJS format, es2018 target). The plugin registers a file-menu
event (workspace.on("file-menu")) and a checkCallback command. Settings use loadData/
saveData with PluginSettingTab. Clipboard access via navigator.clipboard.writeText().
Key functions: normalizeBaseUrl() appends /v1/open if missing, buildRedirectUrl()
constructs the canonical URL, isValidHttpUrl() validates user input. The plugin has
NO knowledge of obsidian:// URIs or redirect behavior — it only constructs HTTPS URLs.
To modify: edit src/main.ts, run npm run build, copy main.js + manifest.json to vault.
manifest.json id must match the plugin folder name: obsidian-redirect-link. -->
