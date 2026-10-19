package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	audit "bettermovie/docs/audit"
	"bettermovie/internal/tmdb"
)

// Only self-authored metadata is used; no transport or database is opened.
func TestImportConfigurationAndOfflineRerun(t *testing.T) {
	for _, name := range []string{"TMDB_READ_ACCESS_TOKEN", "TMDB_ACCESS_APPROVED", "TMDB_TERMS_REFERENCE", "TMDB_RETAIN_UNTIL", "DATABASE_URL", "TMDB_STAGING_DATABASE_URL"} {
		t.Setenv(name, "")
	}
	original := os.Args
	t.Cleanup(func() { os.Args = original })
	dir := t.TempDir()
	mapping, checkpoint, out := filepath.Join(dir, "mapping.json"), filepath.Join(dir, "checkpoint.json"), filepath.Join(dir, "catalog.json")
	selection := tmdb.MappingTemplate().Movies[0]
	selection.TMDBID, selection.Reviewed = 900000001, true
	m := tmdb.Mapping{Movies: []tmdb.Selection{selection}}
	if err := tmdb.WritePrivate(mapping, m); err != nil {
		t.Fatal(err)
	}
	args := []string{"tmdb", "import", "--mapping", mapping, "--checkpoint", checkpoint, "--out", out}
	for _, expiry := range []string{"", "not-a-date", "2026-02-30", "2000-01-01"} {
		os.Args = append(append([]string{}, args...), "--retain-until", expiry)
		if err := run(); err == nil || !strings.Contains(err.Error(), "retention deadline") {
			t.Fatalf("invalid expiry accepted: %v", err)
		}
	}
	// An old environment value cannot silently supply expiry.
	t.Setenv("TMDB_RETAIN_UNTIL", "2999-01-01")
	os.Args = args
	if err := run(); err == nil || !strings.Contains(err.Error(), "retention deadline") {
		t.Fatalf("old expiry environment used: %v", err)
	}
	expiry := time.Now().UTC().AddDate(0, 0, 7).Format(time.DateOnly)
	os.Args = append(append([]string{}, args...), "--retain-until", expiry)
	if err := run(); err == nil || !strings.Contains(err.Error(), "TMDB_READ_ACCESS_TOKEN required") {
		t.Fatalf("pending fetch did not require token: %v", err)
	}
	if _, err := os.Stat(checkpoint); !os.IsNotExist(err) {
		t.Fatal("missing token wrote checkpoint")
	}
	var sample struct {
		Films []struct {
			Year int `json:"year"`
		} `json:"films"`
	}
	if err := json.Unmarshal([]byte(audit.SampleJSON), &sample); err != nil {
		t.Fatal(err)
	}
	var d tmdb.Details
	raw, _ := json.Marshal(map[string]any{"id": selection.TMDBID, "title": "Self-authored test feature", "original_title": selection.MatchTitle, "release_date": time.Date(sample.Films[0].Year, 1, 1, 0, 0, 0, 0, time.UTC).Format(time.DateOnly)})
	if err := json.Unmarshal(raw, &d); err != nil {
		t.Fatal(err)
	}
	movie, err := tmdb.Project(d, selection, time.Now(), expiry)
	if err != nil {
		t.Fatal(err)
	}
	encoded, _ := json.Marshal(m)
	hash := sha256.Sum256(encoded)
	saved := tmdb.Checkpoint{SampleHash: tmdb.SampleHash, MappingHash: hex.EncodeToString(hash[:]), Results: []tmdb.Result{{SampleID: selection.SampleID, Code: "ok", Movie: &movie}}}
	if err := tmdb.WritePrivate(checkpoint, saved); err != nil {
		t.Fatal(err)
	}
	if err := run(); err != nil {
		t.Fatalf("complete rerun needed token/database/acknowledgements: %v", err)
	}
	var a tmdb.Artifact
	if err := tmdb.Read(out, &a); err != nil {
		t.Fatal(err)
	}
	if _, err := a.Movies(time.Now()); err != nil {
		t.Fatal(err)
	}
	os.Args = []string{"tmdb", "report", "--checkpoint", checkpoint}
	if err := run(); err != nil {
		t.Fatal(err)
	}
	os.Args = []string{"tmdb", "stage", "--artifact", out, "--isolated-database"}
	if err := run(); err == nil || !strings.Contains(err.Error(), "staging database configuration invalid") {
		t.Fatalf("stage did not require dedicated database: %v", err)
	}
}
