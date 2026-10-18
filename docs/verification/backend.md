# Backend verification

Verified locally on October 18, 2026 with Go 1.27.1 and PostgreSQL 18.6. The module declares Go 1.25. A separate loopback-only database on port 55432 was used; the pre-existing PostgreSQL service was not modified.

## Checks performed

`go test ./... -count=1` passed with `TEST_DATABASE_URL` set. All five packages containing tests passed, including the real SQL cases. `go vet ./...` passed. Running sqlc 1.31.1 again produced identical SHA-256 hashes for every generated Go binding.

The tests exercise include-any/include-all genres, exclusions, inclusive year/runtime bounds, missing values, stable null-last sorting, pagination, canonical transport validation, duplicate and unknown parameters, safe error responses, and detail-not-found behavior. Integration cases use isolated schemas in PostgreSQL. They compare returned records with the owned fixture, repeat migration/seed operations, exercise failed-seed rollback and revision mismatch, and verify request cancellation under a database lock. Vercel adapter cases verify reserved route restoration and preservation of public query parameters locally.

Runtime requests read PostgreSQL. There is no in-memory production fallback. Search obtains revision, count, and page in one bounded repeatable-read transaction. It uses generated parameterized sqlc queries, a pool of at most two connections with zero minimum connections, a one-second acquire limit, and a two-second query context. Plaintext database transport is limited to explicit local development; remote configuration requires verified TLS.

## Real query-plan observations

`go test ./internal/catalog -run TestPostgresQueryPlans -count=1 -v` passed. The test executes the actual generated count and list SQL through pgx, asserts successful nonempty results and correct totals, then records `EXPLAIN (ANALYZE, BUFFERS)` against the same parameters. Raw output is generated locally at ignored `.local/sql-plans.txt`.

| Query | Asserted result | Planning time | Execution time |
| --- | --- | --- | --- |
| Baseline popularity count | 32 total | 0.235 ms | 0.057 ms |
| Baseline popularity page | 12 returned | 0.381 ms | 0.362 ms |
| All drama/romance, exclude horror, year 1990–2026, runtime at most 120: count | 2 total | 0.490 ms | 0.421 ms |
| Same constraints: page sorted newest | 2 returned | 0.596 ms | 0.598 ms |

These are single warm post-seed observations of a 32-film functional fixture on the local workstation. Shared buffers were hits. The planner chose sequential scans and small sorts, which do not establish an indexing problem at this size. They show that the intended SQL ran successfully, not production throughput, scaling, or an end-to-end latency guarantee. No Redis, external search service, or speculative index was added based on these numbers.

## Limits

Remote Vercel routing, the actual Go runtime limit, Neon TLS and connection reuse, cloud cold starts, free-account eligibility, GitHub Actions execution, and Iranian-network access remain unverified. The Go adapter tests cannot prove the hosting platform's rewrite behavior. Reproduce the remote checks in the [deployment instructions](../deployment/vercel-neon.md) before claiming deployed compatibility.

## Remote follow-up

The earlier remote limitations describe the original local milestone. See [October 18 remote verification](remote-2026-10-18.md) for the subsequent committed Preview, Actions, browser checks, measurements, and remaining gaps.
