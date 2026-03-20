#!/bin/sh
set -e

# Install jq for JSON parsing (lightweight, ~1MB on Alpine)
apk add --no-cache jq >/dev/null 2>&1

CONFIG_PATH="/etc/obsidian-redirect/config/adapter.json"

# Read active handler and its scheme from adapter config
HANDLER=$(jq -r '.handler' "$CONFIG_PATH")
SCHEME=$(jq -r --arg h "$HANDLER" '.handlers[$h].scheme' "$CONFIG_PATH")

if [ -z "$SCHEME" ] || [ "$SCHEME" = "null" ]; then
  echo "ERROR: Could not resolve scheme for handler '$HANDLER' from $CONFIG_PATH"
  exit 1
fi

echo "Adapter: handler=$HANDLER scheme=$SCHEME"

# Copy template HTML to writable location (source mount is :ro)
cp -r /usr/share/nginx/html /usr/share/nginx/html-live

# Inject the resolved scheme into the HTML template
sed -i "s|__HANDLER_SCHEME__|${SCHEME}|g" /usr/share/nginx/html-live/index.html

# Hand off to nginx as PID 1
exec nginx -g 'daemon off;'
