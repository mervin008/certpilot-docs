# CertPilot API documentation

The public API reference for [CertPilot](https://github.com/mervin008/pki_project),
built with [VitePress](https://vitepress.dev) and published to GitHub Pages.

**https://mervin008.github.io/certpilot-docs/**

## Why this repo exists separately

The documentation site has a different release cadence, a different audience,
and a different toolchain from the Go control plane. Keeping it here means a
typo fix does not rebuild six Go modules, and the docs can be deployed without
shipping a release of CertPilot.

## One-time setup

Pages has to be switched on by hand before the first deploy can succeed:

**Settings → Pages → Build and deployment → Source: _GitHub Actions_**

The workflow cannot do this for itself. Creating a Pages site requires
repository-admin rights, and `GITHUB_TOKEN` is an app installation token that
cannot hold them — it fails with *"Resource not accessible by integration"*. If
you fork or recreate this repository, expect the first deploy to fail until you
have done the above, then re-run it.

## The route table is generated

The endpoint pages under `docs/api/reference/` are **generated**, not written.
They come from `routes.json`, which is extracted from `core/api/router.go` in
the CertPilot repository by `scripts/extract-routes.py` over there.

That matters because a hand-maintained route table has exactly one failure mode
and it is silent: somebody adds a route, forgets the docs, and the reference is
quietly wrong for six months. Here a missing route is impossible — the table is
the router.

The generated pages are gitignored. Reviewing a diff of machine output on every
route change is noise, and it invites editing the output instead of the source.

```
core/api/router.go            ← the truth
  └─ scripts/extract-routes.py
       └─ docs/routes.json    ← committed in the CertPilot repo
            └─ routes.json    ← vendored here, refreshed by `npm run sync`
                 └─ docs/api/reference/*.md   ← generated at build time
```

The router's own comments explain why each endpoint is gated where it is, and
those are carried through as prose on each route. **Edit the router, not the
generated page.**

## The prose is vendored too

The route table answers "what exists and who may call it". It does not answer
"what do I send", which is the question a reader actually arrives with, and no
amount of generating gets you there from a router: that `common_name` and
`csr_pem` are mutually exclusive is a fact about the handler, not the route.

That explanation was already written, in `docs/api-reference.md` in the code
repository, where it was readable only by somebody who had cloned the code --
precisely the audience that needs it least. `scripts/sync-guides.mjs` splits
that file on its H2 headings into `guides/`, one fragment per resource, and
`generate-endpoints.mjs` sets each fragment beside the route table for the same
resource. A reader gets the table and the examples on one page.

```bash
npm run sync:guides                # refresh from the default branch
npm run sync:guides -- --check     # exit 1 if stale (CI runs this)

# Author the prose in the code repository, then sync from a local checkout:
CERTPILOT_GUIDE_PATH=../pki_project/docs/api-reference.md npm run sync:guides
```

**Edit `docs/api-reference.md` in the code repository, not `guides/`.** The
fragments carry a header saying so, and CI fails if they drift.

Three transformations happen on the way in, all because a document written to
live in one repository does not survive being published from another:

- **Headings are promoted one level.** They sat under an H2 for the resource;
  here the resource is the H1, so they belong at H2. Demoting them instead put
  every one at H4, and this site's outline is configured for levels 2 and 3, so
  ninety lines per page had no table-of-contents entry at all.
- **Repository-relative links become GitHub URLs.** `../pkg/agentauth` resolved
  to a real directory in the code repository and to nothing here.
- **Anchors into skipped sections are repointed**, via `ANCHOR_TO_PAGE`. An
  unlisted one is a hard error rather than a guess.

The opening ASCII route listing in each source section is dropped, because the
generated table sits directly above it saying the same thing with roles filled
in and paths linked, and the ASCII one is the copy that can be wrong.

Sections with no matching route section are reported and skipped. Today that is
none; `Health`, `Sign-in discovery`, `The caller's own identity`, `The agent
API` and `Custom metadata fields` have no prose in the source yet, so those
pages render as they always did.

## Working on it

```bash
npm install
npm run dev      # generate pages, then serve with hot reload
npm run build    # generate, then build to docs/.vitepress/dist
npm run preview  # serve the built site
```

| Command | What it does |
|:--|:--|
| `npm run gen` | Regenerate the endpoint pages from `routes.json` |
| `npm run sync` | Refresh `routes.json` from the CertPilot repository |
| `npm run check` | Fail if any route is undocumented or any anchor is broken |

Hand-written pages live in `docs/api/` — authentication, roles, conventions,
errors, the event stream, and display tokens. Those are prose and are meant to
be edited directly.

## Keeping it in sync

`npm run sync` fetches `routes.json` from the CertPilot repository's default
branch. A scheduled workflow runs it weekly and opens a pull request when the
API has changed, so a new endpoint shows up here without anyone remembering to
push it.

`npm run sync -- --check` exits non-zero if the vendored copy is stale, which is
what CI runs on a pull request.

## Conventions

British spelling. Prose explains **why**, not what — matching the codebase it
documents. Errors and security properties are described in terms of the failure
they prevent, because that is what makes them stick.
