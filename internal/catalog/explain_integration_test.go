package catalog_test

import (
	"context"
	"testing"
	"time"

	"bettermovie/internal/dbgen"
	"bettermovie/internal/testdb"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
)

type capturedQuery struct {
	dbgen.DBTX
	sql  string
	args []any
}

func (q *capturedQuery) Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
	q.sql, q.args = sql, args
	return q.DBTX.Exec(ctx, sql, args...)
}

func (q *capturedQuery) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	q.sql, q.args = sql, args
	return q.DBTX.Query(ctx, sql, args...)
}

func (q *capturedQuery) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	q.sql, q.args = sql, args
	return q.DBTX.QueryRow(ctx, sql, args...)
}

// This records real generated query plans on the functional fixture. It makes
// no throughput assertion and is not representative of a production catalog.
func TestPostgresQueryPlans(t *testing.T) {
	pool := testdb.Open(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	conn, err := pool.Acquire(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Release()
	if _, err := conn.Exec(ctx, "ANALYZE movies; ANALYZE movie_genres"); err != nil {
		t.Fatal(err)
	}
	var version string
	if err := conn.QueryRow(ctx, "SHOW server_version").Scan(&version); err != nil {
		t.Fatal(err)
	}
	t.Logf("Environment: PostgreSQL %s, local isolated schema, 32 synthetic movies; warm post-seed plans, no network or serverless throughput claim.", version)
	captured := &capturedQuery{DBTX: conn}
	queries := dbgen.New(captured)
	for _, test := range []struct {
		name   string
		params dbgen.ListMoviesParams
		total  int64
	}{
		{"advanced language country score votes", dbgen.ListMoviesParams{
			IncludeGenres: []string{}, ExcludeGenres: []string{}, GenreMode: "any", SortKey: "rating",
			Languages: []string{"fa", "en"}, Countries: []string{"IR", "US"},
			RatingMin: pgtype.Float8{Float64: 8, Valid: true}, VoteCountMin: pgtype.Int4{Int32: 200, Valid: true},
		}, 4},
		{"baseline popularity", dbgen.ListMoviesParams{IncludeGenres: []string{}, ExcludeGenres: []string{}, GenreMode: "any", SortKey: "popularity"}, 32},
		{"all genres plus exclusion and bounds", dbgen.ListMoviesParams{
			IncludeGenres: []string{"drama", "romance"}, ExcludeGenres: []string{"horror"}, GenreMode: "all", SortKey: "newest",
			YearMin: pgtype.Int4{Int32: 1990, Valid: true}, YearMax: pgtype.Int4{Int32: 2026, Valid: true},
			RuntimeMax: pgtype.Int4{Int32: 120, Valid: true},
		}, 2},
	} {
		t.Run(test.name, func(t *testing.T) {
			total, err := queries.CountMovies(ctx, dbgen.CountMoviesParams{
				Languages: test.params.Languages, Countries: test.params.Countries, RatingMin: test.params.RatingMin, VoteCountMin: test.params.VoteCountMin,
				IncludeGenres: test.params.IncludeGenres, GenreMode: test.params.GenreMode, ExcludeGenres: test.params.ExcludeGenres,
				YearMin: test.params.YearMin, YearMax: test.params.YearMax, RuntimeMin: test.params.RuntimeMin, RuntimeMax: test.params.RuntimeMax,
			})
			if err != nil || total != test.total {
				t.Fatalf("count returned %d, want %d; error=%v", total, test.total, err)
			}
			logPlan(t, ctx, conn, "count", captured.sql, captured.args)
			rows, err := queries.ListMovies(ctx, test.params)
			if err != nil || len(rows) == 0 {
				t.Fatalf("expected a successful nonempty list query: %v", err)
			}
			logPlan(t, ctx, conn, "page", captured.sql, captured.args)
		})
	}
}

func logPlan(t *testing.T, ctx context.Context, db dbgen.DBTX, label, sql string, args []any) {
	t.Helper()
	rows, err := db.Query(ctx, "EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) "+sql, args...)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	t.Log(label + " plan:")
	for rows.Next() {
		var line string
		if err := rows.Scan(&line); err != nil {
			t.Fatal(err)
		}
		t.Log(line)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
}
