CREATE TABLE catalog_metadata (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    revision text NOT NULL
);

CREATE TABLE movies (
    id text PRIMARY KEY CHECK (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    title_en text NOT NULL,
    title_fa text,
    original_title text NOT NULL,
    synopsis_en text NOT NULL,
    synopsis_fa text,
    year integer CHECK (year BETWEEN 1888 AND 2100),
    runtime integer CHECK (runtime BETWEEN 1 AND 600),
    rating double precision CHECK (rating BETWEEN 0 AND 10),
    vote_count integer CHECK (vote_count >= 0),
    popularity double precision NOT NULL CHECK (popularity >= 0 AND popularity < 'Infinity'::double precision),
    original_language text,
    countries text[] NOT NULL DEFAULT '{}',
    poster text NOT NULL,
    source text NOT NULL CHECK (source = 'Synthetic studio'),
    synthetic boolean NOT NULL CHECK (synthetic),
    release_observations jsonb NOT NULL DEFAULT '[]'::jsonb
        CHECK (jsonb_typeof(release_observations) = 'array' AND jsonb_array_length(release_observations) <= 16)
);

CREATE TABLE genres (
    slug text PRIMARY KEY CHECK (slug ~ '^[a-z]+(-[a-z]+)*$')
);

CREATE TABLE movie_genres (
    movie_id text NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    genre_slug text NOT NULL REFERENCES genres(slug),
    position smallint NOT NULL CHECK (position >= 0),
    PRIMARY KEY (movie_id, genre_slug),
    UNIQUE (movie_id, position)
);

CREATE INDEX movie_genres_genre_movie_idx ON movie_genres (genre_slug, movie_id);
CREATE INDEX movies_popularity_id_idx ON movies (popularity DESC, id);
