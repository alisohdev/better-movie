package tmdb

import (
	"context"
	"errors"
	"time"

	"bettermovie/db"
	"bettermovie/internal/catalog"
	"bettermovie/internal/dbgen"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Stage never changes the caller's active/public tables. The schema and complete
// manifest appear in one commit. A completed content-addressed schema is immutable.
func Stage(ctx context.Context, pool *pgxpool.Pool, a Artifact) error {
	movies, err := a.Movies(time.Now())
	if err != nil {
		return err
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() {
		cleanup, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		_ = tx.Rollback(cleanup)
	}()
	if _, err = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(737421407)"); err != nil {
		return err
	}
	schema := Schema(a.CatalogRevision)
	var exists bool
	if err = tx.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname=$1)", schema).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		if _, err = tx.Exec(ctx, "CREATE SCHEMA "+pgx.Identifier{schema}.Sanitize()); err != nil {
			return err
		}
	}
	if _, err = tx.Exec(ctx, "SET LOCAL search_path TO "+pgx.Identifier{schema}.Sanitize()); err != nil {
		return err
	}
	if exists {
		q := dbgen.New(tx)
		revision, e := q.GetCatalogRevision(ctx)
		ready, e2 := q.StagingReady(ctx)
		if e != nil || e2 != nil || revision != a.CatalogRevision || !ready {
			return errors.New("existing staging schema is incomplete or expired")
		}
		return tx.Commit(ctx)
	}
	if err = db.MigrateTx(ctx, tx); err != nil {
		return err
	}
	if err = catalog.WriteSnapshot(ctx, tx, movies, a.CatalogRevision); err != nil {
		return err
	}
	until := movies[0].Provenance.RetainUntil
	for _, m := range movies {
		if m.Provenance.RetainUntil < until {
			until = m.Provenance.RetainUntil
		}
	}
	deadline, _ := time.Parse(time.DateOnly, until)
	if err = dbgen.New(tx).SetStagingManifest(ctx, dbgen.SetStagingManifestParams{MovieCount: int32(len(movies)), RetainUntil: pgtype.Date{Time: deadline, Valid: true}}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
