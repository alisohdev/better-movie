package catalog_test

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"

	"bettermovie/internal/catalog"
	"bettermovie/internal/testdb"
)

func TestOwnedFixtureValidation(t *testing.T) {
	fixture := testdb.Fixture(t)
	if len(fixture.Movies) != 32 || fixture.CatalogRevision != "synthetic-v1" {
		t.Fatal("the first slice must use the shared 32-film synthetic fixture")
	}
	for _, test := range []struct {
		name   string
		change func(*catalog.Fixture)
	}{
		{"external source", func(f *catalog.Fixture) { f.Movies[0].Source = "External provider" }},
		{"non synthetic", func(f *catalog.Fixture) { f.Movies[0].Synthetic = false }},
		{"remote poster", func(f *catalog.Fixture) { f.Movies[0].Poster = "https://example.test/poster.jpg" }},
		{"duplicate ID", func(f *catalog.Fixture) { f.Movies[1].ID = f.Movies[0].ID }},
		{"unsupported revision", func(f *catalog.Fixture) { f.CatalogRevision = "future-v2" }},
		{"empty catalog", func(f *catalog.Fixture) { f.Movies = nil }},
		{"missing genres array", func(f *catalog.Fixture) { f.Movies[0].Genres = nil }},
		{"invalid release date", func(f *catalog.Fixture) { date := "2026-02-30"; f.Movies[0].ReleaseObservations[0].Date = &date }},
		{"false confirmed availability", func(f *catalog.Fixture) { f.Movies[0].ReleaseObservations[0].Verification = "confirmed" }},
	} {
		t.Run(test.name, func(t *testing.T) {
			fresh := testdb.Fixture(t)
			test.change(&fresh)
			if fresh.Validate() == nil {
				t.Fatal("invalid synthetic import accepted")
			}
		})
	}
	body, err := json.Marshal(fixture)
	if err != nil {
		t.Fatal(err)
	}
	t.Run("unknown availability field", func(t *testing.T) {
		unknown := bytes.Replace(body, []byte(`"synthetic":true`), []byte(`"synthetic":true,"availableFile":true`), 1)
		if _, err := catalog.ReadFixture(bytes.NewReader(unknown)); err == nil {
			t.Fatal("unknown provider/file field accepted")
		}
	})
	t.Run("multiple JSON documents", func(t *testing.T) {
		if _, err := catalog.ReadFixture(strings.NewReader(string(body) + " {}")); err == nil {
			t.Fatal("trailing JSON accepted")
		}
	})
}
