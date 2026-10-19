package tmdb

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"time"

	"bettermovie/internal/catalog"
	"bettermovie/internal/testdb"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPostgresStagingRevisionAndRollback(t *testing.T) {
	original := testdb.Open(t)
	ctx := context.Background()
	s := selection()
	c := fakeClient(t, func(*http.Request) (int, string, http.Header, error) { return 200, mockBody(s), nil, nil })
	_, a, err := Import(ctx, Mapping{Movies: []Selection{s}}, Checkpoint{}, c, 1, deadline(), time.Now(), nil)
	if err != nil {
		t.Fatal(err)
	}
	schema := Schema(a.CatalogRevision)
	t.Cleanup(func() {
		_, _ = original.Exec(ctx, "DROP SCHEMA IF EXISTS "+pgx.Identifier{schema}.Sanitize()+" CASCADE")
	})
	if err = Stage(ctx, original, *a); err != nil {
		t.Fatal("stage", err)
	}
	if err = Stage(ctx, original, *a); err != nil {
		t.Fatal("idempotent stage", err)
	}
	config := original.Config().Copy()
	config.ConnConfig.RuntimeParams["search_path"] = schema
	staged, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	defer staged.Close()
	store := catalog.NewStoreAtRevision(staged, a.CatalogRevision)
	if err = store.Health(ctx); err != nil {
		t.Fatal("staged health", err)
	}
	result, err := store.Search(ctx, catalog.DefaultFilter())
	if err != nil || result.Total != 1 || result.CatalogRevision != a.CatalogRevision || result.Items[0].Source != "TMDB" || result.Items[0].Provenance == nil {
		t.Fatal("staged search", err)
	}
	found, err := store.Lookup(ctx, "FixtureAlias")
	if err != nil || len(found.Items) != 1 {
		t.Fatal("aliases unavailable", err)
	}
	detail, err := store.Detail(ctx, result.Items[0].ID)
	if err != nil || detail.Movie.Provenance.ProviderID != s.TMDBID {
		t.Fatal("staged detail", err)
	}
	if _, err = catalog.NewStore(staged).Search(ctx, catalog.DefaultFilter()); !errors.Is(err, catalog.ErrRevision) {
		t.Fatal("synthetic revision accepted staged rows", err)
	}
	if _, err = catalog.NewStoreAtRevision(original, a.CatalogRevision).Search(ctx, catalog.DefaultFilter()); !errors.Is(err, catalog.ErrRevision) {
		t.Fatal("real revision accepted synthetic rows", err)
	}
	// Rollback is selection of the untouched original schema/revision, not destructive reseeding.
	old, err := catalog.NewStore(original).Search(ctx, catalog.DefaultFilter())
	if err != nil || old.Total != 32 || old.CatalogRevision != catalog.Revision || !old.Items[0].Synthetic {
		t.Fatal("original snapshot changed", err)
	}
	if _, err = staged.Exec(ctx, "UPDATE catalog_staging_manifest SET retain_until=CURRENT_DATE-1"); err != nil {
		t.Fatal(err)
	}
	if err = store.Health(ctx); !errors.Is(err, catalog.ErrRevision) {
		t.Fatal("expired stage served", err)
	}
	if err = Stage(ctx, original, *a); err == nil {
		t.Fatal("incomplete/expired revision overwritten")
	}
}

func TestPostgresInvalidArtifactCreatesNothing(t *testing.T) {
	pool := testdb.Open(t)
	a := Artifact{CatalogRevision: "tmdb-" + digest([]byte("[]")), SampleHash: SampleHash, Projection: "[]"}
	if err := Stage(context.Background(), pool, a); err == nil {
		t.Fatal("empty stage accepted")
	}
	var exists bool
	if err := pool.QueryRow(context.Background(), "SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname=$1)", Schema(a.CatalogRevision)).Scan(&exists); err != nil || exists {
		t.Fatal("invalid artifact left staging schema", err)
	}
}

func TestLegacySyntheticQueriesNeedNoStagingMigration(t *testing.T) {
	pool := testdb.Open(t)
	ctx := context.Background()
	if _, err := pool.Exec(ctx, "DROP TABLE movie_extras, catalog_staging_manifest"); err != nil {
		t.Fatal(err)
	}
	store := catalog.NewStore(pool)
	if err := store.Health(ctx); err != nil {
		t.Fatal(err)
	}
	page, err := store.Search(ctx, catalog.DefaultFilter())
	if err != nil || page.Total != 32 {
		t.Fatal("legacy search broken", err)
	}
	if _, err = store.Lookup(ctx, "paper"); err != nil {
		t.Fatal("legacy lookup broken", err)
	}
	if _, err = store.Detail(ctx, page.Items[0].ID); err != nil {
		t.Fatal("legacy detail broken", err)
	}
}
