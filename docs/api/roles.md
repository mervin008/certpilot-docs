# Roles and permissions

Four roles, in ascending order of privilege. **`admin` passes every check** —
a route gated at operator admits operators and admins, and nobody else.

| Role | Read | Issue / renew | Delete | Export private keys |
|:--|:-:|:-:|:-:|:-:|
| `admin` | ✅ | ✅ | ✅ | ✅ |
| `operator` | ✅ | ✅ | — | — |
| `auditor` | ✅ | — | — | — |
| `viewer` | ✅ | — | — | — |

`auditor` and `viewer` are currently equivalent at the route level. The
distinction exists so that audit-facing access can be separated later without
re-issuing everyone's tokens.

## How routes are gated

Of the 101 bearer-authenticated routes:

| Gate | Routes | Meaning |
|:--|--:|:--|
| None | 39 | Any authenticated user, which is `viewer` upwards |
| `RequireRole(operator)` | 39 | Operator or admin |
| `RequireRole(admin)` | 23 | Admin only |

A route with no gate is not an oversight — reading the estate is open to any
authenticated user by design. Certificate rows, CA health, deployment targets
and agent inventory all carry names and states, never key material.

## The line between read and write

The split is not simply "GET is safe". Several `POST` routes exist precisely
because the operation reaches out and changes something in the world, even
though the caller might think of it as a query:

- `POST /pki/authorities/:id/check` — asks the CA now. Reaching out to somebody
  else's CA is an action, not a read.
- `POST /certificates/:id/renewal-info` — the same, for one certificate.
- `POST /notification-channels/:id/test` — sends a real alert to a real
  destination.

## Why deletion is almost always admin

Deletion in CertPilot rarely means "remove a row". It usually means removing
something whose absence is invisible:

- Deleting a **deployment target** silently stops every certificate bound to it
  from being deployed anywhere, and renewals carry on looking healthy.
- Cancelling a **renewal** puts the certificate back to expiring on its own,
  with nothing scheduled to stop it.
- Deleting a **notification channel** silently stops alerts reaching whoever
  depended on it.

In each case the system continues to look fine. That is why the gate is higher
than the operation appears to warrant.

## Secrets are never serialised

Two fields are never included in any response, on any endpoint:

- `certificates.private_key_encrypted`
- `ca_accounts.config_encrypted`

Private keys are retrievable only through the dedicated export endpoint
(`GET /certificates/:id/private-key`), which is admin-only and writes an audit
record. **CA credentials are not retrievable at all** — supply a replacement
configuration instead.
