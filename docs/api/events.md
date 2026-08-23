# Event stream

```
GET /api/v1/events
Accept: text/event-stream
```

Server-Sent Events, not WebSockets: the traffic is one-way, it survives
proxies, and browsers reconnect on their own.

Any authenticated reader may watch. The stream carries CA and certificate state
— never secrets, and never actor identity.

## What arrives

The connection opens with a `retry:` directive and a **`snapshot`** event
carrying current dashboard statistics and a CA summary per authority, so a
client never renders from an empty store.

```
event: ca.expiry_alert
id: 42
data: {"id":42,"topic":"ca.expiry_alert","severity":"CRITICAL","entity_id":"…","payload":{…}}
```

A `: heartbeat` comment every 15 seconds keeps intermediaries from reaping the
connection — and lets a client tell *"nothing is happening"* from *"I have
stopped receiving"*, which on a wall display is the difference that matters.

## Topics

`ca.health` · `ca.expiry_alert` · `cert.issued` · `cert.renewed` ·
`cert.renewal_failed` · `cert.expiring` · `gateway.status`

Severity is `INFO`, `WARNING` or `CRITICAL`.

## Reconnecting

Clients send `Last-Event-ID` (or `?last_event_id=`) and are replayed from that
point.

When the gap is larger than the broker's history, or a client falls behind
mid-stream, the server sends **`event: resync`** followed by a fresh snapshot
rather than deltas onto a stale base. A dashboard that looks live and is wrong
is worse than one that admits it lost its place.

The snapshot deliberately omits `certificate_pem`: it is kilobytes per CA, it is
re-sent on every resync, and no dashboard uses it.

## Slow consumers are dropped, not waited for

Each subscription has a bounded buffer. When it fills, the oldest events are
dropped and the subscription is marked lossy — which is what triggers the
`resync` above.

A wall display on a flaky link must never apply backpressure to the CA health
sweep. Monitoring that can be stalled by the screen displaying it is not
monitoring.

## Behind a reverse proxy

Buffering must be off for this route, or the stream arrives in chunks and the
display looks frozen while being perfectly healthy.

```nginx
location /api/v1/events {
    proxy_pass http://core:8080;
    proxy_buffering off;
    proxy_read_timeout 24h;
}
```

The handler also sends `X-Accel-Buffering: no` as belt and braces.

::: tip Verify it, don't assume it
```bash
curl -N -H 'Accept: text/event-stream' \
     -H "Authorization: Bearer $TOKEN" \
     https://certpilot.example.com/api/v1/events
```
It must stay open past 30 seconds and emit heartbeats. A stream that closes at
exactly 30 seconds means a write timeout is still in force somewhere in front
of it.
:::
