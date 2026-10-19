package catalog

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"regexp"
	"time"

	"bettermovie/internal/dbgen"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Fixture struct {
	CatalogRevision string  `json:"catalogRevision"`
	Notice          string  `json:"notice"`
	Movies          []Movie `json:"movies"`
}

func ReadFixture(reader io.Reader) (Fixture, error) {
	var fixture Fixture
	limited := &io.LimitedReader{R: reader, N: (4 << 20) + 1}
	decoder := json.NewDecoder(limited)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&fixture); err != nil {
		return fixture, errors.New("fixture must be a valid catalog JSON document")
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		return fixture, errors.New("fixture must contain exactly one JSON document")
	}
	if limited.N == 0 {
		return fixture, errors.New("fixture exceeds the 4 MiB import bound")
	}
	return fixture, fixture.Validate()
}

var (
	movieID      = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)
	countryCode  = regexp.MustCompile(`^[A-Z]{2}$`)
	languageCode = regexp.MustCompile(`^[a-z]{2,3}$`)
)

func (f Fixture) Validate() error {
	if f.CatalogRevision != Revision || len(f.Movies) == 0 || len(f.Movies) > 10000 {
		return errors.New("fixture must contain a supported synthetic catalog revision and 1 through 10000 movies")
	}
	seen := make(map[string]bool, len(f.Movies))
	for _, movie := range f.Movies {
		if seen[movie.ID] {
			return errors.New("fixture contains duplicate movie IDs")
		}
		seen[movie.ID] = true
		if err := validateMovie(movie); err != nil {
			return fmt.Errorf("invalid movie %q: %w", movie.ID, err)
		}
	}
	return nil
}

func validateMovie(m Movie) error {
	if !movieID.MatchString(m.ID) || len(m.ID) > 100 || m.TitleEn == "" || m.OriginalTitle == "" || m.SynopsisEn == "" {
		return errors.New("a stable ID, English title, original title and English synopsis are required")
	}
	if !m.Synthetic || m.Source != "Synthetic studio" || m.Poster != "/posters/"+m.ID+".svg" {
		return errors.New("only owned synthetic movies with local posters can be seeded")
	}
	f := DefaultFilter()
	f.Genres = m.Genres
	f.YearMin, f.RuntimeMin = m.Year, m.Runtime
	if err := f.Validate(); err != nil {
		return err
	}
	if math.IsNaN(m.Popularity) || math.IsInf(m.Popularity, 0) || m.Popularity < 0 ||
		(m.Rating != nil && (math.IsNaN(*m.Rating) || *m.Rating < 0 || *m.Rating > 10)) ||
		(m.VoteCount != nil && *m.VoteCount < 0) {
		return errors.New("scores and vote counts are outside the supported range")
	}
	if m.Genres == nil || m.Countries == nil || m.ReleaseObservations == nil || len(m.Countries) > 16 || len(m.ReleaseObservations) > 16 {
		return errors.New("genres, countries and bounded release observations must be arrays")
	}
	if m.OriginalLanguage != nil && !languageCode.MatchString(*m.OriginalLanguage) {
		return errors.New("original language must be a language code or null")
	}
	for _, country := range m.Countries {
		if !countryCode.MatchString(country) {
			return errors.New("countries must use two-letter country codes")
		}
	}
	for _, observation := range m.ReleaseObservations {
		if observation.EventType != "theatrical" && observation.EventType != "digital" && observation.EventType != "physical" {
			return errors.New("release event type is unsupported")
		}
		if observation.Source != "Synthetic studio" || observation.Verification != "reported" || !countryCode.MatchString(observation.Country) {
			return errors.New("release observations must be reported synthetic examples")
		}
		if _, err := time.Parse(time.RFC3339, observation.CheckedAt); err != nil {
			return errors.New("release checkedAt must be an ISO timestamp")
		}
		if observation.Date != nil {
			if _, err := time.Parse(time.DateOnly, *observation.Date); err != nil {
				return errors.New("release date must be YYYY-MM-DD or null")
			}
		}
	}
	return nil
}

// Seed atomically replaces the owned synthetic snapshot. Repeating it converges
// to the same rows and genre order; it never reaches external providers.
func Seed(ctx context.Context, pool *pgxpool.Pool, fixture Fixture) error {
	if err := fixture.Validate(); err != nil {
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
	if err := WriteSnapshot(ctx, tx, fixture.Movies, fixture.CatalogRevision); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// WriteSnapshot writes a validated projection into the caller's transaction/schema.
// Seed validates ownership; TMDB staging validates the bounded private artifact.
func WriteSnapshot(ctx context.Context, tx pgx.Tx, movies []Movie, revision string) error {
	var err error
	queries := dbgen.New(tx)
	for _, genre := range genreSlugs {
		if err = queries.UpsertGenre(ctx, genre); err != nil {
			return err
		}
	}
	ids := make([]string, 0, len(movies))
	for _, movie := range movies {
		observations, err := json.Marshal(movie.ReleaseObservations)
		if err != nil {
			return err
		}
		if err = queries.UpsertMovie(ctx, dbgen.UpsertMovieParams{
			ID: movie.ID, TitleEn: movie.TitleEn, TitleFa: textParam(movie.TitleFa),
			OriginalTitle: movie.OriginalTitle, SynopsisEn: movie.SynopsisEn, SynopsisFa: textParam(movie.SynopsisFa),
			Year: intParam(movie.Year), Runtime: intParam(movie.Runtime), Rating: floatParam(movie.Rating),
			VoteCount: intParam(movie.VoteCount), Popularity: movie.Popularity,
			OriginalLanguage: textParam(movie.OriginalLanguage), Countries: movie.Countries,
			Poster: movie.Poster, Source: movie.Source, Synthetic: movie.Synthetic,
			ReleaseObservations: observations,
		}); err != nil {
			return err
		}
		if err = queries.ClearMovieGenres(ctx, movie.ID); err != nil {
			return err
		}
		for position, genre := range movie.Genres {
			if err = queries.AddMovieGenre(ctx, dbgen.AddMovieGenreParams{MovieID: movie.ID, GenreSlug: genre, Position: int16(position)}); err != nil {
				return err
			}
		}
		if movie.Provenance != nil {
			provenance, e := json.Marshal(movie.Provenance)
			if e != nil {
				return e
			}
			if e = queries.UpsertMovieExtras(ctx, dbgen.UpsertMovieExtrasParams{MovieID: movie.ID, Aliases: movie.Aliases, Provenance: provenance}); e != nil {
				return e
			}
		}
		ids = append(ids, movie.ID)
	}
	if err = queries.DeleteAbsentMovies(ctx, ids); err != nil {
		return err
	}
	if err = queries.SetCatalogRevision(ctx, revision); err != nil {
		return err
	}
	return nil
}
