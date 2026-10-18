-- name: CountMovies :one
SELECT count(*) FROM movies m
WHERE (
    cardinality(sqlc.arg(include_genres)::text[]) = 0
    OR (sqlc.arg(genre_mode)::text = 'any' AND EXISTS (
        SELECT 1 FROM movie_genres mg
        WHERE mg.movie_id = m.id AND mg.genre_slug = ANY(sqlc.arg(include_genres)::text[])
    ))
    OR (sqlc.arg(genre_mode)::text = 'all' AND NOT EXISTS (
        SELECT 1 FROM unnest(sqlc.arg(include_genres)::text[]) AS wanted(slug)
        WHERE NOT EXISTS (
            SELECT 1 FROM movie_genres mg
            WHERE mg.movie_id = m.id AND mg.genre_slug = wanted.slug
        )
    ))
)
AND NOT EXISTS (
    SELECT 1 FROM movie_genres excluded
    WHERE excluded.movie_id = m.id AND excluded.genre_slug = ANY(sqlc.arg(exclude_genres)::text[])
)
AND (sqlc.narg(year_min)::integer IS NULL OR m.year >= sqlc.narg(year_min)::integer)
AND (sqlc.narg(year_max)::integer IS NULL OR m.year <= sqlc.narg(year_max)::integer)
AND (sqlc.narg(runtime_min)::integer IS NULL OR m.runtime >= sqlc.narg(runtime_min)::integer)
AND (sqlc.narg(runtime_max)::integer IS NULL OR m.runtime <= sqlc.narg(runtime_max)::integer);

-- name: ListMovies :many
SELECT sqlc.embed(m), ARRAY(
    SELECT mg.genre_slug FROM movie_genres mg WHERE mg.movie_id = m.id ORDER BY mg.position
)::text[] AS genres
FROM movies m
WHERE (
    cardinality(sqlc.arg(include_genres)::text[]) = 0
    OR (sqlc.arg(genre_mode)::text = 'any' AND EXISTS (
        SELECT 1 FROM movie_genres mg
        WHERE mg.movie_id = m.id AND mg.genre_slug = ANY(sqlc.arg(include_genres)::text[])
    ))
    OR (sqlc.arg(genre_mode)::text = 'all' AND NOT EXISTS (
        SELECT 1 FROM unnest(sqlc.arg(include_genres)::text[]) AS wanted(slug)
        WHERE NOT EXISTS (
            SELECT 1 FROM movie_genres mg
            WHERE mg.movie_id = m.id AND mg.genre_slug = wanted.slug
        )
    ))
)
AND NOT EXISTS (
    SELECT 1 FROM movie_genres excluded
    WHERE excluded.movie_id = m.id AND excluded.genre_slug = ANY(sqlc.arg(exclude_genres)::text[])
)
AND (sqlc.narg(year_min)::integer IS NULL OR m.year >= sqlc.narg(year_min)::integer)
AND (sqlc.narg(year_max)::integer IS NULL OR m.year <= sqlc.narg(year_max)::integer)
AND (sqlc.narg(runtime_min)::integer IS NULL OR m.runtime >= sqlc.narg(runtime_min)::integer)
AND (sqlc.narg(runtime_max)::integer IS NULL OR m.runtime <= sqlc.narg(runtime_max)::integer)
ORDER BY
    CASE WHEN sqlc.arg(sort_key)::text = 'popularity' THEN m.popularity END DESC NULLS LAST,
    CASE WHEN sqlc.arg(sort_key)::text = 'rating' THEN m.rating END DESC NULLS LAST,
    CASE WHEN sqlc.arg(sort_key)::text = 'newest' THEN m.year END DESC NULLS LAST,
    CASE WHEN sqlc.arg(sort_key)::text = 'runtime' THEN m.runtime END ASC NULLS LAST,
    m.id ASC
LIMIT 12 OFFSET sqlc.arg(page_offset)::integer;

-- name: GetMovie :one
SELECT sqlc.embed(m), ARRAY(
    SELECT mg.genre_slug FROM movie_genres mg WHERE mg.movie_id = m.id ORDER BY mg.position
)::text[] AS genres
FROM movies m WHERE m.id = $1;
