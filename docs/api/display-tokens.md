# Unattended screens

A display token authenticates a wall display. It is not a second way to
authenticate as a user, and it is deliberately weaker than one.

```http
X-Display-Token: cpd_<43 characters>
```

## What the middleware guarantees

Three properties are enforced centrally, in the middleware that resolves the
token, rather than route by route — because a rule that has to be remembered at
every call site is a rule that will eventually be forgotten at one.

| | |
|:--|:--|
| **Role** | Always `viewer`. Not configurable, not derived from any input |
| **Methods** | `GET` only. Anything else is 403, on every route |
| **Refused paths** | `/private-key`, `/display-tokens`, `/dashboard/activity` — refused by path, independently of their own role gate |

The path refusals are a second, independent barrier. The role gate on those
routes already stops a viewer; if a future change loosens one of those gates, a
credential sitting on an unattended screen still cannot reach it.

### Why each path is refused

- **`/private-key`** — removing a private key from the system's custody is the
  single most sensitive operation the API has.
- **`/display-tokens`** — a kiosk enumerating kiosk credentials is the pivot
  that turns one leaked screen token into knowledge of every other screen.
- **`/dashboard/activity`** — the activity feed carries actor identity.
  "alice@example.com deleted a certificate" is not something to put on a screen
  in a corridor.

## What it can reach

**38 of the 43 `GET` endpoints.** Everything that carries CA health, certificate
state, deployment status and fleet inventory — the things a monitoring screen
exists to show.

Browse the [endpoint reference](/api/reference/dashboard); each route states
whether a display token may read it.

## Lifecycle

Tokens expire — **90 days by default, 365 maximum** — are revocable, and record
`last_seen_at` and `last_seen_ip`, so a credential in use somewhere unexpected
is visible.

The raw token is shown **once**, at creation. Only a SHA-256 hash is stored, and
comparison is constant-time.

Creating and revoking are admin-only and audited.

## Presenting it

Prefer the header. The query-string form exists solely for `EventSource`, which
has no way to send one:

```
GET /api/v1/events?display_token=cpd_...
```

It is the weaker channel — query strings reach access logs, `Referer` headers
and browser history — which is why the request logger redacts the parameter,
and why this credential grants nothing but read access in the first place.

CertPilot's own frontend streams over `fetch` so that it can use the header.

## Failure behaviour

A token that is unknown, revoked or expired is a **401**, and does *not* fall
through to anonymous access. That matters: with anonymous access enabled for
local evaluation, falling through would hand a rejected token an admin identity.

The rejection is logged with the reason — revoked, expired, unknown — but the
caller learns only that it failed. An operator needs to know a revoked screen is
still calling; the caller does not need to know which of the three it was.
