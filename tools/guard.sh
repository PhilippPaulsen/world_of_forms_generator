#!/usr/bin/env bash
# tools/guard.sh BASIS-COMMIT - sketch.js and core/ must be unchanged against BASIS-COMMIT:
# no committed, staged, unstaged or untracked change. Exit 0 = PASS.
set -u
base="${1:-}"
[ -z "$base" ] && { echo "usage: tools/guard.sh BASIS-COMMIT" >&2; exit 2; }
cd "$(dirname "$0")/.." || exit 2
git rev-parse --verify --quiet "$base^{commit}" >/dev/null || { echo "guard: unknown commit $base" >&2; exit 2; }

changed="$(git diff --name-only "$base" -- sketch.js core/)"
untracked="$(git ls-files --others --exclude-standard -- sketch.js core/)"
if [ -z "$changed$untracked" ]; then
  echo "guard: sketch.js and core/ unchanged against $(git rev-parse --short "$base"): PASS"
  exit 0
fi
echo "guard: changes against $(git rev-parse --short "$base"): FAIL"
[ -n "$changed" ] && printf '  changed:   %s\n' $changed
[ -n "$untracked" ] && printf '  untracked: %s\n' $untracked
exit 1
