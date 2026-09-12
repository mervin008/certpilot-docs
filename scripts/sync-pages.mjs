// Publish whole pages from the CertPilot repository, unchanged apart from links.
//
// `docs/architecture.md` in the code repository is 280 lines explaining how the
// system fits together and why it was built that way — the three decisions, the
// processes, the request path, where the private keys are. Until now the only
// way to read it was to clone the code, which is exactly backwards: somebody
// deciding whether to run CertPilot got a list of 121 endpoints and no account
// of what the thing is.
//
// This publishes it here without moving it. Prose about the architecture that
// lives beside the architecture gets updated by the person changing it; prose
// that lives in a different repository does not, and nothing ever says so.
//
// Same vendoring trade as routes.json and the guides: the docs build must not
// need a checkout of the code, so the result is committed here and this script
// closes the gap. `--check` is what CI runs.
//
//   node scripts/sync-pages.mjs                 # fetch from the default branch
//   node scripts/sync-pages.mjs --check         # exit 1 if it would change
//   CERTPILOT_DOCS_DIR=../certpilot/docs node scripts/sync-pages.mjs

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const RAW = 'https://raw.githubusercontent.com/certpilot/certpilot/main/docs'
const CODE_TREE = 'https://github.com/certpilot/certpilot/blob/main'

const localDir = process.env.CERTPILOT_DOCS_DIR
const check = process.argv.includes('--check')

/*
 * Every page carries a sentinel: a heading that must be present in what comes
 * back. A 404 served as a 200, or a file renamed upstream, otherwise arrives
 * here as a page that builds cleanly and says nothing.
 */
const PAGES = [
  {
    source: 'architecture.md',
    target: 'docs/architecture.md',
    sentinel: '## Decision 1 — a gateway is a process, not a package',
  },
]

/**
 * Point repository-relative links at the code on GitHub.
 *
 * The prose was written to sit inside `docs/` in the code repository, where
 * `security.md` is a sibling file and `../core/store` is a real directory.
 * Published here both resolve to nothing, and this site fails the build on a
 * dead link rather than shipping one — so anything not rewritten is a hard
 * error below rather than a link that quietly goes nowhere.
 */
function absolutiseLinks(markdown) {
  return markdown.replace(/\]\(([^)\s]+)(\s+"[^"]*")?\)/g, (whole, target, title = '') => {
    // Already absolute, or an anchor into this same page.
    if (/^(https?:|mailto:|#|\/)/.test(target)) return whole

    // `../` is relative to docs/, so it lands at the repository root.
    // Anything else is relative to docs/ itself.
    const rewritten = target.startsWith('../')
      ? `${CODE_TREE}/${target.slice(3)}`
      : `${CODE_TREE}/docs/${target.replace(/^\.\//, '')}`

    return `](${rewritten}${title})`
  })
}

/**
 * Anything that will not resolve from this site once published.
 *
 * That is more than "still relative": a root-relative `/internal/runbook` is a
 * path on this documentation site rather than in the code repository, which is
 * never what the author meant and is not something the rewriter can guess at.
 * Both are refused here rather than shipped, because the build's dead-link
 * check would only catch the ones that happen to look like site paths.
 */
function unresolvedLinks(markdown) {
  return [...markdown.matchAll(/\]\(([^)\s]+)/g)]
    .map(([, target]) => target)
    .filter((target) => !/^(https?:|mailto:|#)/.test(target))
}

async function load(page) {
  if (localDir) {
    const path = join(localDir, page.source)
    if (!existsSync(path)) {
      console.error(`sync-pages: ${path} does not exist`)
      process.exit(1)
    }
    return readFileSync(path, 'utf8')
  }
  const response = await fetch(`${RAW}/${page.source}`)
  if (!response.ok) {
    console.error(`sync-pages: ${RAW}/${page.source} returned ${response.status}`)
    process.exit(1)
  }
  return response.text()
}

const next = new Map()

for (const page of PAGES) {
  const markdown = await load(page)

  if (!markdown.includes(page.sentinel)) {
    console.error(
      `sync-pages: ${page.source} does not contain ${JSON.stringify(page.sentinel)} — ` +
        `either it was renamed upstream or this is not the file we asked for`,
    )
    process.exit(1)
  }

  const body = absolutiseLinks(markdown)

  const unresolved = unresolvedLinks(body)
  if (unresolved.length) {
    console.error(
      `sync-pages: ${page.source} has links that will not resolve once ` +
        `published here:\n  ${unresolved.join('\n  ')}`,
    )
    process.exit(1)
  }

  next.set(
    page.target,
    // editLink is switched off per page rather than globally: the button would
    // otherwise offer to edit this vendored copy, and that edit would be
    // overwritten by the next sync without anybody being told.
    '---\neditLink: false\n---\n\n' +
      `<!-- Synced from docs/${page.source} in the CertPilot repository by\n` +
      `     scripts/sync-pages.mjs. Edit it there, not here. -->\n\n` +
      body.trimEnd() +
      '\n',
  )
}

const same = [...next].every(([target, body]) => {
  const path = join(root, target)
  return existsSync(path) && readFileSync(path, 'utf8') === body
})

if (check) {
  if (same) {
    console.log(`sync-pages: up to date (${next.size} page${next.size === 1 ? '' : 's'})`)
    process.exit(0)
  }
  console.error('sync-pages: pages are stale — run `npm run sync:pages`')
  process.exit(1)
}

for (const [target, body] of next) {
  const path = join(root, target)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, body)
}

console.log(
  `sync-pages: ${next.size} page${next.size === 1 ? '' : 's'} written` +
    (same ? ' (no change)' : ''),
)
