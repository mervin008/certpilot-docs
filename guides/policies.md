<!-- Synced from docs/api-reference.md in the CertPilot repository.
     Source heading: "Policies". Edit it there, not here. -->

Implemented rule types:

| `rule_type` | `rule_config` |
|:---|:---|
| `key_size` | `{"min_key_size": 2048}` — applies to RSA |
| `max_lifetime` | `{"max_days": 90}` |
| `ca_restriction` | `{"allowed_providers": ["acme", "vault"]}` |

`severity` is `INFO`, `WARNING`, or `BLOCK`. Only `BLOCK` refuses the request;
the rest are returned in the issuance response.

`domain_pattern` scopes a policy — `*` matches everything, `*.example.com`
matches any subdomain. A policy applies when **any** requested domain matches.

> `key_type`, `naming`, and `approval_required` are accepted by the schema but
> not implemented, so policies using them currently do nothing. Policy is
> evaluated on issuance only, not on renewal.
