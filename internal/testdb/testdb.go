// Package testdb isolates PostgreSQL integration tests from the running catalog.
package testdb

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"bettermovie/db"
	"bettermovie/internal/catalog"
	"bettermovie/internal/database"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func Fixture(t *testing.T) catalog.Fixture {
	t.Helper()
	_, file, _, _ := runtime.Caller(0)
	reader, err := os.Open(filepath.Join(filepath.Dir(file), "..", "..", "catalog", "movies.json"))
	if err != nil {
		t.Fatal("open owned fixture:", err)
	}
	defer reader.Close()
	fixture, err := catalog.ReadFixture(reader)
	if err != nil {
		t.Fatal("decode owned fixture:", err)
	}
	return fixture
}

// Open requires explicit TEST_DATABASE_URL. Only a random temporary schema is
// migrated and seeded; the public schema used by the app is never modified.
func Open(t *testing.T) *pgxpool.Pool {
	t.Helper()
	rawURL := os.Getenv("TEST_DATABASE_URL")
	if rawURL == "" {
		t.Skip("TEST_DATABASE_URL is unset; PostgreSQL integration test skipped")
	}
	config, err := database.Config(rawURL)
	if err != nil {
		t.Fatal("invalid integration database configuration")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	admin, err := pgx.ConnectConfig(ctx, config.ConnConfig.Copy())
	if err != nil {
		t.Fatal("unable to connect to integration database")
	}
	suffix := make([]byte, 8)
	if _, err = rand.Read(suffix); err != nil {
		t.Fatal(err)
	}
	schema := pgx.Identifier{"test_catalog_" + hex.EncodeToString(suffix)}.Sanitize()
	if _, err = admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		_ = admin.Close(ctx)
		t.Fatal("unable to create isolated integration schema")
	}
	var pool *pgxpool.Pool
	t.Cleanup(func() {
		if pool != nil {
			pool.Close()
		}
		cleanup, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if _, err := admin.Exec(cleanup, "DROP SCHEMA "+schema+" CASCADE"); err != nil {
			t.Error("unable to remove isolated integration schema")
		}
		_ = admin.Close(cleanup)
	})
	config.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err = pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal("unable to open isolated integration pool")
	}
	if err = db.Migrate(ctx, pool); err != nil {
		t.Fatal("migrate isolated schema:", err)
	}
	if err = catalog.Seed(ctx, pool, Fixture(t)); err != nil {
		t.Fatal("seed isolated schema:", err)
	}
	return pool
}
