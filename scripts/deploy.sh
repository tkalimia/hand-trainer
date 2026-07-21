#!/usr/bin/env bash
# ============================================================================
#  Deploy Hand Surgery Trainer to the NAS, served over Tailscale HTTPS.
#
#  What it does:
#    1. Builds the PWA (npm run build → dist/)
#    2. rsyncs dist/ to the NAS
#    3. (Re)starts a tiny Caddy static-file container on the NAS
#    4. Exposes it over HTTPS on your tailnet via `tailscale serve`
#
#  Then install once on the iPhone: open the printed https URL in Safari →
#  Share → "Add to Home Screen". After that it runs full-screen and offline.
#
#  Mirrors the pattern of ~/Projects/caselog/run.sh and the HA deploy.sh.
# ============================================================================
set -euo pipefail

# ── Config (override via env) ───────────────────────────────────────────────
NAS_SSH="${NAS_SSH:-nas}"                       # ssh host alias (see ~/.ssh/config)
REMOTE_DIR="${REMOTE_DIR:-/volume1/web/hand-trainer}"
CONTAINER="${CONTAINER:-hand-trainer}"
HTTP_PORT="${HTTP_PORT:-8096}"                  # internal port Caddy listens on
TS_HOSTNAME="${TS_HOSTNAME:-kalimian.tail953b96.ts.net}"

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$here"

echo "▸ Building production PWA…"
npm run build

echo "▸ Copying dist/ → ${NAS_SSH}:${REMOTE_DIR}"
ssh "$NAS_SSH" "mkdir -p '$REMOTE_DIR'"
rsync -az --delete "$here/dist/" "${NAS_SSH}:${REMOTE_DIR}/"

echo "▸ (Re)starting Caddy static server on the NAS (port ${HTTP_PORT})…"
ssh "$NAS_SSH" bash -s <<EOF
  set -e
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  docker run -d --restart unless-stopped --name "$CONTAINER" \
    -v "$REMOTE_DIR":/srv:ro \
    -p ${HTTP_PORT}:80 \
    caddy:2 caddy file-server --root /srv --listen :80
EOF

echo "▸ Exposing over Tailscale HTTPS…"
# Idempotent: routes https://$TS_HOSTNAME/ → the local Caddy container.
ssh "$NAS_SSH" "sudo tailscale serve --bg --https=443 http://127.0.0.1:${HTTP_PORT}" \
  || echo "  (Could not run 'tailscale serve' automatically — see README for the one-time manual step.)"

echo
echo "✓ Deployed.  Open on your iPhone (Tailscale on):"
echo "    https://${TS_HOSTNAME}/"
echo "  Safari → Share → Add to Home Screen."
