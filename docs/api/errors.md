# Errors

Every error has the same shape:

```json
{ "error": "human-readable description" }
```

| Code | Meaning |
|:--|:--|
| `400` | Malformed request, an unrecognised query parameter, or a gateway rejected the configuration |
| `401` | Missing, malformed, invalid, or expired credential |
| `403` | Role not permitted, or the request was blocked by a policy |
| `404` | Not found |
| `500` | Internal failure — including "the policy engine could not be consulted", which fails closed |
| `502` | The gateway is unreachable, failed, or returned something invalid |
| `503` | Gateway health check failed |

## 403 means two different things

A 403 is either *your role is too low* or *a policy refused this*. The message
distinguishes them, and the policy case is worth reading carefully — a policy
refusal names the rule that fired.

## 500 on a policy failure is deliberate

If the policy engine cannot be consulted, the request fails with a 500 rather
than proceeding unchecked. Issuing a certificate that policy might have refused,
because policy was unavailable, is the worse outcome.

## Errors are written for 2am

CertPilot's error strings name the cause rather than the symptom, because the
person reading them is usually reading them at the worst possible time. An
error that says a signature is invalid will also say what that implies:

> the signing request's signature is not valid, so it does not prove possession
> of the private key

If you are wrapping this API, preserve the message. It is the most useful thing
in the response.
