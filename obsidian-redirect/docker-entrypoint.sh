#!/bin/sh
set -e

# ---------------------------------------------------------------------------
# docker-entrypoint.sh
# Reads the active handler scheme from adapter.json, injects it into the
# HTML template, then hands off to nginx as PID 1.
# ---------------------------------------------------------------------------

CONFIG_PATH="/etc/obsidian-redirect/config/adapter.json"
HTML_SRC="/usr/share/nginx/html"
HTML_LIVE="/usr/share/nginx/html-live"

# --- Install jq (lightweight JSON parser, ~1 MB on Alpine) ----------------
apk add --no-cache jq >/dev/null 2>&1

# --- Validate config file exists and is valid JSON ------------------------
if [ ! -f "$CONFIG_PATH" ]; then
  echo "FATAL: Config file not found: $CONFIG_PATH"
  exit 1
fi

if ! jq empty "$CONFIG_PATH" 2>/dev/null; then
  echo "FATAL: Invalid JSON in $CONFIG_PATH"
  exit 1
fi

# --- Extract active handler and scheme ------------------------------------
HANDLER=$(jq -r '.handler // empty' "$CONFIG_PATH")
if [ -z "$HANDLER" ]; then
  echo "FATAL: No 'handler' field in $CONFIG_PATH"
  exit 1
fi

SCHEME=$(jq -r --arg h "$HANDLER" '.handlers[$h].scheme // empty' "$CONFIG_PATH")
if [ -z "$SCHEME" ]; then
  echo "FATAL: No scheme found for handler '$HANDLER' in $CONFIG_PATH"
  exit 1
fi

# --- Validate scheme is alphanumeric (prevent sed injection) ---------------
if ! echo "$SCHEME" | grep -qE '^[a-zA-Z][a-zA-Z0-9+.-]*$'; then
  echo "FATAL: Invalid URI scheme '$SCHEME' — must match RFC 3986 scheme format"
  exit 1
fi

echo "Adapter: handler=$HANDLER scheme=$SCHEME"

# --- Copy HTML template to writable location (source mount is :ro) ---------
if [ ! -d "$HTML_SRC" ]; then
  echo "FATAL: HTML source directory not found: $HTML_SRC"
  exit 1
fi

rm -rf "$HTML_LIVE"
cp -r "$HTML_SRC" "$HTML_LIVE"

# --- Inject scheme into HTML template --------------------------------------
sed -i "s|__HANDLER_SCHEME__|${SCHEME}|g" "$HTML_LIVE/index.html"

# --- Verify injection succeeded --------------------------------------------
if grep -q "__HANDLER_SCHEME__" "$HTML_LIVE/index.html"; then
  echo "WARN: Placeholder __HANDLER_SCHEME__ still present in index.html after injection"
fi

echo "Ready: serving from $HTML_LIVE with scheme=$SCHEME"

# --- Hand off to nginx as PID 1 -------------------------------------------
exec nginx -g 'daemon off;'
