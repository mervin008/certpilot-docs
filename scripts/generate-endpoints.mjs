// Turn routes.json into one reference page per area of the API.
//
// These pages are generated rather than written because a hand-maintained route
// table has exactly one failure mode and it is silent: somebody adds a route,
// forgets the docs, and the reference is quietly wrong for six months. Here a
// missing route is impossible — the table is the router.
//
// Prose that explains *why* a route is gated where it is lives in the router's
// own comments and is carried through as the "note" field, so the explanation
// sits next to the code it describes and cannot drift from it either.
//
// The same argument applies to payloads, which is what schemagen adds upstream:
// the request struct, the statuses a handler can emit and the literal refusals
// it can return are read out of the handler, so "what do I send" is answered by
// the code that decides it rather than by a table somebody remembered to edit.

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'docs/api/reference')

const doc = JSON.parse(readFileSync(join(root, 'routes.json'), 'utf8'))
const models = doc.models ?? {}

/*
 * How a caller proves who it is, per scheme, extracted upstream from the code
 * that checks it.
 *
 * Hand-written the first time round, and two of the three names were wrong —
 * X-CertPilot-Agent-Id for X-CertPilot-Agent, and an invented enrolment-token
 * header for what is actually a body field. A wrong header is worse than a
 * missing one: it fails as a 403 about key material, so the reader debugs
 * their signature rather than their spelling.
 */
const AUTH = doc.auth_schemes ?? {}

/*
 * The hand-written prose, synced from docs/api-reference.md by sync-guides.mjs.
 *
 * The route table answers "what exists and who may call it" and is generated so
 * it cannot go stale. The schema tables answer "what do I send and what comes
 * back". Neither reaches the things only a person knows: that a CSR is the
 * better pattern because the key then never moves, or which of two endpoints
 * you actually want.
 *
 * So each page carries all three. Missing prose is not an error — a resource
 * with no guide yet renders exactly as it did before.
 */
const guidesDir = join(root, 'guides')
const guides = new Map()
if (existsSync(guidesDir)) {
  for (const file of readdirSync(guidesDir)) {
    if (!file.endsWith('.md')) continue
    guides.set(file.replace(/\.md$/, ''), readFileSync(join(guidesDir, file), 'utf8'))
  }
}

/** Sections in the order a reader meets the product, not alphabetically. */
const ORDER = [
  'Health',
  'Dashboard',
  'Live event stream',
  'Certificates',
  'PKI / CA Management',
  'CA Accounts & Gateways',
  'Renewal queue',
  'Deployment',
  'Discovery',
  'Certificate Transparency',
  'Cloud inventory',
  'Agents',
  'The agent API',
  'Notification channels',
  'Custom metadata fields',
  'Policies',
  'Display Tokens',
]

// Alphabetical order puts DELETE above GET, so a resource reads as though it
// is destroyed before it is fetched. Order by what a caller does, not by ASCII.
const METHOD_ORDER = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']

const BASE_URL = 'https://certpilot.example.com'

const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Roles that clear a gate. Admin passes everything — see RequireRole. */
function whoCanCall(route) {
  if (route.auth === 'none') return 'Public — no credential'
  if (route.auth === 'agent-enrolment-token') return 'Enrolment token'
  if (route.auth === 'agent-signature') return 'Enrolled agent'
  switch (route.min_role) {
    case 'viewer': return 'Any authenticated user'
    case 'operator': return 'Operator, admin'
    case 'admin': return 'Admin'
    default: return route.min_role ?? '—'
  }
}

const escapePipes = (s) => (s ?? '').replace(/\|/g, '\\|')

/** A model gets a link only if its fields were actually captured. */
function typeLink(type) {
  const bare = type.replace(/\[\]$/, '')
  if (!models[bare]) return `\`${type}\``
  return `[\`${type}\`](/api/reference/models#${slug(bare)})`
}

// ── Schema rendering ──────────────────────────────────────────────────────

/*
 * The required column appears only when something in the table is required.
 *
 * Response objects have no binding tags at all, so on the objects page it was
 * an empty strip down the middle of every table — a column asking a question
 * that does not apply to what it was ruling on.
 */
function fieldTable(fields) {
  const required = fields.some((f) => f.required)
  const lines = []
  lines.push(required ? '| Field | Type | | Description |' : '| Field | Type | Description |')
  lines.push(required ? '|:--|:--|:--|:--|' : '|:--|:--|:--|')
  for (const f of fields) {
    const notes = []
    if (f.constraint) notes.push(f.constraint)
    if (f.value) notes.push(`always \`${f.value}\``)
    const description = [escapePipes(f.doc), ...notes.map(escapePipes)]
      .filter(Boolean)
      .join(' — ')
    const cells = [`\`${f.name}\``, typeLink(f.type)]
    if (required) cells.push(f.required ? '**required**' : '')
    cells.push(description)
    lines.push(`| ${cells.join(' | ')} |`)
  }
  return lines
}

function renderRequest(request) {
  const lines = []
  lines.push('#### Request body')
  lines.push('')
  if (request.doc) {
    lines.push(request.doc)
    lines.push('')
  }
  if (request.fields.length === 0) {
    lines.push('No documented fields.')
    lines.push('')
    return lines
  }
  lines.push(...fieldTable(request.fields))
  lines.push('')
  return lines
}

function renderParameters(route) {
  const rows = []
  for (const name of route.path_params ?? []) {
    rows.push(`| \`${name}\` | path | **required** | |`)
  }
  for (const q of route.query_params ?? []) {
    rows.push(`| \`${q.name}\` | query | | ${q.default ? `\`${q.default}\`` : ''} |`)
  }
  if (rows.length === 0) return []
  return ['#### Parameters', '', '| Name | In | | Default |', '|:--|:--|:--|:--|', ...rows, '']
}

/** What a status actually means here, when the handler did not say so itself. */
const STATUS_TEXT = {
  200: 'Success',
  201: 'Created',
  202: 'Accepted — the work was queued, not completed',
  204: 'Success, no body',
  400: 'The request was rejected',
  401: 'No valid credential',
  403: 'Authenticated, but not permitted',
  404: 'No such record',
  409: 'Refused because of the current state',
  422: 'Understood, but not processable',
  429: 'Throttled',
  500: 'The core failed',
  501: 'Not implemented in this build',
  502: 'An upstream — a gateway or a CA — failed',
  503: 'A dependency is unavailable',
  504: 'An upstream timed out',
}

function describeBody(r) {
  if (r.model) return `A [\`${r.model}\`](/api/reference/models#${slug(r.model)}) object`
  if (r.shape === 'object' && r.keys?.length) {
    return (
      'An object with ' +
      r.keys
        .map((k) => `\`${k.name}\`${k.type && k.type !== 'any' ? ` (${typeLink(k.type)})` : ''}`)
        .join(', ')
    )
  }
  if (r.status >= 400) return '`{ "error": … }`'
  return ''
}

function renderResponses(responses) {
  const lines = ['#### Responses', '', '| Status | Body |', '|:--|:--|']
  for (const r of responses) {
    const parts = []
    const body = describeBody(r)
    if (body) parts.push(body)
    else if (STATUS_TEXT[r.status]) parts.push(STATUS_TEXT[r.status])
    // The literal refusals, verbatim. These are the strings a caller will
    // actually read, and they are the fastest route from "I got a 400" to
    // "I know why" — which is the whole question a status code cannot answer.
    if (r.errors?.length) {
      parts.push(r.errors.map((e) => `<br>· *${escapePipes(e)}*`).join(''))
    }
    lines.push(
      `| <code class="s s-${String(r.status)[0]}xx">${r.status}</code> | ${parts.join(' ')} |`,
    )
  }
  lines.push('')
  return lines
}

// ── Example ───────────────────────────────────────────────────────────────

/**
 * A placeholder, not an invented value.
 *
 * `"common_name": "app.example.com"` reads as a fact about the API and is not
 * one; `"<common_name>"` cannot be mistaken for anything but a slot to fill.
 */
function placeholder(field) {
  const type = field.type
  if (type.endsWith('[]')) return [placeholder({ ...field, type: type.slice(0, -2) })]
  switch (type) {
    case 'string': return `<${field.name}>`
    case 'integer': return 0
    case 'number': return 0
    case 'boolean': return false
    case 'timestamp': return '2026-01-01T00:00:00Z'
    case 'object': return {}
    case 'any': return null
    default: return `<${type}>`
  }
}

function renderExample(route) {
  const path = route.path.replace(/:(\w+)/g, '<$1>')
  const lines = [`curl -X ${route.method} '${BASE_URL}${path}' \\`]

  for (const h of AUTH[route.auth]?.headers ?? []) {
    lines.push(`  -H '${h.name}: ${h.value}' \\`)
  }

  if (route.request) {
    // Required fields first, topped up to a usable size from the optional
    // ones. Neither extreme is an example: thirty optional keys is a struct
    // dump, and POST /certificates has exactly one binding:"required" tag —
    // a body showing only ca_account_id is technically accurate and no help
    // to anybody trying to request a certificate.
    const required = route.request.fields.filter((f) => f.required)
    /*
     * Server-assigned fields are left out of the example, though not out of
     * the table above.
     *
     * Several handlers bind a whole store record — POST /policies binds
     * store.Policy — so `id` and the timestamps really are accepted, and the
     * field table says so because that is what the endpoint does. An example
     * is a suggestion rather than an inventory, and suggesting somebody post
     * an `id` and a `created_at` to a create endpoint is advice, not
     * documentation.
     */
    const assigned = new Set(['id', 'created_at', 'updated_at'])
    const optional = route.request.fields.filter(
      (f) => !f.required && !assigned.has(f.name),
    )
    const chosen = [...required, ...optional.slice(0, Math.max(0, 5 - required.length))]
    const body = {}
    for (const f of chosen) body[f.name] = placeholder(f)
    lines.push(`  -H 'Content-Type: application/json' \\`)
    lines.push(`  -d '${JSON.stringify(body, null, 2)}'`)
  } else {
    lines[lines.length - 1] = lines[lines.length - 1].replace(/ \\$/, '')
  }

  return [
    '::: details Example request',
    '```bash',
    ...lines.join('\n').split('\n'),
    '```',
    ':::',
    '',
  ]
}

// ── Pages ─────────────────────────────────────────────────────────────────

function renderRoute(route) {
  const lines = []
  lines.push(`### \`${route.method} ${route.path}\``)
  lines.push('')

  const facts = [
    ['Who can call it', whoCanCall(route)],
    ['Handler', route.handler ? `\`${route.handler}\`` : '_inline_'],
  ]
  if (route.auth === 'bearer') {
    facts.push([
      'Display token',
      route.display_token
        ? 'Readable by an unattended screen'
        : 'Refused — not a viewer-safe GET',
    ])
  }

  lines.push('| | |')
  lines.push('|:--|:--|')
  for (const [k, v] of facts) lines.push(`| ${k} | ${v} |`)
  lines.push('')

  if (route.note) {
    lines.push(route.note)
    lines.push('')
  }

  const authNote = AUTH[route.auth]?.note
  if (authNote) {
    lines.push(authNote)
    lines.push('')
  }

  lines.push(...renderParameters(route))
  if (route.request) lines.push(...renderRequest(route.request))
  if (route.responses?.length) lines.push(...renderResponses(route.responses))
  lines.push(...renderExample(route))

  return lines.join('\n')
}

function renderSection(section, routes) {
  const lines = []
  lines.push('---')
  lines.push(`title: ${section}`)
  lines.push('editLink: false')
  lines.push('---')
  lines.push('')
  lines.push(`# ${section}`)
  lines.push('')
  lines.push(
    '<!-- Generated by scripts/generate-endpoints.mjs from routes.json. -->',
  )
  /*
   * A quiet line, not a filled callout.
   *
   * This is a note to whoever edits the file, and it was rendering as the
   * largest element on the page directly under the title — the first thing a
   * reader met on their way to an endpoint was a box telling them how the page
   * is maintained.
   */
  lines.push(
    `<p class="gen-note">Generated from <code>${doc.source}</code>. ` +
      `Edit the router, not this file.</p>`,
  )
  lines.push('')

  lines.push('| Method | Path | Who can call it |')
  lines.push('|:--|:--|:--|')
  for (const r of routes) {
    lines.push(
      `| <code class="m m-${r.method.toLowerCase()}">${r.method}</code> | [\`${escapePipes(r.path)}\`](#${slug(
        r.method + ' ' + r.path,
      )}) | ${whoCanCall(r)} |`,
    )
  }
  lines.push('')

  /*
   * Order: the table, then the guide, then per-route detail.
   *
   * A reader scanning for an endpoint wants the table first and finds it at the
   * top of every page. A reader who does not yet know which endpoint they want
   * needs the prose, and it has to come before the route-by-route detail or it
   * sits below a screen of tables nobody scrolled past.
   */
  const guide = guides.get(slug(section))
  if (guide) {
    const body = guide.replace(/^<!--[\s\S]*?-->\n*/, '').trim()
    if (body) {
      lines.push(body)
      lines.push('')
      lines.push('## Endpoint detail')
      lines.push('')
    }
  }

  for (const r of routes) lines.push(renderRoute(r))
  return lines.join('\n')
}

/**
 * One page for the objects the API returns.
 *
 * Without it every response table ends at "a Certificate object" and the
 * reader has to go and read Go to find out what is in one.
 */
function renderModels() {
  const names = Object.keys(models).sort()
  const lines = []
  lines.push('---')
  lines.push('title: Objects')
  lines.push('editLink: false')
  lines.push('---')
  lines.push('')
  lines.push('# Objects')
  lines.push('')
  lines.push('<!-- Generated by scripts/generate-endpoints.mjs from routes.json. -->')
  lines.push(
    `<p class="gen-note">Generated from the record definitions in <code>${doc.source.replace(/api\/router\.go$/, 'store')}</code>. ` +
      `Edit the code, not this file.</p>`,
  )
  lines.push('')
  lines.push(
    'The shapes the API returns. Every field a record carries is listed, ' +
      'including the ones an individual endpoint leaves null.',
  )
  lines.push('')

  for (const name of names) {
    const model = models[name]
    lines.push(`## ${name}`)
    lines.push('')
    if (model.doc) {
      lines.push(model.doc)
      lines.push('')
    }
    if (model.fields.length === 0) {
      lines.push('_No serialised fields._')
      lines.push('')
      continue
    }
    lines.push(...fieldTable(model.fields))
    lines.push('')
  }
  return lines.join('\n')
}

rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

const bySection = new Map()
for (const r of doc.routes) {
  const key = r.section || 'Other'
  if (!bySection.has(key)) bySection.set(key, [])
  bySection.get(key).push(r)
}

for (const routes of bySection.values()) {
  routes.sort(
    (a, b) =>
      a.path.localeCompare(b.path) ||
      METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method),
  )
}

// A section present in the data but missing from ORDER would otherwise be
// dropped from the sidebar without anyone noticing.
const unordered = [...bySection.keys()].filter((s) => !ORDER.includes(s))
const sections = [...ORDER.filter((s) => bySection.has(s)), ...unordered.sort()]

const sidebar = []
for (const section of sections) {
  const routes = bySection.get(section)
  writeFileSync(join(outDir, `${slug(section)}.md`), renderSection(section, routes))
  sidebar.push({ text: section, link: `/api/reference/${slug(section)}`, count: routes.length })
}

writeFileSync(join(outDir, 'models.md'), renderModels())

writeFileSync(
  join(root, 'docs/.vitepress/sidebar-generated.json'),
  JSON.stringify(sidebar, null, 2) + '\n',
)

// ── Census ────────────────────────────────────────────────────────────────
//
// The figures the home page quotes about this API.
//
// They are emitted here rather than typed into `index.md` because they had
// already gone stale: the page advertised "109 endpoints" against a router that
// serves 111. A number a reader can check against the table below it is worse
// than no number at all, and hand-maintained counts drift the moment somebody
// adds a route — the same failure the generated tables exist to prevent.
const methodCounts = {}
for (const r of doc.routes) methodCounts[r.method] = (methodCounts[r.method] ?? 0) + 1

const census = {
  routeCount: doc.route_count,
  sectionCount: sections.length,
  roles: doc.roles,
  methods: METHOD_ORDER.filter((m) => methodCounts[m]).map((m) => ({
    method: m,
    count: methodCounts[m],
  })),
  // Endpoints an unattended wall screen may read. Worth stating plainly: it is
  // the one credential in the product that is deliberately weaker than a person.
  displayTokenReadable: doc.routes.filter((r) => r.display_token).length,
  documentedBodies: doc.routes.filter((r) => r.request).length,
  modelCount: Object.keys(models).length,
  source: doc.source,
  sections: sections.map((s) => ({ text: s, count: bySection.get(s).length })),
}

writeFileSync(
  join(root, 'docs/.vitepress/census-generated.json'),
  JSON.stringify(census, null, 2) + '\n',
)

const covered = sections.reduce((n, s) => n + bySection.get(s).length, 0)
if (covered !== doc.route_count) {
  console.error(`generate-endpoints: ${covered} of ${doc.route_count} routes rendered`)
  process.exit(1)
}
console.log(
  `generate-endpoints: ${covered} routes across ${sections.length} pages, ` +
    `${census.documentedBodies} request bodies, ${census.modelCount} objects`,
)
