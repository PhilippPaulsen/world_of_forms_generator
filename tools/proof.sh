#!/usr/bin/env bash
# tools/proof.sh LEVEL NNN - the test levels of docs/agent-rules.md in one call.
#
#   L0  syntax only: `node --check` on every tracked .js / .mjs file (no suite runs)
#   L1  tools/ui/test-p5-names.js and the two protected netwarp tests, each with
#       its own expected count (test-timeline-net-workflow.js 61,
#       test-netwarp-timelinenet.js 57; a different count is a FAIL)
#   L2  the fast variant of the full command (the three slow suites skipped)
#   L3  the full command (every tools/*/test-*.js + the four Farborgel suites)
#
# Raw output of each file goes to reports/logs/NNN-LEVEL-<file>.log, one line per
# file (status, file, its "x/y checks passed" line or its last line) to
# reports/logs/NNN-summary.txt. The terminal gets only the FAILED lines, the two
# protected tests with their counts, `files: N` and `overall (Lx): PASS|FAIL`;
# VERBOSE=1 prints the line of every file. Exit 0 only on PASS.
# After a PASS at L2 or L3 on a clean tree (`git status --short` empty) it writes
# reports/last-green.json {"commit","level","files"}; L2 never replaces an L3 of
# the same commit. The file is ignored locally (.git/info/exclude).
# Run from anywhere; it works in the repo root. bash 3.2 compatible (macOS).

set -u
level="${1:-}"; nnn="${2:-}"
case "$level" in L0|L1|L2|L3) ;; *) echo "usage: tools/proof.sh L0|L1|L2|L3 NNN" >&2; exit 2;; esac
case "$nnn" in [0-9][0-9][0-9]) ;; *) echo "NNN must be three digits, e.g. 001" >&2; exit 2;; esac

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root" || exit 2
logdir="reports/logs"
mkdir -p "$logdir"

SUITES="tools/*/test-*.js color-harmony/test.js color-harmony/ui/test.mjs color-harmony/ui/composition.test.mjs color-harmony/ui/integration.test.mjs"

files=""
case "$level" in
  L0) files="$(git ls-files '*.js' '*.mjs')" ;;
  L1) files="tools/ui/test-p5-names.js tools/netwarp/test-timeline-net-workflow.js tools/netwarp/test-netwarp-timelinenet.js" ;;
  L2) for f in $SUITES; do
        case "$f" in *test-inherit-hook.js|*test-spread.js|*test-inherit.js) continue;; esac
        files="$files $f"
      done ;;
  L3) for f in $SUITES; do files="$files $f"; done ;;
esac

expect_count() {   # L1 only: the protected counts
  case "$1" in
    tools/netwarp/test-timeline-net-workflow.js) echo 61 ;;
    tools/netwarp/test-netwarp-timelinenet.js) echo 57 ;;
    *) echo "" ;;
  esac
}

verbose="${VERBOSE:-0}"
summary="$logdir/$nnn-summary.txt"
echo "# tools/proof.sh $level $nnn, $(git rev-parse --short HEAD), $(date '+%Y-%m-%d %H:%M')" >"$summary"

fail=0; n=0
for f in $files; do
  n=$((n + 1))
  log="$logdir/$nnn-$level-$(printf '%s' "$f" | tr '/' '_').log"
  if [ "$level" = L0 ]; then
    node --check "$f" >"$log" 2>&1; rc=$?
    note="syntax"
  else
    node "$f" >"$log" 2>&1; rc=$?
    note="$(grep -E '[0-9]+/[0-9]+ checks passed' "$log" | tail -1)"
    [ -z "$note" ] && note="$(tail -1 "$log")"
  fi
  status=PASS
  [ $rc -ne 0 ] && status="FAIL(exit $rc)"
  if [ "$level" = L1 ]; then
    want="$(expect_count "$f")"
    if [ -n "$want" ] && ! grep -qE "^$want/$want checks passed" "$log"; then
      status="FAIL(count, want $want/$want)"
    fi
  fi
  line="$(printf '%-16s %-58s %s' "$status" "$f" "$note")"
  printf '%s\n' "$line" >>"$summary"
  case "$status" in PASS) ;; *) fail=1;; esac
  if [ "$verbose" = 1 ]; then
    printf '%s\n' "$line"
  else
    case "$status" in PASS) ;; *) printf 'FAILED %s\n' "$line";; esac
    [ "$status" = PASS ] && [ -n "$(expect_count "$f")" ] && printf '%s\n' "$line"
  fi
done
result="$([ $fail -eq 0 ] && echo PASS || echo FAIL)"
{ echo "files: $n"; echo "overall ($level): $result"; } | tee -a "$summary"

# last-green cache: only after PASS at L2 / L3 on a clean tree (ignored files do not count)
if [ $fail -eq 0 ] && { [ "$level" = L2 ] || [ "$level" = L3 ]; } && [ -z "$(git status --short)" ]; then
  head="$(git rev-parse HEAD)"; cache="reports/last-green.json"
  if [ "$level" = L2 ] && [ -f "$cache" ] && grep -q "\"commit\":\"$head\"" "$cache" && grep -q '"level":"L3"' "$cache"; then
    :   # an L3 of the same commit stays
  else
    printf '{"commit":"%s","level":"%s","files":%d}\n' "$head" "$level" "$n" >"$cache"
  fi
fi
exit $fail
