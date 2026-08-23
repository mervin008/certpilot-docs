# Conventions

## List responses

Collections come back in an envelope with the total alongside the page:

```json
{
  "data": [ … ],
  "total": 342
}
```

`total` is the count *before* `limit` and `offset` are applied, so a client can
show "25 of 342" without a second request.

## Pagination

```
?limit=100&offset=0
```

Defaults vary by endpoint — 100 on most collections, 25 on discovery scans.
There is no maximum, and no cursor pagination. On an estate of thousands of
certificates, ask for what you will display.

## Unrecognised query parameters

On `GET /certificates` and `POST /pki/authorities/import`, an unrecognised
query parameter is a **400 that names it**, rather than being silently ignored.

```json
{
  "error": "\"search\" is not a filter this endpoint understands, and returning every certificate instead of the ones you asked for would be worse than refusing. Supported: status, environment, common_name, ca_account_id, limit, offset"
}
```

This is not pedantry, and it was paid for. A cleanup script asked for
`?search=rollout.step3.example.com`, a parameter the handler had never read. The
filter was dropped, the list came back as the whole estate, and the loop
deleting what it matched deleted everything.

A narrowing parameter that silently does not narrow turns a specific request
into "all rows" — harmless on a `GET` a person reads, destructive the moment
anything acts on the result.

::: warning The guard is not universal
`GET /certificates` is the only listing endpoint that validates its query
parameters. The other 42 `GET` routes ignore what they do not recognise.

**If you are writing a script that deletes or modifies based on a filtered
list, check that the filter narrowed the result before acting on it** — do not
assume the parameter was honoured.
:::

`display_token` is exempt from this check everywhere, because it is a
credential rather than a filter.

## Filters that exist

| Endpoint | Parameters |
|:--|:--|
| `GET /certificates` | `status`, `environment`, `common_name`, `ca_account_id`, `limit`, `offset` |
| `POST /pki/authorities/import` | `account` |

## Identifiers

All `:id` path parameters are UUIDs, except where a route names something else
explicitly (`:bindingId` on certificate target bindings).

## Timestamps

RFC 3339, UTC.

```json
{ "not_after": "2026-11-04T09:15:00Z" }
```

## Prefer `days_remaining` over computing it

Several resources carry both `not_after` and `days_remaining`. **Use
`days_remaining`.** The core is the authority on how far away an expiry is, and
recomputing it client-side from `not_after` produces a figure that disagrees
with the one driving alerting — which is how two panels end up disagreeing about
whether a CA is in trouble.

## PEM in JSON

Certificate and chain material is returned as PEM inside JSON strings, with
literal `\n` escapes. Concatenate leaf-then-issuers for a full chain; the API
does not assemble one for you.
