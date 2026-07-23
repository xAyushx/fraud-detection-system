# Fraud Detection Engine

A real-time, in-memory fraud detection API for financial transactions. Every transaction is scored synchronously against a sliding-window velocity/travel check and a directed-graph cycle check before the response is sent — no database read or write sits in that path. Flagged transactions are persisted afterward and streamed live to a browser dashboard over Server-Sent Events.

```
generator.js  --POST /transaction-->  Express server (server.js)
                                          |
                          +---------------+----------------+
                          |               |                 |
                 SlidingWindowEngine  GraphEngine      (per-account FastQueue
                 (Haversine +         (cycle detect    history, one per
                  velocity check)      + prevention)    accountId)
                          |               |
                          +-------+-------+
                                  |
                          flags[] + score
                                  |
                     res.json() sent IMMEDIATELY  <-- hot path ends here
                                  |
                     (fire-and-forget, NOT awaited)
                          +-------+-------+
                          |               |
                  broadcast()        Alert.create()
                  (SSE to any        (Mongoose write,
                   open /stream       non-blocking,
                   clients)           failure is caught
                                      & logged, never
                                      thrown)
```

## Features

- **In-memory detection, zero DB calls on the hot path.** `SlidingWindowEngine` and `GraphEngine` run pure, synchronous, in-process computation. Measured engine-only latency: **p50 0.088ms, p99 0.276ms** over 50,000 simulated transactions (see [Performance](#performance)).
- **Custom `FastQueue`** — an object-index-pointer queue (not `array.shift()`) used both for per-account transaction history and for the graph engine's edge-eviction order, giving O(1) enqueue/dequeue instead of the O(n) cost of shifting a real array.
- **Impossible-travel detection** — Haversine distance between an account's last known city and its current one, divided by elapsed time; flags if implied speed exceeds 1200 km/h.
- **Velocity-burst detection** — flags an account with more than 4 transactions in a rolling 10-second window.
- **Money-laundering cycle detection** — models transactions with a `toAccountId` as directed edges and runs a depth-first reachability check (explicit stack, not BFS) before adding a new edge; if adding it would close a cycle (e.g. A→B→C→A), the edge is rejected and the transaction is flagged instead.
- **Live dashboard** — `public/dashboard.html`, a single self-contained HTML/JS page that connects to `/stream` via `EventSource` and renders flagged transactions in real time, with a distinct visual treatment for replayed history vs. live pushes.
- **Durable audit trail** — every flagged transaction is persisted to MongoDB via Mongoose, asynchronously, after the response has already been sent. A dead or unreachable database degrades gracefully: the server logs the failure and keeps serving requests, it never crashes or blocks on it.

## Tech stack

Node.js (ESM, `"type": "module"`), Express 5, MongoDB via Mongoose.

## Project structure

```
fraud-engine/
├── package.json
├── server.js                    # Express app entry point; the hot path lives here
├── db.js                        # Mongo connection helper; never crashes the server if DB is unreachable
├── models/
│   └── Alert.js                 # Mongoose schema for the persisted audit trail
├── engine/
│   ├── GraphEngine.js            # Directed-graph cycle detection / laundering-loop prevention
│   ├── FastQueue.js              # Custom O(1) queue (object-pointer based)
│   └── SlidingWindowEngine.js    # Haversine impossible-travel + velocity-burst detection
├── public/
│   └── dashboard.html            # Live SSE dashboard, served statically by Express
└── scripts/
    └── generator.js               # Synthetic traffic generator; injects normal traffic
                                    # plus deliberate velocity bursts, impossible-travel
                                    # pairs, and laundering cycles for testing/demo
```

## Getting started

```bash
npm install
```

Set `MONGO_URI` if you're not running Mongo locally on the default port:

```bash
export MONGO_URI="mongodb://127.0.0.1:27017/fraud_engine"   # this is also the default if unset
```

Start MongoDB (`mongod`, or point `MONGO_URI` at Atlas), then:

```bash
node server.js
```

You should see:
```
[MongoDB] connected -> mongodb://127.0.0.1:27017/fraud_engine
Fraud Engine running on port 3000
```
If Mongo isn't reachable, the second line still prints — the server starts and serves requests regardless, it just won't persist alerts until the DB comes back. This is intentional (see [Design notes](#design-notes)).

Open the dashboard at **http://localhost:3000/dashboard.html**. (OR just rename dashboard to public and use **http://localhost:3000**)

Generate live traffic in a second terminal:
```bash
node scripts/generator.js
```

### API

| Method | Path | Description |
|---|---|---|
| `POST` | `/transaction` | Scores a transaction. Body: `{ txId, accountId, amount, city, timestamp, toAccountId? }`. `toAccountId` is optional — only present transfers are checked for laundering cycles. Returns `{ verdict, score, flags }` where `verdict` is `ALLOW`, `REVIEW` (score ≥ 50), or `BLOCK` (score ≥ 100). |
| `GET` | `/stream` | Server-Sent Events. Replays the last 20 alerts on connect (tagged `type: "HISTORY"`), then pushes new flagged alerts live (tagged `type: "ALERT"`) as they happen. |
| `GET` | `/alerts?limit=&verdict=` | Recent flagged alerts from the in-memory log (capped at 200), optionally filtered by verdict. |
| `GET` | `/alerts/history?accountId=&verdict=&limit=` | Same, but queried from MongoDB — the durable, unbounded history rather than the in-memory cache. Returns `503` if the database is unreachable. |
| `GET` | `/stats` | Running counters: total received/flagged/blocked/review, per-rule hit counts, flag rate, uptime, connected SSE clients, tracked accounts. |
| `GET` | `/health` | Liveness check. |

### Scoring

| Rule | Score |
|---|---|
| `HIGH_VELOCITY` (>4 tx in 10s) | +50 |
| `IMPOSSIBLE_TRAVEL` (>1200 km/h implied) | +60 |
| `LAUNDERING_CYCLE` (would close a directed cycle) | +100 |

`score ≥ 100` → `BLOCK`, `score ≥ 50` → `REVIEW`, otherwise `ALLOW`. Only non-`ALLOW` verdicts are logged, broadcast over SSE, and persisted.

## Design notes

- **Fire-and-forget persistence is deliberate, not an oversight.** The Mongo write for a flagged alert starts *after* `res.json()` has already been called, and its promise is never awaited by the request — a failure is caught and logged, never re-thrown into the request path. This is what makes "no database queries in the hot path" literally true.
- **Per-account isolation.** Each `accountId` gets its own `FastQueue` of recent transactions in `server.js`'s `accountHistories` map, so one account's velocity or travel pattern can never affect another account's flags.
- **Cycle check runs before the edge is added.** `GraphEngine.processTransaction()` checks reachability first; if adding the new edge would close a cycle, the edge is rejected outright rather than added-then-flagged.
- **Graph edge cleanup assumes roughly non-decreasing timestamps.** Stale-edge eviction pops from the front of an insertion-ordered queue and stops at the first non-stale edge, giving O(1) amortized cleanup — but this only holds if transactions arrive in roughly chronological order. Wildly out-of-order timestamps would require a min-heap keyed by timestamp instead.
- **SSE client list is a plain in-memory array** — single-process only, no pub/sub layer. Fine for this scale; wouldn't survive being horizontally scaled across multiple server instances without a shared broker (e.g. Redis pub/sub).

## Performance

Two different numbers, measured two different ways — worth keeping separate:

**Detection engine only** (`SlidingWindowEngine.analyze()` + `GraphEngine.processTransaction()`, no HTTP/JSON/network involved), 50,000 iterations after a 2,000-iteration warmup:

| Metric | Value |
|---|---|
| Mean | 0.098 ms |
| p50 | 0.088 ms |
| p95 | 0.216 ms |
| p99 | 0.276 ms |
| Max | 1.565 ms |

**Full HTTP round trip** (`autocannon`, 10 concurrent connections, 15s, real Express + JSON parsing + OS network stack), 12,032 successful requests, 0 errors:

| Metric | Value |
|---|---|
| Mean | 11.94 ms |
| p50 | 11 ms |
| p97.5 | 25 ms |
| p99 | 28 ms |
| Max | 89 ms |

The detection logic itself is comfortably sub-millisecond. The full HTTP request is not — the gap is Express routing, JSON body parsing, and the network stack, not the fraud-detection code.

## Known limitations

- **`FastQueue` is a queue, not a deque** — it supports `enqueue`/`dequeue`/`peekFront`/`peekBack` but has no `enqueueFront`/`dequeueBack`. Worth being precise about this if it comes up.
- **No automated test suite.** Correctness has been verified by manual/scripted runs against a live server, not by a CI-runnable test suite.
- **Minimal input validation** — `/transaction` checks that required fields are present but doesn't validate types or sane ranges (e.g. a negative `amount` would be accepted).
- **No authentication** on any endpoint.
- **`accountHistories` (in `server.js`) never evicts account keys**, only trims each account's queue contents by time window. With a small fixed pool of accounts this is invisible; with unbounded account creation over a long-running process it would grow without bound.
- **The MongoDB alert collection has no retention policy** — every flagged alert is kept forever. Appropriate for an audit trail, but worth knowing if running the traffic generator unattended for long periods.

## Scripts

- `node server.js` — start the server.
- `node scripts/generator.js` — generate continuous synthetic traffic against a running server, including periodic velocity bursts, impossible-travel pairs, and laundering cycles, for demos and testing.