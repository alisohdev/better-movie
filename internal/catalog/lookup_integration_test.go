package catalog_test

import (
	"context"
	"errors"
	"reflect"
	"slices"
	"testing"
	"time"

	"bettermovie/internal/catalog"
	"bettermovie/internal/dbgen"
	"bettermovie/internal/testdb"
)

func suggestionIDs(result catalog.TitleLookup) []string {
	ids := []string{}
	for _, item := range result.Items {
		ids = append(ids, item.ID)
	}
	return ids
}

func TestPostgresTitleLookup(t *testing.T) {
	pool := testdb.Open(t)
	store := catalog.NewStore(pool)
	ctx := context.Background()
	for _, test := range []struct {
		query string
		want  []string
	}{
		{"THE SPACE BETWEEN", []string{"the-space-between"}},
		{"  the\tspace\n BETWEEN  ", []string{"the-space-between"}},
		{"space", []string{"the-space-between"}},
		{"آخرين قطار تا سپيده", []string{"last-train-to-dawn"}},
		{"آخَرِين\u200cقطار  تا\u00a0سپیده", []string{"last-train-to-dawn"}},
		{"", []string{}}, {" \t\u200cَ ", []string{}},
		{"Orbit مدار", []string{}}, {"not in this pilot", []string{}},
		{"' OR 1=1; DROP TABLE movies; --", []string{}}, {"%", []string{}}, {"_", []string{}},
	} {
		t.Run(test.query, func(t *testing.T) {
			result, err := store.Lookup(ctx, test.query)
			if err != nil || result.Items == nil || result.CatalogRevision != catalog.Revision || !slices.Equal(suggestionIDs(result), test.want) {
				t.Fatalf("query %q: %v, %v", test.query, result, err)
			}
		})
	}
	// All available titles are searchable without changing their source/display form.
	for _, movie := range testdb.Fixture(t).Movies {
		titles := []string{movie.TitleEn, movie.OriginalTitle}
		if movie.TitleFa != nil {
			titles = append(titles, *movie.TitleFa)
		}
		for _, title := range titles {
			result, err := store.Lookup(ctx, title)
			if err != nil || !slices.Contains(suggestionIDs(result), movie.ID) {
				t.Fatalf("missing alias %q: %v", title, err)
			}
			for _, item := range result.Items {
				if item.ID == movie.ID && (item.TitleEn != movie.TitleEn || !reflect.DeepEqual(item.TitleFa, movie.TitleFa) || item.OriginalTitle != movie.OriginalTitle) {
					t.Fatal("lookup changed display title")
				}
			}
		}
	}
	result, err := store.Lookup(ctx, "the")
	if err != nil || len(result.Items) != 6 {
		t.Fatalf("limit: %v %v", result, err)
	}
	again, err := store.Lookup(ctx, "the")
	if err != nil || !reflect.DeepEqual(result, again) {
		t.Fatal("ranking is not deterministic")
	}

	captured := &capturedQuery{DBTX: pool}
	if _, err = dbgen.New(captured).LookupTitles(ctx, "orbit"); err != nil {
		t.Fatal(err)
	}
	logPlan(t, ctx, pool, "bounded title lookup on 32 synthetic movies", captured.sql, captured.args)

	// Test mutations are restricted to this disposable schema, using existing films.
	_, err = pool.Exec(ctx, `UPDATE movies SET title_en = CASE id
 WHEN 'the-space-between' THEN 'Orbit'
 WHEN 'last-train-to-dawn' THEN 'Orbit of Two'
 WHEN 'a-sea-of-silence' THEN 'An Orbit'
 ELSE title_en END,
 original_title = CASE WHEN id = 'the-space-between' THEN 'مدار Orbit' ELSE original_title END`)
	if err != nil {
		t.Fatal(err)
	}
	result, err = store.Lookup(ctx, "ORBIT")
	want := []string{"the-space-between", "last-train-to-dawn", "orbit-of-two", "a-sea-of-silence"}
	if err != nil || !slices.Equal(suggestionIDs(result), want) {
		t.Fatalf("exact/prefix/partial and ID ties: %v %v", suggestionIDs(result), err)
	}
	result, err = store.Lookup(ctx, "مدار Orbit")
	if err != nil || !slices.Equal(suggestionIDs(result), []string{"the-space-between"}) {
		t.Fatal("mixed-direction original title not searchable")
	}
	_, err = pool.Exec(ctx, `UPDATE movies SET title_fa = 'كِتاب يَك‌شب' WHERE id = 'the-space-between'`)
	if err != nil {
		t.Fatal(err)
	}
	// Match canonical Persian input against Arabic variants stored in the database.
	result, err = store.Lookup(ctx, "کتاب یک شب")
	if err != nil || !slices.Contains(suggestionIDs(result), "the-space-between") {
		t.Fatalf("stored Persian normalization: %v %v", result, err)
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = tx.Exec(ctx, "LOCK TABLE movies IN ACCESS EXCLUSIVE MODE"); err != nil {
		t.Fatal(err)
	}
	bounded, cancel := context.WithTimeout(ctx, 75*time.Millisecond)
	defer cancel()
	_, err = store.Lookup(bounded, "orbit")
	if err == nil || !errors.Is(bounded.Err(), context.DeadlineExceeded) {
		t.Fatal("lookup ignored request cancellation")
	}
	if err = tx.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err = pool.Exec(ctx, "UPDATE catalog_metadata SET revision = 'future-v2'"); err != nil {
		t.Fatal(err)
	}
	if _, err = store.Lookup(ctx, "orbit"); !errors.Is(err, catalog.ErrRevision) {
		t.Fatal("lookup accepted incompatible revision")
	}
}
