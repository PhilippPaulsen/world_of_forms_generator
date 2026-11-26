#!/usr/bin/env python3
"""tools/dev/remap-hashes.py - task 142: rewrite OLD commit hashes in tools/**/*.js to the NEW ones after the history rewrite (F4, git filter-repo).

The tests pin trees with `git show <hash>:path` / `git diff <hash>`; the rewrite gave every commit a new hash, so the old ones no longer exist in a clone.
`git filter-repo` left a commit map (old new, one pair per line, full 40-hex hashes): $BK/gen-B.commit-map.txt of the F4 backup.

  tools/dev/remap-hashes.py --map "$BK/gen-B.commit-map.txt" [--dry-run]

Rules: only tools/**/*.js (never baseline-*.json, reports, docs: they keep the old hashes as history); a token is a word of exactly 8 hex digits that is NOT a commit
of this repository and whose full hash is the (unique) prefix match of an old hash in the map; it becomes the first 8 digits of the new hash. Idempotent: a second
run finds nothing. Prints every changed file with its replacements. Exit 0.
"""
import argparse, glob, os, re, subprocess, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

def is_commit(h):
    r = subprocess.run(['git', 'cat-file', '-t', h], cwd=ROOT, capture_output=True, text=True)
    return r.returncode == 0 and r.stdout.strip() == 'commit'

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--map', required=True)
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()
    old2new = {}
    for line in open(a.map):
        p = line.split()
        if len(p) == 2 and re.fullmatch(r'[0-9a-f]{40}', p[0]) and re.fullmatch(r'[0-9a-f]{40}', p[1]) and p[0] != p[1]:
            old2new.setdefault(p[0][:8], set()).add(p[1][:8])
    total = 0; changed = 0; skipped = {}
    cache = {}
    def new_for(tok):
        if tok in cache: return cache[tok]
        r = None
        if tok in old2new and len(old2new[tok]) == 1 and not is_commit(tok):
            r = next(iter(old2new[tok]))
        elif tok in old2new and len(old2new[tok]) > 1:
            skipped[tok] = 'ambiguous'
        cache[tok] = r
        return r
    for f in sorted(glob.glob(os.path.join(ROOT, 'tools', '**', '*.js'), recursive=True)):
        s = open(f).read(); n = []
        def rep(m):
            nw = new_for(m.group(0))
            if nw: n.append(m.group(0) + '->' + nw); return nw
            return m.group(0)
        out = re.sub(r'(?<![0-9a-zA-Z])[0-9a-f]{8}(?![0-9a-zA-Z])', rep, s)
        if n:
            changed += 1; total += len(n)
            print(os.path.relpath(f, ROOT) + ': ' + ' '.join(sorted(set(n))))
            if not a.dry_run: open(f, 'w').write(out)
    print(f'{"would change" if a.dry_run else "changed"}: {total} replacements in {changed} files; ambiguous (left alone): {skipped or "none"}')

if __name__ == '__main__':
    main()
