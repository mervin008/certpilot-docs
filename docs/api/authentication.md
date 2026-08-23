# Authentication

## People and scripts

```http
Authorization: Bearer <token>
```

Tokens are verified against `auth.jwks_url` (preferred) or `auth.jwt_secret`
(a legacy shared secret). An invalid or expired token is **always** rejected —
there is no development mode in which a bad token is accepted.

### The token says who you are, not what you may do

The provider is the authority on identity. **CertPilot is the authority on
role**, and holds it in its own `users` table keyed on the pair
`(issuer, subject)`.

A token that asserts `certpilot_role: admin` does not get admin. The role that
governs a request is the one stored here, and a first sign-in is recorded as
`viewer` unless the address is listed in `auth.bootstrap_admins`.

This is deliberate. A team that owns the CA hierarchy rarely owns the identity
provider, and putting every promotion behind an Okta administrator means it
lands whenever that person's token next refreshes rather than when the decision
was made.

Two consequences worth planning for:

- **A sign-in never changes a role.** Removing an address from
  `bootstrap_admins` does not demote anybody, and adding one does not promote an
  existing account.
- **A subject is scoped to its issuer.** The same subject string from two
  providers is two different people. Changing `auth.issuer` creates new users
  rather than re-binding the old ones.

`GET /me` reports the stored role. Do not decode the token to decide what to
show — the API stops honouring a claim the moment somebody is demoted, and a UI
reading the claim would keep offering controls that now 403.

### Suspension

A user can be suspended in CertPilot. The provider still accepts them, so
sign-in succeeds and **every API request is refused with 403**. Suspension is
not deletion: the row stays so that the audit log attributing actions to that
subject continues to mean something.

### Subjects are opaque strings

A `sub` is not a UUID. OpenID Connect guarantees only that it is a
case-sensitive string of at most 255 ASCII characters, and real providers
differ widely:

| Provider | Example `sub` |
|:--|:--|
| Okta | `00u9vme99nxudvxZA0h7` |
| Google Workspace | `110169484474386276334` |
| Auth0 | `auth0\|507f1f77bcf86cd799439011` |
| Keycloak / Entra `oid` | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` |

CertPilot stores all of these as text, in `users` and in every actor column.

### Anonymous access

When `auth.allow_anonymous` is set, a request with **no** `Authorization` header
at all is treated as admin. It is refused unless the server is in development
mode on a loopback address.

Presenting a *broken* token is still a 401. The distinction matters: falling
through to admin on a rejected token would turn a failed login into a
privilege escalation.

## Unattended screens

A screen in a corridor has nobody to sign in at it, and leaving an operator
session logged in there would hand it the authority to issue, revoke, and export
private keys. A display token is a separate credential for exactly that case.

```http
X-Display-Token: cpd_<43 characters>
```

or, for clients that cannot set headers — `EventSource` is the one that matters —
in the query string:

```
GET /api/v1/events?display_token=cpd_...
```

**Prefer the header.** A query string reaches access logs, `Referer` headers,
and browser history. CertPilot's request logger redacts this parameter for that
reason, and CertPilot's own frontend streams over `fetch` so that it can use the
header instead.

See [Unattended screens](/api/display-tokens) for what a display token can and
cannot reach.

## Host agents

Agents authenticate by signing their requests, not by bearing a token. The agent
API is mounted as a separate group with its own middleware and shares none of
the human API's:

```
/api/v1/agent/*
```

Neither the bearer authenticator nor the display-token middleware runs on these
routes, and the agent authenticator runs nowhere else. That separation is the
point — an agent credential must not be usable to read the estate, and a
person's bearer token must not be usable to speak as a host.

`POST /api/v1/agent/enrol` is the one agent call that is not signed, because the
agent has no identity yet; this is the request that gives it one. It is
authenticated by a one-use enrolment token instead.

::: warning Replay window
There is no agent nonce store. Replay is bounded by the request timestamp only.
:::

## Precedence

A request carrying an `Authorization` header is **never** resolved as a display
token, whatever else it presents.

That ordering is what stops a token left in a bookmark from quietly masking an
operator's identity in the audit log — and it means an invalid bearer token
fails as an invalid bearer token, rather than being rescued by a display token
in the URL.
