-- name: SetCatalogRevision :exec
INSERT INTO catalog_metadata (singleton, revision) VALUES (true, $1)
ON CONFLICT (singleton) DO UPDATE SET revision = EXCLUDED.revision;

-- name: UpsertGenre :exec
INSERT INTO genres (slug) VALUES ($1) ON CONFLICT (slug) DO NOTHING;

-- name: UpsertMovie :exec
INSERT INTO movies (
    id, title_en, title_fa, original_title, synopsis_en, synopsis_fa,
    year, runtime, rating, vote_count, popularity, original_language,
    countries, poster, source, synthetic, release_observations
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
ON CONFLICT (id) DO UPDATE SET
    title_en = EXCLUDED.title_en, title_fa = EXCLUDED.title_fa,
    original_title = EXCLUDED.original_title, synopsis_en = EXCLUDED.synopsis_en,
    synopsis_fa = EXCLUDED.synopsis_fa, year = EXCLUDED.year,
    runtime = EXCLUDED.runtime, rating = EXCLUDED.rating,
    vote_count = EXCLUDED.vote_count, popularity = EXCLUDED.popularity,
    original_language = EXCLUDED.original_language, countries = EXCLUDED.countries,
    poster = EXCLUDED.poster, source = EXCLUDED.source, synthetic = EXCLUDED.synthetic,
    release_observations = EXCLUDED.release_observations;

-- name: DeleteAbsentMovies :exec
DELETE FROM movies WHERE NOT (id = ANY($1::text[]));

-- name: ClearMovieGenres :exec
DELETE FROM movie_genres WHERE movie_id = $1;

-- name: AddMovieGenre :exec
INSERT INTO movie_genres (movie_id, genre_slug, position) VALUES ($1, $2, $3);
