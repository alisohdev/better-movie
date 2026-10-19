package tmdb

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"

	"time"

	"bettermovie/internal/catalog"
)

type Result struct {
	SampleID string         `json:"sampleId"`
	Code     string         `json:"code"`
	Movie    *catalog.Movie `json:"movie,omitempty"`
}
type Checkpoint struct {
	SampleHash  string   `json:"sampleHash"`
	MappingHash string   `json:"mappingHash"`
	Results     []Result `json:"results"`
}
type Artifact struct {
	CatalogRevision string `json:"catalogRevision"`
	SampleHash      string `json:"sampleHash"`
	Notice          string `json:"notice"`
	Projection      string `json:"projection"`
}

func ValidRevision(revision string) bool { return catalog.ValidTMDBRevision(revision) }
func Schema(revision string) string      { return catalog.StagingSchema(revision) }
func digest(data []byte) string          { sum := sha256.Sum256(data); return hex.EncodeToString(sum[:]) }
func Decode(reader io.Reader, target any) error {
	limited := &io.LimitedReader{R: reader, N: (4 << 20) + 1}
	decoder := json.NewDecoder(limited)
	decoder.DisallowUnknownFields()
	if decoder.Decode(target) != nil || decoder.Decode(new(any)) != io.EOF || limited.N == 0 {
		return errors.New("invalid private input document")
	}
	return nil
}
func Read(path string, target any) error {
	f, err := os.Open(path)
	if err != nil {
		return errors.New("private input unavailable")
	}
	defer f.Close()
	return Decode(f, target)
}
func WritePrivate(path string, value any) error {
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return errors.New("private output encoding failed")
	}
	dir := filepath.Dir(path)
	if os.MkdirAll(dir, 0700) != nil {
		return errors.New("private output directory unavailable")
	}
	file, err := os.CreateTemp(dir, ".tmdb-*")
	if err != nil {
		return errors.New("private output unavailable")
	}
	name := file.Name()
	defer os.Remove(name)
	if _, err = file.Write(append(data, '\n')); err == nil {
		err = file.Sync()
	}
	closeErr := file.Close()
	if err != nil || closeErr != nil {
		return errors.New("private output failed")
	}
	if os.Rename(name, path) != nil {
		return errors.New("private output replacement failed")
	}
	return nil
}

// Import advances at most limit selected IDs, serially. Call persist after every
// outcome, including errors. Ctrl-C interrupts HTTP/sleep; a later run resumes.
// A nil client permits offline completed-checkpoint reruns, never pending fetches.
func Import(ctx context.Context, m Mapping, checkpoint Checkpoint, client *Client, limit int, retain string, now time.Time, persist func(Checkpoint) error) (Checkpoint, *Artifact, error) {
	if m.Validate() != nil || limit < 1 || limit > 40 {
		return checkpoint, nil, errors.New("invalid bounded mapping or limit")
	}
	until, err := time.Parse(time.DateOnly, retain)
	if err != nil || until.Before(now.UTC().Truncate(24*time.Hour)) {
		return checkpoint, nil, errors.New("explicit unexpired retention deadline required")
	}
	encoded, _ := json.Marshal(m)
	hash := digest(encoded)
	if checkpoint.SampleHash == "" {
		checkpoint = Checkpoint{SampleHash: SampleHash, MappingHash: hash, Results: []Result{}}
	}
	if checkpoint.SampleHash != SampleHash || checkpoint.MappingHash != hash {
		return checkpoint, nil, errors.New("checkpoint belongs to another sample/mapping")
	}
	existing := map[string]Result{}
	selected := map[string]Selection{}
	for _, s := range m.Movies {
		selected[s.SampleID] = s
	}
	for _, r := range checkpoint.Results {
		s, ok := selected[r.SampleID]
		if !ok || existing[r.SampleID].SampleID != "" {
			return checkpoint, nil, errors.New("invalid checkpoint rows")
		}
		if r.Movie != nil && (r.Code != "ok" || ValidateMovie(*r.Movie, now) != nil || r.Movie.Provenance.SampleID != r.SampleID || r.Movie.Provenance.ProviderID != s.TMDBID || r.Movie.Provenance.RetainUntil != retain) {
			return checkpoint, nil, errors.New("invalid or expired checkpoint; start an explicitly refreshed run")
		}
		existing[r.SampleID] = r
	}
	attempts := 0
	for _, s := range m.Movies {
		if existing[s.SampleID].Movie != nil {
			continue
		}
		if attempts == limit || ctx.Err() != nil {
			break
		}
		if client == nil {
			return checkpoint, nil, errors.New("TMDB_READ_ACCESS_TOKEN required for authenticated requests")
		}
		if until.Before(client.now().UTC().Truncate(24 * time.Hour)) {
			break
		}
		attempts++
		d, fetchErr := client.Fetch(ctx, s.TMDBID)
		r := Result{SampleID: s.SampleID, Code: "ok"}
		if fetchErr == nil {
			movie, e := Project(d, s, client.now(), retain)
			if e == nil {
				r.Movie = &movie
			} else {
				r.Code = "identity_or_metadata_rejected"
			}
		} else {
			var safe *FetchError
			if errors.As(fetchErr, &safe) {
				r.Code = safe.Code
			} else {
				r.Code = "request_failed"
			}
		}
		existing[s.SampleID] = r
		checkpoint.Results = []Result{}
		for _, entry := range m.Movies {
			if item, ok := existing[entry.SampleID]; ok {
				checkpoint.Results = append(checkpoint.Results, item)
			}
		}
		if persist != nil {
			if err := persist(checkpoint); err != nil {
				return checkpoint, nil, err
			}
		}
		var stopped *FetchError
		if errors.As(fetchErr, &stopped) && stopped.Stop {
			break
		}
		if client.sleep(ctx, 250*time.Millisecond) != nil {
			break
		}
	}
	movies := []catalog.Movie{}
	for _, s := range m.Movies {
		r := existing[s.SampleID]
		if r.Movie == nil {
			return checkpoint, nil, errors.New("import incomplete; inspect private checkpoint and resume")
		}
		movies = append(movies, *r.Movie)
	}
	data, _ := json.Marshal(movies)
	a := &Artifact{CatalogRevision: "tmdb-" + digest(data), SampleHash: SampleHash, Notice: "TMDB metadata · private staging catalog", Projection: string(data)}
	return checkpoint, a, nil
}
func (a Artifact) Movies(now time.Time) ([]catalog.Movie, error) {
	if !ValidRevision(a.CatalogRevision) || a.CatalogRevision != "tmdb-"+digest([]byte(a.Projection)) || a.SampleHash != SampleHash {
		return nil, errors.New("artifact revision/sample mismatch")
	}
	var movies []catalog.Movie
	if Decode(bytes.NewBufferString(a.Projection), &movies) != nil || len(movies) < 1 || len(movies) > 40 {
		return nil, errors.New("incomplete artifact")
	}
	ids, samples := map[string]bool{}, map[string]bool{}
	for _, m := range movies {
		if ValidateMovie(m, now) != nil || ids[m.ID] || samples[m.Provenance.SampleID] {
			return nil, errors.New("invalid artifact projection")
		}
		ids[m.ID] = true
		samples[m.Provenance.SampleID] = true
	}
	return movies, nil
}
