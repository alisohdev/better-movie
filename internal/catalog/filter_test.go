package catalog_test

import (
	"math"
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
		{"unknown genre", func(f *catalog.Filter) { f.Genres = []string{"not-a-genre"} }, false},
		{"unknown excluded genre", func(f *catalog.Filter) { f.ExcludeGenres = []string{"not-a-genre"} }, false},
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

func TestAdvancedFilterDomain(t *testing.T) {
	for _, n := range []float64{0, 10, 8.25, -0.1, 10.1, math.NaN(), math.Inf(1), math.Inf(-1)} {
		f := catalog.DefaultFilter()
		f.RatingMin = &n
		want := !math.IsNaN(n) && !math.IsInf(n, 0) && n >= 0 && n <= 10
		if (f.Validate() == nil) != want {
			t.Fatalf("invalid score boundary %v", n)
		}
	}
	for _, test := range []struct {
		codes []string
		valid bool
	}{
		{[]string{"en", "fa"}, true}, {[]string{"en", "en"}, false}, {[]string{""}, false}, {[]string{"xx"}, false},
	} {
		f := catalog.DefaultFilter()
		f.Languages = test.codes
		if (f.Validate() == nil) != test.valid {
			t.Fatalf("invalid languages %v", test.codes)
		}
	}
	for _, test := range []struct {
		codes []string
		valid bool
	}{
		{[]string{"IR", "US"}, true}, {[]string{"IR", "IR"}, false}, {[]string{""}, false}, {[]string{"ZZ"}, false},
	} {
		f := catalog.DefaultFilter()
		f.Countries = test.codes
		if (f.Validate() == nil) != test.valid {
			t.Fatalf("invalid countries %v", test.codes)
		}
	}
	f := catalog.DefaultFilter()
	f.VoteCountMin = number(-1)
	if f.Validate() == nil {
		t.Fatal("negative votes accepted")
	}
	for _, n := range []int32{0, 2147483647} {
		f.VoteCountMin = &n
		if f.Validate() != nil {
			t.Fatal("inclusive votes rejected")
		}
	}
}
