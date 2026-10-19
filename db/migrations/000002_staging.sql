-- Applied automatically only inside a newly isolated TMDB staging schema.
-- Existing synthetic API queries remain compatible with migration 000001 alone.
ALTER TABLE movies DROP CONSTRAINT movies_source_check;
ALTER TABLE movies DROP CONSTRAINT movies_synthetic_check;
ALTER TABLE movies ADD CONSTRAINT movies_source_kind_check CHECK (
    (source = 'Synthetic studio' AND synthetic) OR (source = 'TMDB' AND NOT synthetic)
);
CREATE TABLE movie_extras (
    movie_id text PRIMARY KEY REFERENCES movies(id) ON DELETE CASCADE,
    aliases text[] NOT NULL DEFAULT '{}',
    provenance jsonb NOT NULL CHECK (jsonb_typeof(provenance) = 'object')
);
CREATE TABLE catalog_staging_manifest (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    movie_count integer NOT NULL CHECK (movie_count BETWEEN 1 AND 40),
    retain_until date NOT NULL
);
