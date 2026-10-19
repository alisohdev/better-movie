package catalog

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"bettermovie/internal/dbgen"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

const Revision = "synthetic-v1"

var (
	ErrNotFound = errors.New("movie not found")
	ErrRevision = errors.New("catalog revision is not ready")
)

const (
	AcquireTimeout = time.Second
	QueryTimeout   = 2 * time.Second
)

type Store struct {
	pool     *pgxpool.Pool
	revision string
}

func NewStore(pool *pgxpool.Pool) *Store { return &Store{pool: pool, revision: Revision} }

func NewStoreAtRevision(pool *pgxpool.Pool, revision string) *Store {
	return &Store{pool: pool, revision: revision}
}
func (s *Store) CatalogRevision() string { return s.revision }

func (s *Store) acquire(ctx context.Context) (*pgxpool.Conn, error) {
	bounded, cancel := context.WithTimeout(ctx, AcquireTimeout)
	defer cancel()
	return s.pool.Acquire(bounded)
}

func (s *Store) Health(ctx context.Context) error {
	conn, err := s.acquire(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()
	bounded, cancel := context.WithTimeout(ctx, QueryTimeout)
	defer cancel()
	revision, err := dbgen.New(conn).GetCatalogRevision(bounded)
	if err != nil {
		return err
	}
	if revision != s.revision {
		return ErrRevision
	}
	if s.revision != Revision {
		ready, e := dbgen.New(conn).StagingReady(bounded)
		if e != nil || !ready {
			return ErrRevision
		}
	}
	return nil
}

// read keeps the revision, total and page in a single consistent snapshot.
func (s *Store) read(ctx context.Context, fn func(context.Context, *dbgen.Queries) error) error {
	conn, err := s.acquire(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()
	bounded, cancel := context.WithTimeout(ctx, QueryTimeout)
	defer cancel()
	tx, err := conn.BeginTx(bounded, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return err
	}
	defer func() {
		cleanup, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		_ = tx.Rollback(cleanup)
	}()
	queries := dbgen.New(tx)
	revision, err := queries.GetCatalogRevision(bounded)
	if err != nil {
		return err
	}
	if revision != s.revision {
		return ErrRevision
	}
	if s.revision != Revision {
		ready, e := queries.StagingReady(bounded)
		if e != nil || !ready {
			return ErrRevision
		}
	}
	if err = fn(bounded, queries); err != nil {
		return err
	}
	return tx.Commit(bounded)
}

func (s *Store) Search(ctx context.Context, f Filter) (Page, error) {
	page := Page{Items: []Movie{}, Page: f.Page, PageSize: PageSize, CatalogRevision: s.revision}
	params := dbgen.CountMoviesParams{
		Languages: append([]string{}, f.Languages...), Countries: append([]string{}, f.Countries...), RatingMin: floatParam(f.RatingMin), VoteCountMin: intParam(f.VoteCountMin),
		IncludeGenres: append([]string{}, f.Genres...), GenreMode: f.GenreMode,
		ExcludeGenres: append([]string{}, f.ExcludeGenres...),
		YearMin:       intParam(f.YearMin), YearMax: intParam(f.YearMax),
		RuntimeMin: intParam(f.RuntimeMin), RuntimeMax: intParam(f.RuntimeMax),
	}
	err := s.read(ctx, func(ctx context.Context, queries *dbgen.Queries) error {
		var err error
		page.Total, err = queries.CountMovies(ctx, params)
		if err != nil {
			return err
		}
		rows, err := queries.ListMovies(ctx, dbgen.ListMoviesParams{
			Languages: params.Languages, Countries: params.Countries, RatingMin: params.RatingMin, VoteCountMin: params.VoteCountMin,
			IncludeGenres: params.IncludeGenres, GenreMode: params.GenreMode,
			ExcludeGenres: params.ExcludeGenres, YearMin: params.YearMin, YearMax: params.YearMax,
			RuntimeMin: params.RuntimeMin, RuntimeMax: params.RuntimeMax,
			SortKey: f.Sort, PageOffset: (f.Page - 1) * PageSize,
		})
		if err != nil {
			return err
		}
		for _, row := range rows {
			movie, err := movieFromRow(row.Movie, row.Genres)
			if err != nil {
				return err
			}
			page.Items = append(page.Items, movie)
		}
		if s.revision != Revision {
			pointers := []*Movie{}
			for i := range page.Items {
				pointers = append(pointers, &page.Items[i])
			}
			return loadExtras(ctx, queries, pointers)
		}
		return nil
	})
	return page, err
}

func (s *Store) Detail(ctx context.Context, id string) (Detail, error) {
	result := Detail{CatalogRevision: s.revision}
	err := s.read(ctx, func(ctx context.Context, queries *dbgen.Queries) error {
		row, err := queries.GetMovie(ctx, id)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return err
		}
		result.Movie, err = movieFromRow(row.Movie, row.Genres)
		if err == nil && s.revision != Revision {
			return loadExtras(ctx, queries, []*Movie{&result.Movie})
		}
		return err
	})
	return result, err
}

func movieFromRow(row dbgen.Movie, genres []string) (Movie, error) {
	observations := []ReleaseObservation{}
	if err := json.Unmarshal(row.ReleaseObservations, &observations); err != nil {
		return Movie{}, err
	}
	return Movie{
		ID: row.ID, TitleEn: row.TitleEn, TitleFa: nullable(row.TitleFa.String, row.TitleFa.Valid),
		OriginalTitle: row.OriginalTitle, SynopsisEn: row.SynopsisEn, SynopsisFa: nullable(row.SynopsisFa.String, row.SynopsisFa.Valid),
		Year: nullable(row.Year.Int32, row.Year.Valid), Runtime: nullable(row.Runtime.Int32, row.Runtime.Valid),
		Rating: nullable(row.Rating.Float64, row.Rating.Valid), VoteCount: nullable(row.VoteCount.Int32, row.VoteCount.Valid),
		Popularity: row.Popularity, Genres: append([]string{}, genres...),
		OriginalLanguage: nullable(row.OriginalLanguage.String, row.OriginalLanguage.Valid), Countries: append([]string{}, row.Countries...),
		Poster: row.Poster, Source: row.Source, Synthetic: row.Synthetic, ReleaseObservations: observations,
	}, nil
}

func nullable[T any](value T, valid bool) *T {
	if !valid {
		return nil
	}
	return &value
}

func intParam(value *int32) pgtype.Int4 {
	if value == nil {
		return pgtype.Int4{}
	}
	return pgtype.Int4{Int32: *value, Valid: true}
}

func textParam(value *string) pgtype.Text {
	if value == nil {
		return pgtype.Text{}
	}
	return pgtype.Text{String: *value, Valid: true}
}

func floatParam(value *float64) pgtype.Float8 {
	if value == nil {
		return pgtype.Float8{}
	}
	return pgtype.Float8{Float64: *value, Valid: true}
}

func loadExtras(ctx context.Context, q *dbgen.Queries, movies []*Movie) error {
	ids := []string{}
	byID := map[string]*Movie{}
	for _, movie := range movies {
		ids = append(ids, movie.ID)
		byID[movie.ID] = movie
	}
	rows, err := q.GetMovieExtras(ctx, ids)
	if err != nil {
		return err
	}
	if len(rows) != len(movies) {
		return ErrRevision
	}
	for _, row := range rows {
		movie := byID[row.MovieID]
		movie.Aliases = row.Aliases
		var p Provenance
		if json.Unmarshal(row.Provenance, &p) != nil {
			return ErrRevision
		}
		movie.Provenance = &p
	}
	return nil
}
