#!/usr/bin/env bash
# One-time repo bootstrap. Run from this folder on your machine.
set -e
command -v git >/dev/null || { echo "install git first"; exit 1; }
git init -b main
git add -A && git commit -m "v1.3 build package: schema(78t validated) + specs + tests(11/11) + mockups"
if command -v gh >/dev/null; then
  gh auth status >/dev/null 2>&1 || gh auth login
  gh repo create yellow --private --source=. --push
  echo "pushed: github.com/$(gh api user -q .login)/yellow"
else
  echo "gh CLI not found. Create an empty private repo on github.com, then:"
  echo "  git remote add origin git@github.com:<you>/yellow.git && git push -u origin main"
fi
echo "Next: ./state.sh, then open Claude Code here -> 'Read PROJECT.md, then CLAUDE.md and BUILD-PLAN.md. Execute Phase 0.'"
