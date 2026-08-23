// Fail if the generated pages do not match routes.json.
//
// Generated pages are gitignored, so this is really a guard against the
// generator silently dropping routes — a section renamed in the router but not
// in ORDER, for instance, which would otherwise vanish from the sidebar.

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const doc = JSON.parse(readFileSync(join(root, 'routes.json'), 'utf8'))

let pages
try {
  pages = readdirSync(join(root, 'docs/api/reference'))
} catch {
  console.error('check-drift: no generated pages — run `npm run gen` first')
  process.exit(1)
}

const rendered = pages
  .filter((f) => f.endsWith('.md'))
  .flatMap((f) =>
    [...readFileSync(join(root, 'docs/api/reference', f), 'utf8')
      .matchAll(/^### `(\w+) (\S+)`$/gm)].map((m) => `${m[1]} ${m[2]}`),
  )

const expected = doc.routes.map((r) => `${r.method} ${r.path}`)
const missing = expected.filter((r) => !rendered.includes(r))
const extra = rendered.filter((r) => !expected.includes(r))

if (missing.length || extra.length) {
  if (missing.length) console.error('check-drift: not documented:\n  ' + missing.join('\n  '))
  if (extra.length) console.error('check-drift: documented but not a route:\n  ' + extra.join('\n  '))
  process.exit(1)
}

// Anchors are checked here because a build cannot catch them: VitePress
// validates links between pages, but a link to a heading that no longer exists
// on the same page renders fine and simply does not jump. In a table of 109
// routes that is invisible until somebody clicks one.
const built = join(root, 'docs/.vitepress/dist/api/reference')
let brokenAnchors = 0
try {
  for (const file of readdirSync(built).filter((f) => f.endsWith('.html'))) {
    const html = readFileSync(join(built, file), 'utf8')
    const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]))
    for (const [, anchor] of html.matchAll(/href="#([^"]+)"/g)) {
      if (anchor === 'VPContent' || ids.has(anchor)) continue
      console.error(`check-drift: ${file} links to #${anchor}, which does not exist`)
      brokenAnchors++
    }
  }
} catch {
  console.log('check-drift: no build output — skipping the anchor check')
}
if (brokenAnchors) process.exit(1)

console.log(`check-drift: all ${expected.length} routes documented`)
