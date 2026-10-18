package catalog

import (
	"errors"
	"slices"
)

var genreSlugs = []string{
	"action", "adventure", "animation", "comedy", "documentary", "drama",
	"horror", "mystery", "romance", "science-fiction", "thriller",
}

func KnownGenre(slug string) bool { return slices.Contains(genreSlugs, slug) }

type Filter struct {
	Genres        []string
	ExcludeGenres []string
	GenreMode     string
	YearMin       *int32
	YearMax       *int32
	RuntimeMin    *int32
	RuntimeMax    *int32
	Sort          string
	Page          int32
}

func DefaultFilter() Filter {
	return Filter{Genres: []string{}, ExcludeGenres: []string{}, GenreMode: "any", Sort: "popularity", Page: 1}
}

// Validate enforces the public filter domain before a query reaches SQL.
func (f Filter) Validate() error {
	if f.GenreMode != "any" && f.GenreMode != "all" {
		return errors.New("genreMode must be any or all.")
	}
	for _, group := range [][]string{f.Genres, f.ExcludeGenres} {
		seen := make(map[string]bool, len(group))
		for _, genre := range group {
			if !KnownGenre(genre) {
				return errors.New("Genres must use the supported genre slugs.")
			}
			if seen[genre] {
				return errors.New("A genre may occur only once in each list.")
			}
			seen[genre] = true
		}
	}
	for _, genre := range f.Genres {
		if slices.Contains(f.ExcludeGenres, genre) {
			return errors.New("A genre cannot be both included and excluded.")
		}
	}
	if !validRange(f.YearMin, f.YearMax, 1888, 2100) {
		return errors.New("Years must be within 1888 through 2100, with minimum no greater than maximum.")
	}
	if !validRange(f.RuntimeMin, f.RuntimeMax, 1, 600) {
		return errors.New("Runtime must be within 1 through 600, with minimum no greater than maximum.")
	}
	switch f.Sort {
	case "popularity", "rating", "newest", "runtime":
	default:
		return errors.New("sort must be popularity, rating, newest, or runtime.")
	}
	if f.Page < 1 || f.Page > 10000 {
		return errors.New("page must be within 1 through 10000.")
	}
	return nil
}

func validRange(minimum, maximum *int32, low, high int32) bool {
	return (minimum == nil || (*minimum >= low && *minimum <= high)) &&
		(maximum == nil || (*maximum >= low && *maximum <= high)) &&
		(minimum == nil || maximum == nil || *minimum <= *maximum)
}
