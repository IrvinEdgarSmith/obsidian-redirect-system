#!/bin/sh
set -e

# ---------------------------------------------------------------------------
# docker-entrypoint.sh
# HTML is now fully static (no placeholder injection needed).
# Just start nginx.
# ---------------------------------------------------------------------------

exec nginx -g 'daemon off;'
