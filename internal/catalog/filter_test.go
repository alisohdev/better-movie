package catalog_test

import (
	"testing"

	"bettermovie/internal/catalog"
)

func number(value int32) *int32 { return &value }

func TestFilterDomain(t *testing.T) {
	for _, test := range []struct {
		name   string
		change func(*catalog.Filter)
		valid  bool
	}{
		{"default", func(*catalog.Filter) {}, true},
		{"all known genres", func(f *catalog.Filter) { f.Genres = []string{"drama", "science-fiction"}; f.GenreMode = "all" }, true},
		{"inclusive boundaries", func(f *catalog.Filter) {
			f.YearMin = number(1888)
			f.YearMax = number(2100)
			f.RuntimeMin = number(1)
			f.RuntimeMax = number(600)
			f.Page = 10000
		}, true},
		{"unknown genre", func(f *catalog.Filter) { f.Genres = []string{"western"} }, false},
		{"unknown excluded genre", func(f *catalog.Filter) { f.ExcludeGenres = []string{"western"} }, false},
		{"duplicate genre", func(f *catalog.Filter) { f.Genres = []string{"drama", "drama"} }, false},
		{"genre conflict", func(f *catalog.Filter) { f.Genres = []string{"drama"}; f.ExcludeGenres = []string{"drama"} }, false},
		{"unsupported genre mode", func(f *catalog.Filter) { f.GenreMode = "either" }, false},
		{"year below range", func(f *catalog.Filter) { f.YearMin = number(1887) }, false},
		{"year above range", func(f *catalog.Filter) { f.YearMax = number(2101) }, false},
		{"inverted year", func(f *catalog.Filter) { f.YearMin = number(2025); f.YearMax = number(2020) }, false},
		{"runtime below range", func(f *catalog.Filter) { f.RuntimeMin = number(0) }, false},
		{"runtime above range", func(f *catalog.Filter) { f.RuntimeMax = number(601) }, false},
		{"inverted runtime", func(f *catalog.Filter) { f.RuntimeMin = number(100); f.RuntimeMax = number(90) }, false},
		{"unsupported sort", func(f *catalog.Filter) { f.Sort = "random" }, false},
		{"page zero", func(f *catalog.Filter) { f.Page = 0 }, false},
		{"page over limit", func(f *catalog.Filter) { f.Page = 10001 }, false},
	} {
		t.Run(test.name, func(t *testing.T) {
			f := catalog.DefaultFilter()
			test.change(&f)
			if (f.Validate() == nil) != test.valid {
				t.Fatal("filter domain did not enforce the published boundary")
			}
		})
	}
}
