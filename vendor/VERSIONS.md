# vendor/ - third-party code served from this repository

| File | Version | Licence | SHA-256 |
|---|---|---|---|
| `p5-1.9.0.js` | p5.js 1.9.0 (28 Nov 2023), the NON-minified `lib/p5.js` | LGPL-2.1 (`p5-LICENSE.txt`) | `0b2a70cc0b8cbd7f24e38c2d0cbe94bca986bc7217774158e27cdc30b0447ed7` |

- Source: `https://cdn.jsdelivr.net/npm/p5@1.9.0/lib/p5.js`; the same bytes as `lib/p5.js` in the npm tarball `p5@1.9.0` (both SHA-256 compared on 2026-11-25).
- Check: `shasum -a 256 vendor/p5-1.9.0.js`
- The non-minified build is kept on purpose: its friendly-error reader is what `tools/ui/test-p5-names.js` mirrors. Do not swap the version or the build without regenerating `tools/ui/p5-names-1.9.0.json` (see `docs/agent-rules.md`).
