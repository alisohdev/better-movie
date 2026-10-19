package tmdb

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// These responses are self-authored. IDs, prose, ratings, aliases and all other
// values are test data, not observations about the frozen real-title sample.
const testToken = "self-authored-test-token"

type transportFunc func(*http.Request) (*http.Response, error)

func (f transportFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
func selection() Selection {
	s := MappingTemplate().Movies[0]
	s.TMDBID = 900000001
	s.Reviewed = true
	return s
}
func mockBody(s Selection) string {
	value := map[string]any{"id": s.TMDBID, "title": "Self-authored feature", "original_title": "Test original title", "release_date": fmt.Sprintf("%d-01-02", targets[s.SampleID].Year), "adult": false, "video": false, "runtime": 99, "vote_average": 7.25, "vote_count": 31, "popularity": 2.5, "original_language": "en", "production_countries": []any{map[string]any{"iso_3166_1": "US"}}, "genres": []any{map[string]any{"id": 18}, map[string]any{"id": 80}}, "translations": map[string]any{"translations": []any{map[string]any{"iso_639_1": "fa", "data": map[string]any{"title": "عنوان آزمایشی", "overview": "DO NOT RETAIN PROSE"}}}}, "alternative_titles": map[string]any{"titles": []any{map[string]any{"title": s.MatchTitle}, map[string]any{"title": "FixtureAlias"}}}, "overview": "DO NOT RETAIN PROSE", "poster_path": "/NEVER_DOWNLOAD.jpg", "release_dates": map[string]any{"results": []any{"UNVERIFIED RELEASE"}}}
	data, _ := json.Marshal(value)
	return string(data)
}
func mockDetails(s Selection) Details {
	var d Details
	_ = json.Unmarshal([]byte(mockBody(s)), &d)
	return d
}
func fakeClient(t *testing.T, fn func(*http.Request) (int, string, http.Header, error)) *Client {
	t.Helper()
	c, err := NewClient(testToken)
	if err != nil {
		t.Fatal(err)
	}
	c.http.Transport = transportFunc(func(r *http.Request) (*http.Response, error) {
		if r.URL.Host != "api.themoviedb.org" || r.URL.Scheme != "https" || r.Header.Get("Authorization") != "Bearer "+testToken || r.URL.Query().Has("api_key") {
			t.Error("unsafe provider request")
		}
		status, body, header, err := fn(r)
		if err != nil {
			return nil, err
		}
		return &http.Response{StatusCode: status, Body: io.NopCloser(strings.NewReader(body)), Header: header}, nil
	})
	c.sleep = func(context.Context, time.Duration) error { return nil }
	return c
}
func deadline() string { return time.Now().AddDate(0, 1, 0).UTC().Format(time.DateOnly) }

func TestProjectionRightsAndIdentity(t *testing.T) {
	s := selection()
	d := mockDetails(s)
	now := time.Now()
	m, err := Project(d, s, now, deadline())
	if err != nil {
		t.Fatal(err)
	}
	if m.Source != "TMDB" || m.Synthetic || m.ID != "tmdb-900000001" || m.Provenance.ProviderID != s.TMDBID || m.OriginalTitle != d.OriginalTitle || m.TitleFa == nil || *m.TitleFa != "عنوان آزمایشی" || !contains(m.Genres, "crime") || !contains(m.Aliases, "FixtureAlias") {
		t.Fatal("projection lost source/identity/locale")
	}
	data, _ := json.Marshal(m)
	if strings.Contains(string(data), "DO NOT RETAIN") || strings.Contains(string(data), "NEVER_DOWNLOAD") || len(m.ReleaseObservations) != 0 || m.Poster != "/posters/placeholder.svg" {
		t.Fatal("rights boundary failed")
	}
	for name, change := range map[string]func(*Details){"wrong ID": func(d *Details) { d.ID++ }, "wrong year": func(d *Details) { d.ReleaseDate = "2000-01-01" }, "missing year": func(d *Details) { d.ReleaseDate = "" }, "adult": func(d *Details) { d.Adult = true }, "video": func(d *Details) { d.Video = true }, "empty original": func(d *Details) { d.OriginalTitle = "" }, "unknown genre": func(d *Details) { d.Genres[0].ID = -1 }, "invalid country": func(d *Details) { d.Countries[0].Code = "not-country" }} {
		t.Run(name, func(t *testing.T) {
			d := mockDetails(s)
			change(&d)
			if _, err := Project(d, s, now, deadline()); err == nil {
				t.Fatal("accepted ambiguous/invalid metadata")
			}
		})
	}
	s.MatchTitle = "Some other remake"
	if _, err := Project(mockDetails(selection()), s, now, deadline()); err == nil {
		t.Fatal("accepted unrelated title")
	}
}
func TestMissingFieldsAndConflictingPersian(t *testing.T) {
	s := selection()
	d := mockDetails(s)
	d.Title = ""
	d.Runtime = ptr(int32(0))
	d.Rating = nil
	d.Votes = ptr(int32(0))
	d.Popularity = nil
	d.OriginalLanguage = ""
	d.Countries = nil
	d.Genres = nil
	d.Translations.Items[0].Data.Title = "  "
	m, err := Project(d, s, time.Now(), deadline())
	if err != nil {
		t.Fatal(err)
	}
	if m.TitleEn != d.OriginalTitle || m.TitleFa != nil || m.Runtime != nil || m.Rating != nil || m.VoteCount == nil || *m.VoteCount != 0 || m.OriginalLanguage != nil || len(m.Countries) != 0 || len(m.Genres) != 0 {
		t.Fatal("missing became fabricated values")
	}
	d = mockDetails(s)
	other := d.Translations.Items[0]
	other.Data.Title = "عنوان دیگر"
	d.Translations.Items = append(d.Translations.Items, other)
	if _, err := Project(d, s, time.Now(), deadline()); err == nil {
		t.Fatal("conflicting Persian title accepted")
	}
}
func TestClientRetryBoundRedactionAndAccess(t *testing.T) {
	s := selection()
	calls := 0
	waits := []time.Duration{}
	c := fakeClient(t, func(r *http.Request) (int, string, http.Header, error) {
		calls++
		if !strings.Contains(r.URL.RawQuery, "append_to_response=translations,alternative_titles") {
			t.Error("bounded appended resources missing")
		}
		if calls < 3 {
			return 429, testToken, http.Header{"Retry-After": []string{fmt.Sprint(calls)}}, nil
		}
		return 200, mockBody(s), nil, nil
	})
	c.sleep = func(_ context.Context, d time.Duration) error { waits = append(waits, d); return nil }
	if _, err := c.Fetch(context.Background(), s.TMDBID); err != nil || calls != 3 || len(waits) != 2 || waits[1] != 2*time.Second {
		t.Fatal("retry bound/header not respected", err)
	}
	for _, status := range []int{401, 403, 302, 404, 500, 429} {
		t.Run(fmt.Sprint(status), func(t *testing.T) {
			n := 0
			c := fakeClient(t, func(*http.Request) (int, string, http.Header, error) { n++; return status, testToken, nil, nil })
			_, err := c.Fetch(context.Background(), 1)
			if err == nil || strings.Contains(err.Error(), testToken) {
				t.Fatal("provider error leaked")
			}
			if status != 500 && status != 429 && n != 1 || n > 3 {
				t.Fatal("unexpected retries")
			}
		})
	}
	c = fakeClient(t, func(*http.Request) (int, string, http.Header, error) {
		return 429, testToken, http.Header{"Retry-After": []string{"120"}}, nil
	})
	_, err := c.Fetch(context.Background(), 1)
	if err == nil || err.Error() != "retry_later" {
		t.Fatal("long retry-after retried early")
	}
	c = fakeClient(t, func(*http.Request) (int, string, http.Header, error) { return 0, "", nil, errors.New(testToken) })
	_, err = c.Fetch(context.Background(), 1)
	if err == nil || strings.Contains(err.Error(), testToken) {
		t.Fatal("transport secret leaked")
	}
	c = fakeClient(t, func(*http.Request) (int, string, http.Header, error) {
		return 200, strings.Repeat("x", (2<<20)+1), nil, nil
	})
	if _, err = c.Fetch(context.Background(), 1); err == nil {
		t.Fatal("oversized payload accepted")
	}
	c = fakeClient(t, func(*http.Request) (int, string, http.Header, error) { return 200, "{}", nil, nil })
	if err = c.http.CheckRedirect(nil, nil); err != http.ErrUseLastResponse {
		t.Fatal("redirects allowed")
	}
}
func TestHTTPDateAndCancellation(t *testing.T) {
	now := time.Now().UTC().Truncate(time.Second)
	c := fakeClient(t, func(*http.Request) (int, string, http.Header, error) {
		return 503, "", http.Header{"Retry-After": []string{now.Add(3 * time.Second).Format(http.TimeFormat)}}, nil
	})
	c.now = func() time.Time { return now }
	var delay time.Duration
	c.sleep = func(_ context.Context, d time.Duration) error { delay = d; return context.Canceled }
	_, err := c.Fetch(context.Background(), 1)
	if err == nil || delay != 3*time.Second {
		t.Fatal("HTTP-date/cancellation not respected")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if wait(ctx, time.Hour) == nil {
		t.Fatal("stop cannot interrupt wait")
	}
}
func TestImportPartialResumeIdempotentAndArtifact(t *testing.T) {
	s := selection()
	s2 := MappingTemplate().Movies[1]
	s2.TMDBID = s.TMDBID + 1
	s2.Reviewed = true
	m := Mapping{Movies: []Selection{s, s2}}
	calls := 0
	c := fakeClient(t, func(r *http.Request) (int, string, http.Header, error) {
		calls++
		if strings.Contains(r.URL.Path, fmt.Sprint(s2.TMDBID)) {
			return 200, mockBody(s2), nil, nil
		}
		return 200, mockBody(s), nil, nil
	})
	writes := 0
	persist := func(Checkpoint) error { writes++; return nil }
	checkpoint, a, err := Import(context.Background(), m, Checkpoint{}, c, 1, deadline(), time.Now(), persist)
	if err == nil || a != nil || len(checkpoint.Results) != 1 || calls != 1 || writes != 1 {
		t.Fatal("partial import published")
	}
	checkpoint, a, err = Import(context.Background(), m, checkpoint, c, 40, deadline(), time.Now(), persist)
	if err != nil || a == nil || calls != 2 {
		t.Fatal("resume failed", err)
	}
	oldRevision := a.CatalogRevision
	_, again, err := Import(context.Background(), m, checkpoint, c, 40, deadline(), time.Now(), persist)
	if err != nil || again.CatalogRevision != oldRevision || calls != 2 {
		t.Fatal("rerun not idempotent")
	}
	movies, err := a.Movies(time.Now())
	if err != nil || len(movies) != 2 {
		t.Fatal("invalid complete artifact", err)
	}
	bad := *a
	bad.Projection += " "
	if _, err = bad.Movies(time.Now()); err == nil {
		t.Fatal("revision tampering accepted")
	}
	m.Movies[0].TMDBID++
	if _, _, err = Import(context.Background(), m, checkpoint, c, 40, deadline(), time.Now(), persist); err == nil {
		t.Fatal("mapping drift accepted")
	}
}
func TestImportFailureStopsWithoutCheckpointSecrets(t *testing.T) {
	s := selection()
	m := Mapping{Movies: []Selection{s}}
	c := fakeClient(t, func(*http.Request) (int, string, http.Header, error) { return 403, testToken, nil, nil })
	cp, a, err := Import(context.Background(), m, Checkpoint{}, c, 40, deadline(), time.Now(), nil)
	data, _ := json.Marshal(cp)
	if err == nil || a != nil || strings.Contains(string(data), testToken) || cp.Results[0].Code != "access_denied" {
		t.Fatal("failed access leaked/published")
	}
	s2 := s
	s2.SampleID = "outside-sample"
	if (Mapping{Movies: []Selection{s2}}).Validate() == nil {
		t.Fatal("unbounded selection")
	}
	s2 = s
	if (Mapping{Movies: []Selection{s, s2}}).Validate() == nil {
		t.Fatal("duplicate mapping")
	}
	dir := t.TempDir()
	path := filepath.Join(dir, "private.json")
	if WritePrivate(path, cp) != nil {
		t.Fatal("private checkpoint write")
	}
	info, _ := os.Stat(path)
	if info.Mode().Perm() != 0600 {
		t.Fatal("checkpoint permissions")
	}
}

func TestFortyLimitAndRerun(t *testing.T) {
	mapping := MappingTemplate()
	bodies := map[string]string{}
	for i := range mapping.Movies {
		mapping.Movies[i].TMDBID = int64(900000100 + i)
		mapping.Movies[i].Reviewed = true
		bodies[fmt.Sprintf("/3/movie/%d", mapping.Movies[i].TMDBID)] = mockBody(mapping.Movies[i])
	}
	calls := 0
	c := fakeClient(t, func(r *http.Request) (int, string, http.Header, error) {
		calls++
		return 200, bodies[r.URL.Path], nil, nil
	})
	cp, a, err := Import(context.Background(), mapping, Checkpoint{}, c, 40, deadline(), time.Now(), nil)
	if err != nil || a == nil || calls != 40 || len(cp.Results) != 40 {
		t.Fatal("forty-film bound failed", err)
	}
	_, again, err := Import(context.Background(), mapping, cp, c, 40, deadline(), time.Now(), nil)
	if err != nil || again.CatalogRevision != a.CatalogRevision || calls != 40 {
		t.Fatal("complete sample fetched again")
	}
	if _, _, err = Import(context.Background(), mapping, cp, c, 41, deadline(), time.Now(), nil); err == nil {
		t.Fatal("unbounded limit accepted")
	}
}
