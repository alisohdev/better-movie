-- name: UpsertMovieExtras :exec
INSERT INTO movie_extras (movie_id, aliases, provenance) VALUES ($1, $2, $3)
ON CONFLICT (movie_id) DO UPDATE SET aliases = EXCLUDED.aliases, provenance = EXCLUDED.provenance;

-- name: GetMovieExtras :many
SELECT movie_id, aliases, provenance FROM movie_extras WHERE movie_id = ANY($1::text[]);

-- name: SetStagingManifest :exec
INSERT INTO catalog_staging_manifest (singleton, movie_count, retain_until) VALUES (true, $1, $2);

-- name: StagingReady :one
SELECT EXISTS (
    SELECT 1 FROM catalog_staging_manifest
    WHERE movie_count = (SELECT count(*) FROM movies)
      AND movie_count = (SELECT count(*) FROM movie_extras)
      AND retain_until >= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date
)::boolean;
