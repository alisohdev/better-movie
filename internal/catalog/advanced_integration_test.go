package catalog_test

import (
	"context"
	"slices"
	"testing"

	"bettermovie/internal/catalog"
	"bettermovie/internal/testdb"
)

// Compare every counted/listed ID to an independent fixture oracle, across all
// pages and sorts. The fixture includes unknown language, countries and scores.
func TestAdvancedPostgresFilters(t *testing.T) {
	pool := testdb.Open(t)
	store := catalog.NewStore(pool)
	fixture := testdb.Fixture(t)
	ctx := context.Background()
	score := func(n float64) *float64 { return &n }
	cases := []struct {
		name   string
		change func(*catalog.Filter)
	}{
		{"language", func(f *catalog.Filter) { f.Languages = []string{"fa"} }},
		{"any language", func(f *catalog.Filter) { f.Languages = []string{"fa", "en"} }},
		{"country", func(f *catalog.Filter) { f.Countries = []string{"IR"} }},
		{"any country with coproductions", func(f *catalog.Filter) { f.Countries = []string{"US", "GB"} }},
		{"score zero excludes unknown", func(f *catalog.Filter) { f.RatingMin = score(0) }},
		{"score decimal inclusive", func(f *catalog.Filter) { f.RatingMin = score(8.2) }},
		{"score ten empty", func(f *catalog.Filter) { f.RatingMin = score(10) }},
		{"votes zero excludes unknown", func(f *catalog.Filter) { f.VoteCountMin = number(0) }},
		{"votes inclusive", func(f *catalog.Filter) { f.VoteCountMin = number(205) }},
		{"votes maximum empty", func(f *catalog.Filter) { f.VoteCountMin = number(2147483647) }},
		{"all groups AND", func(f *catalog.Filter) {
			f.Languages = []string{"fa", "en"}
			f.Countries = []string{"IR", "US", "GB"}
			f.RatingMin = score(7)
			f.VoteCountMin = number(100)
			f.Genres = []string{"drama"}
			f.ExcludeGenres = []string{"horror"}
			f.GenreMode = "all"
			f.YearMin = number(2000)
			f.RuntimeMax = number(120)
		}},
		{"empty intersection", func(f *catalog.Filter) { f.Languages = []string{"ja"}; f.Countries = []string{"IR"} }},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			f := catalog.DefaultFilter()
			c.change(&f)
			want := []string{}
			for _, m := range fixture.Movies {
				if len(f.Languages) > 0 && (m.OriginalLanguage == nil || !slices.Contains(f.Languages, *m.OriginalLanguage)) {
					continue
				}
				if len(f.Countries) > 0 && !slices.ContainsFunc(m.Countries, func(c string) bool { return slices.Contains(f.Countries, c) }) {
					continue
				}
				if f.RatingMin != nil && (m.Rating == nil || *m.Rating < *f.RatingMin) {
					continue
				}
				if f.VoteCountMin != nil && (m.VoteCount == nil || *m.VoteCount < *f.VoteCountMin) {
					continue
				}
				if len(f.Genres) > 0 && !slices.Contains(m.Genres, "drama") {
					continue
				}
				if len(f.ExcludeGenres) > 0 && slices.Contains(m.Genres, "horror") {
					continue
				}
				if f.YearMin != nil && (m.Year == nil || *m.Year < *f.YearMin) {
					continue
				}
				if f.RuntimeMax != nil && (m.Runtime == nil || *m.Runtime > *f.RuntimeMax) {
					continue
				}
				want = append(want, m.ID)
			}
			slices.Sort(want)
			for _, sort := range []string{"popularity", "rating", "newest", "runtime"} {
				f.Sort = sort
				got := []string{}
				for page := int32(1); page <= int32(len(want)/12+1); page++ {
					f.Page = page
					result, err := store.Search(ctx, f)
					if err != nil || result.Total != int64(len(want)) {
						t.Fatalf("count %d want %d: %v", result.Total, len(want), err)
					}
					if len(result.Items) > 12 {
						t.Fatal("page size changed")
					}
					got = append(got, ids(result.Items)...)
				}
				slices.Sort(got)
				if !slices.Equal(got, want) {
					t.Fatalf("count/list mismatch: got %v want %v", got, want)
				}
			}
		})
	}
	// Mutate only this test's isolated temporary schema, never the app catalog.
	// Make the boundary inclusive and independent from a vote floor explicit.
	_, err := pool.Exec(ctx, `UPDATE movies SET rating=0, vote_count=0 WHERE id='orbit-of-two'`)
	if err != nil {
		t.Fatal(err)
	}
	f := catalog.DefaultFilter()
	f.RatingMin = score(0)
	f.Languages = []string{"en"}
	f.VoteCountMin = number(0)
	result, err := store.Search(ctx, f)
	if err != nil || !slices.Contains(ids(result.Items), "orbit-of-two") {
		t.Fatal("inclusive zero thresholds excluded known zero")
	}
}

func TestAdvancedPostgresIndependentMissingScoresAndVotes(t *testing.T) {
	pool := testdb.Open(t)
	ctx := context.Background()
	store := catalog.NewStore(pool)
	_, err := pool.Exec(ctx, `UPDATE movies SET rating=10, vote_count=NULL WHERE id='orbit-of-two'`)
	if err != nil {
		t.Fatal(err)
	}
	ten := float64(10)
	f := catalog.DefaultFilter()
	f.RatingMin = &ten
	result, err := store.Search(ctx, f)
	if err != nil || result.Total != 1 || !slices.Equal(ids(result.Items), []string{"orbit-of-two"}) {
		t.Fatal("inclusive ten or implicit vote floor", result, err)
	}
	f.VoteCountMin = number(0)
	result, err = store.Search(ctx, f)
	if err != nil || result.Total != 0 {
		t.Fatal("missing votes passed active constraint")
	}
	_, err = pool.Exec(ctx, `UPDATE movies SET rating=NULL, vote_count=0 WHERE id='orbit-of-two'`)
	if err != nil {
		t.Fatal(err)
	}
	f.RatingMin = nil
	f.Languages = []string{"en"}
	result, err = store.Search(ctx, f)
	if err != nil || !slices.Contains(ids(result.Items), "orbit-of-two") {
		t.Fatal("vote-only constraint required a known rating")
	}
}
