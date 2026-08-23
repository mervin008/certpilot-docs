# Authentication

## People and scripts

```http
Authorization: Bearer <token>
```

Tokens are verified against `auth.jwks_url` (preferred) or `auth.jwt_secret`
(a legacy shared secret). An invalid or expired token is **always** rejected —
there is no development mode in which a bad token is accepted.

The role is read from `app_metadata.certpilot_role`. It is read from
`app_metadata` rather than `user_metadata` for a specific reason: `user_metadata`
is writable by the user the token belongs to, so trusting it would let any
account promote itself to admin.

A token with no recognised role is treated as `viewer`, not rejected.

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
