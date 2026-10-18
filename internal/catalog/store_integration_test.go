package catalog_test

import (
	"context"
	"errors"
	"reflect"
	"slices"
	"testing"
	"time"

	"bettermovie/db"
	"bettermovie/internal/catalog"
	"bettermovie/internal/testdb"
)

func ids(items []catalog.Movie) []string {
	result := make([]string, 0, len(items))
	for _, movie := range items {
		result = append(result, movie.ID)
	}
	return result
}

func TestPostgresCatalog(t *testing.T) {
	pool := testdb.Open(t)
	store := catalog.NewStore(pool)
	ctx := context.Background()

	t.Run("health checks the seeded revision", func(t *testing.T) {
		if err := store.Health(ctx); err != nil {
			t.Fatal(err)
		}
	})
	t.Run("first page and stable pagination", func(t *testing.T) {
		f := catalog.DefaultFilter()
		first, err := store.Search(ctx, f)
		if err != nil {
			t.Fatal(err)
		}
		want := []string{"the-space-between", "last-train-to-dawn", "a-sea-of-silence", "orbit-of-two", "the-orange-grove", "midnight-atlas", "paper-skies", "room-for-the-rain", "the-other-shore", "signals-from-home", "a-small-rebellion", "winter-library"}
		if first.Total != 32 || first.PageSize != 12 || first.Page != 1 || first.CatalogRevision != "synthetic-v1" || !slices.Equal(ids(first.Items), want) {
			t.Fatalf("incorrect first page: total=%d ids=%v", first.Total, ids(first.Items))
		}
		seen := map[string]bool{}
		for pageNumber := int32(1); pageNumber <= 3; pageNumber++ {
			f.Page = pageNumber
			page, err := store.Search(ctx, f)
			if err != nil {
				t.Fatal(err)
			}
			if page.Total != 32 || (pageNumber < 3 && len(page.Items) != 12) || (pageNumber == 3 && len(page.Items) != 8) {
				t.Fatal("page count or size changed across pagination")
			}
			for _, movie := range page.Items {
				if seen[movie.ID] {
					t.Fatalf("movie repeated across pages: %s", movie.ID)
				}
				seen[movie.ID] = true
			}
		}
		if len(seen) != 32 {
			t.Fatal("pagination omitted a movie")
		}
		f.Page = 10000
		empty, err := store.Search(ctx, f)
		if err != nil || empty.Total != 32 || empty.Items == nil || len(empty.Items) != 0 {
			t.Fatal("a page beyond the end must retain total and return an empty array")
		}
	})

	for _, test := range []struct {
		name   string
		change func(*catalog.Filter)
		total  int64
		want   []string
	}{
		{"any genres", func(f *catalog.Filter) { f.Genres = []string{"animation", "documentary"} }, 6,
			[]string{"paper-skies", "the-slow-river", "northern-frequency", "the-silver-forest", "the-lightkeepers", "the-invisible-bridge"}},
		{"all genres", func(f *catalog.Filter) { f.Genres = []string{"drama", "romance"}; f.GenreMode = "all" }, 3,
			[]string{"the-space-between", "winter-library", "blue-hour-letters"}},
		{"exclusions reject matching known tags", func(f *catalog.Filter) { f.Genres = []string{"adventure"}; f.ExcludeGenres = []string{"animation"} }, 6,
			[]string{"midnight-atlas", "red-valley", "a-handful-of-stars", "northern-frequency", "east-of-the-moon", "summer-without-maps"}},
		{"inclusive exact year", func(f *catalog.Filter) { f.YearMin = number(2024); f.YearMax = number(2024) }, 3,
			[]string{"the-space-between", "orbit-of-two", "the-slow-river"}},
		{"inclusive exact runtime with unknown year", func(f *catalog.Filter) { f.RuntimeMin = number(91); f.RuntimeMax = number(91) }, 1,
			[]string{"the-invisible-bridge"}},
		{"different groups combine with AND", func(f *catalog.Filter) {
			f.YearMin = number(2020)
			f.YearMax = number(2025)
			f.RuntimeMin = number(100)
			f.RuntimeMax = number(110)
		}, 4,
			[]string{"the-space-between", "last-train-to-dawn", "the-other-shore", "signals-from-home"}},
		{"known empty intersection", func(f *catalog.Filter) { f.Genres = []string{"horror", "documentary"}; f.GenreMode = "all" }, 0, []string{}},
	} {
		t.Run(test.name, func(t *testing.T) {
			f := catalog.DefaultFilter()
			test.change(&f)
			page, err := store.Search(ctx, f)
			if err != nil {
				t.Fatal(err)
			}
			if page.Total != test.total || !slices.Equal(ids(page.Items), test.want) {
				t.Fatalf("got total=%d ids=%v; want total=%d ids=%v", page.Total, ids(page.Items), test.total, test.want)
			}
		})
	}

	t.Run("unknown values do not satisfy an active bound", func(t *testing.T) {
		for _, test := range []struct {
			change func(*catalog.Filter)
			total  int64
		}{
			{func(f *catalog.Filter) { f.YearMin = number(1888) }, 31},
			{func(f *catalog.Filter) { f.YearMax = number(2100) }, 31},
			{func(f *catalog.Filter) { f.RuntimeMin = number(1) }, 30},
			{func(f *catalog.Filter) { f.RuntimeMax = number(600) }, 30},
		} {
			f := catalog.DefaultFilter()
			test.change(&f)
			page, err := store.Search(ctx, f)
			if err != nil || page.Total != test.total {
				t.Fatalf("null handling: total=%d wanted=%d error=%v", page.Total, test.total, err)
			}
		}
	})

	t.Run("sort order is stable and unknown values come last", func(t *testing.T) {
		for _, test := range []struct {
			sort  string
			first []string
			last  []string
		}{
			{"rating", []string{"the-last-projection", "a-sea-of-silence", "east-of-the-moon", "signals-from-home"}, []string{"still-life-with-road", "summer-without-maps"}},
			{"newest", []string{"echo-chamber", "a-sea-of-silence", "midnight-atlas"}, []string{"the-invisible-bridge"}},
			{"runtime", []string{"the-silver-forest", "the-slow-river", "paper-skies"}, []string{"blue-hour-letters", "still-life-with-road"}},
		} {
			f := catalog.DefaultFilter()
			f.Sort = test.sort
			all := []catalog.Movie{}
			for page := int32(1); page <= 3; page++ {
				f.Page = page
				result, err := store.Search(ctx, f)
				if err != nil {
					t.Fatal(err)
				}
				all = append(all, result.Items...)
			}
			got := ids(all)
			if !slices.Equal(got[:len(test.first)], test.first) || !slices.Equal(got[len(got)-len(test.last):], test.last) {
				t.Fatalf("%s sort: %v", test.sort, got)
			}
		}
	})
	t.Run("detail exactly preserves every fixture field", func(t *testing.T) {
		for _, movie := range testdb.Fixture(t).Movies {
			detail, err := store.Detail(ctx, movie.ID)
			if err != nil {
				t.Fatal(err)
			}
			if detail.CatalogRevision != "synthetic-v1" || !reflect.DeepEqual(detail.Movie, movie) {
				t.Fatalf("SQL round trip changed the DTO for %s: got=%#v want=%#v", movie.ID, detail.Movie, movie)
			}
		}
		if _, err := store.Detail(ctx, "unknown-film"); !errors.Is(err, catalog.ErrNotFound) {
			t.Fatal("unknown ID did not return ErrNotFound")
		}
	})
	t.Run("migration and seed converge when repeated", func(t *testing.T) {
		if err := db.Migrate(ctx, pool); err != nil {
			t.Fatal(err)
		}
		if err := catalog.Seed(ctx, pool, testdb.Fixture(t)); err != nil {
			t.Fatal(err)
		}
		page, err := store.Search(ctx, catalog.DefaultFilter())
		if err != nil || page.Total != 32 {
			t.Fatal("repeated seed changed catalog cardinality")
		}
	})
	t.Run("mid-seed SQL failure rolls back previous movie changes", func(t *testing.T) {
		_, err := pool.Exec(ctx, `CREATE FUNCTION reject_last_seed_movie() RETURNS trigger LANGUAGE plpgsql AS $$
		BEGIN IF NEW.id = 'still-life-with-road' THEN RAISE EXCEPTION 'simulated seed failure'; END IF;
		RETURN NEW; END $$;
		CREATE TRIGGER reject_last_seed_movie BEFORE UPDATE ON movies
		FOR EACH ROW EXECUTE FUNCTION reject_last_seed_movie()`)
		if err != nil {
			t.Fatal(err)
		}
		defer pool.Exec(ctx, "DROP TRIGGER reject_last_seed_movie ON movies; DROP FUNCTION reject_last_seed_movie()")
		fixture := testdb.Fixture(t)
		original := fixture.Movies[0].TitleEn
		fixture.Movies[0].TitleEn = "This write must roll back"
		if err := catalog.Seed(ctx, pool, fixture); err == nil {
			t.Fatal("simulated SQL failure did not abort seed")
		}
		detail, err := store.Detail(ctx, fixture.Movies[0].ID)
		if err != nil || detail.Movie.TitleEn != original {
			t.Fatal("failed seed left a partial catalog write")
		}
	})
	t.Run("revision mismatch is unavailable", func(t *testing.T) {
		if _, err := pool.Exec(ctx, "UPDATE catalog_metadata SET revision = 'future-v2'"); err != nil {
			t.Fatal(err)
		}
		defer pool.Exec(ctx, "UPDATE catalog_metadata SET revision = 'synthetic-v1'")
		if err := store.Health(ctx); !errors.Is(err, catalog.ErrRevision) {
			t.Fatal("health accepted an incompatible catalog")
		}
		if _, err := store.Search(ctx, catalog.DefaultFilter()); !errors.Is(err, catalog.ErrRevision) {
			t.Fatal("list accepted an incompatible catalog")
		}
		if _, err := store.Detail(ctx, "the-space-between"); !errors.Is(err, catalog.ErrRevision) {
			t.Fatal("detail accepted an incompatible catalog")
		}
	})
	t.Run("request deadline cancels a blocked real query", func(t *testing.T) {
		conn, err := pool.Acquire(ctx)
		if err != nil {
			t.Fatal(err)
		}
		defer conn.Release()
		tx, err := conn.Begin(ctx)
		if err != nil {
			t.Fatal(err)
		}
		defer tx.Rollback(ctx)
		if _, err := tx.Exec(ctx, "LOCK TABLE movies IN ACCESS EXCLUSIVE MODE"); err != nil {
			t.Fatal(err)
		}
		bounded, cancel := context.WithTimeout(ctx, 75*time.Millisecond)
		defer cancel()
		if _, err := store.Search(bounded, catalog.DefaultFilter()); err == nil || !errors.Is(bounded.Err(), context.DeadlineExceeded) {
			t.Fatal("blocked SQL ignored the request deadline")
		}
	})
}
