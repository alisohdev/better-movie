-- name: LookupTitles :many
-- Normalize both the needle and each available title identically. No LIKE patterns:
-- strpos treats %, _ and quotes literally. C collation makes ASCII casing stable.
WITH titles AS (
    SELECT m.id, m.title_en, m.title_fa, m.original_title, m.year,
           alias.title
    FROM movies m
    CROSS JOIN LATERAL unnest(ARRAY[m.title_en, m.original_title, m.title_fa]) AS alias(title)
), normalized AS (
    SELECT id, title_en, title_fa, original_title, year,
           lower(regexp_replace(translate(title, 'يك', 'یک'),
               U&'[[:space:]\00A0\1680\2000-\200F\2028\2029\202F\205F\3000\0610-\061A\064B-\065F\0670\06D6-\06ED\0640]', '', 'g') COLLATE "C") AS title_key,
           lower(regexp_replace(translate(sqlc.arg(needle)::text, 'يك', 'یک'),
               U&'[[:space:]\00A0\1680\2000-\200F\2028\2029\202F\205F\3000\0610-\061A\064B-\065F\0670\06D6-\06ED\0640]', '', 'g') COLLATE "C") AS query_key
    FROM titles
), ranked AS (
    SELECT id, title_en, title_fa, original_title, year,
           min(CASE WHEN title_key = query_key THEN 0
                    WHEN strpos(title_key, query_key) = 1 THEN 1 ELSE 2 END)::integer AS rank
    FROM normalized
    WHERE query_key <> '' AND strpos(title_key, query_key) > 0
    GROUP BY id, title_en, title_fa, original_title, year
)
SELECT id, title_en, title_fa, original_title, year
FROM ranked
ORDER BY rank, id COLLATE "C"
LIMIT 6;
