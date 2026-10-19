package httpapi

import (
	"context"
	"net/http"
	"os"
	"sync"

	"bettermovie/internal/catalog"
	"bettermovie/internal/database"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Runtime reuses one lazy pool per process. A failed initialization is retried
// on the next request; a connection failure is recovered by pgxpool itself.
type Runtime struct {
	mu      sync.Mutex
	handler http.Handler
	pool    *pgxpool.Pool
}

func NewFromEnvironment() *Runtime { return &Runtime{} }

func (rt *Runtime) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	rt.mu.Lock()
	if rt.handler == nil {
		revision := os.Getenv("CATALOG_REVISION")
		if revision == "" {
			revision = catalog.Revision
		}
		var pool *pgxpool.Pool
		var err error
		if revision == catalog.Revision {
			pool, err = database.Open(context.Background(), os.Getenv("DATABASE_URL"))
		} else if catalog.ValidTMDBRevision(revision) && (os.Getenv("VERCEL") == "" || os.Getenv("TMDB_PUBLICATION_APPROVED") == "1") {
			config, e := database.Config(os.Getenv("TMDB_STAGING_DATABASE_URL"))
			err = e
			if err == nil {
				config.ConnConfig.RuntimeParams["search_path"] = catalog.StagingSchema(revision)
				pool, err = pgxpool.NewWithConfig(context.Background(), config)
			}
		}
		if err == nil && pool != nil {
			rt.pool = pool
			rt.handler = New(catalog.NewStoreAtRevision(pool, revision))
		}
	}
	handler := rt.handler
	rt.mu.Unlock()
	if handler == nil {
		writeError(w, r, http.StatusServiceUnavailable, "service_unavailable", "The catalog is temporarily unavailable.")
		return
	}
	handler.ServeHTTP(w, r)
}

func (rt *Runtime) Close() {
	rt.mu.Lock()
	defer rt.mu.Unlock()
	if rt.pool != nil {
		rt.pool.Close()
		rt.pool = nil
		rt.handler = nil
	}
}
