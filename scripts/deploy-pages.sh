#!/usr/bin/env bash
# Publish the app to GitHub Pages → https://tkalimia.github.io/hand-trainer/
# Builds with the Pages sub-path and force-pushes the built files to gh-pages.
# Run after any change:  npm run deploy:pages
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

REPO="https://github.com/tkalimia/hand-trainer.git"

echo "▸ Building for GitHub Pages…"
BASE_PATH=/hand-trainer/ npm run build
touch dist/.nojekyll

echo "▸ Publishing dist/ → gh-pages…"
rm -rf dist/.git
( cd dist
  git init -q
  git checkout -q -b gh-pages
  git add -A
  git -c user.email="tal.kalimian@gmail.com" -c user.name="Tal Kalimian" commit -qm "Deploy $(date '+%Y-%m-%d %H:%M')"
  git push -qf "$REPO" gh-pages )

# Nudge Pages to rebuild immediately (needs gh authenticated).
if command -v gh >/dev/null 2>&1; then
  gh api -X POST repos/tkalimia/hand-trainer/pages/builds >/dev/null 2>&1 || true
fi

echo "✓ Deployed → https://tkalimia.github.io/hand-trainer/"
