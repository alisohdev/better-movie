package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"bettermovie/internal/catalog"
)

type stubBackend struct {
	err   error
	calls int
	last  catalog.Filter
}

func (b *stubBackend) Health(context.Context) error { b.calls++; return b.err }
func (b *stubBackend) Search(_ context.Context, filter catalog.Filter) (catalog.Page, error) {
	b.calls++
	b.last = filter
	return catalog.Page{Items: []catalog.Movie{}, Total: 0, Page: filter.Page, PageSize: 12, CatalogRevision: catalog.Revision}, b.err
}
func (b *stubBackend) Detail(context.Context, string) (catalog.Detail, error) {
	b.calls++
	return catalog.Detail{CatalogRevision: catalog.Revision}, b.err
}

func TestInvalidFiltersNeverReachTheDatabase(t *testing.T) {
	for _, query := range []string{
		"languages=xx", "languages=en,en", "languages=en&languages=fa", "languages=", "languages=EN", "countries=ZZ", "countries=ir", "countries=IR,", "countries=IR,IR", "countries=IR&countries=US", "ratingMin=NaN", "ratingMin=Infinity", "ratingMin=1e1", "ratingMin=-1", "ratingMin=10.01", "ratingMin=", "ratingMin=7&ratingMin=8", "voteCountMin=-1", "voteCountMin=2.5", "voteCountMin=2147483648", "voteCountMin=0&voteCountMin=1", "ratingMin=" + strings.Repeat("0", 4097),
		"title=hello", "country=IR", "language=en", "pageSize=100", "scoreMin=8", "genres=western",
		"genres=drama&excludeGenres=drama", "genreMode=either", "sort=random", "v=2", "v=1&v=1",
		"page=1&page=2", "genres=drama&genres=comedy", "genres=drama,drama", "genres=drama,", "genres=",
		"yearMin=2025&yearMax=2020", "runtimeMin=100&runtimeMax=99", "yearMin=1887", "yearMax=2101",
		"runtimeMin=0", "runtimeMax=601", "yearMin=2020.5", "runtimeMin=-1", "page=0", "page=10001",
		"page=999999999999999999999", "page=+1", "page=", "sort=popularity%27%3BDROP+TABLE+movies",
		"genres=drama%27+OR+1%3D1--", "%zz=1", "page=1;sort=rating", "page=1&sort=",
	} {
		t.Run(query, func(t *testing.T) {
			backend := &stubBackend{}
			response := httptest.NewRecorder()
			New(backend).ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/movies?"+query, nil))
			if response.Code != http.StatusBadRequest || backend.calls != 0 {
				t.Fatalf("invalid filters were ignored: status=%d database calls=%d", response.Code, backend.calls)
			}
			var body struct {
				Error struct {
					Code string `json:"code"`
				} `json:"error"`
			}
			if json.Unmarshal(response.Body.Bytes(), &body) != nil || body.Error.Code != "invalid_filters" {
				t.Fatal("invalid filter response does not match the public envelope")
			}
		})
	}
}

func TestValidFiltersReachBackendWithBounds(t *testing.T) {
	backend := &stubBackend{}
	response := httptest.NewRecorder()
	New(backend).ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/movies?v=1&genres=drama,romance&genreMode=all&excludeGenres=horror&yearMin=1888&yearMax=2100&runtimeMin=1&runtimeMax=600&sort=rating&page=10000", nil))
	if response.Code != http.StatusOK || backend.calls != 1 || backend.last.Page != 10000 || backend.last.GenreMode != "all" || backend.last.Sort != "rating" || *backend.last.YearMin != 1888 || *backend.last.RuntimeMax != 600 {
		t.Fatal("valid filters did not reach the backend intact")
	}
	if response.Header().Get("Cache-Control") != "public, max-age=15, s-maxage=30" {
		t.Fatal("successful results lack an explicit short cache policy")
	}
}

func TestMethodsAndUnknownRoutes(t *testing.T) {
	for _, route := range []string{"/api/health", "/api/movies", "/api/movies/the-space-between", "/api/titles?q=orbit"} {
		for _, method := range []string{http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodPatch, http.MethodOptions} {
			backend := &stubBackend{}
			response := httptest.NewRecorder()
			New(backend).ServeHTTP(response, httptest.NewRequest(method, route, nil))
			if response.Code != 405 || response.Header().Get("Allow") != "GET, HEAD" || backend.calls != 0 {
				t.Fatalf("%s %s was not rejected before database access", method, route)
			}
		}
		backend := &stubBackend{}
		response := httptest.NewRecorder()
		New(backend).ServeHTTP(response, httptest.NewRequest(http.MethodHead, route, nil))
		if response.Code != 200 || response.Body.Len() != 0 || backend.calls != 1 {
			t.Fatalf("HEAD %s must be read-only and return no body", route)
		}
	}
	for _, route := range []string{"/", "/api/unknown", "/api/movies/", "/api/movies/a/b"} {
		response := httptest.NewRecorder()
		New(&stubBackend{}).ServeHTTP(response, httptest.NewRequest(http.MethodGet, route, nil))
		if response.Code != 404 {
			t.Fatalf("unknown route %s returned %d", route, response.Code)
		}
	}
}

func TestErrorsAreSanitizedAndNeverReturnFixtureFallback(t *testing.T) {
	for _, route := range []string{"/api/health", "/api/movies", "/api/movies/the-space-between", "/api/titles?q=orbit"} {
		backend := &stubBackend{err: errors.New("postgres://movie:private-secret@db.example.test connection failed")}
		response := httptest.NewRecorder()
		New(backend).ServeHTTP(response, httptest.NewRequest(http.MethodGet, route, nil))
		body := response.Body.String()
		if response.Code != 503 || strings.Contains(body, "private-secret") || strings.Contains(body, "postgres://") || strings.Contains(body, "items") || response.Header().Get("Cache-Control") != "no-store" {
			t.Fatalf("database failure was exposed or broadened: status=%d body=%s", response.Code, body)
		}
	}
	response := httptest.NewRecorder()
	New(&stubBackend{err: catalog.ErrNotFound}).ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/movies/missing", nil))
	if response.Code != 404 {
		t.Fatal("missing movie must return 404")
	}
}

func TestTechnicalAndResourceSpecificQueriesAreRejected(t *testing.T) {
	for _, route := range []string{"/api/movies?__route=health", "/api/health?page=1", "/api/movies/a?genres=drama"} {
		backend := &stubBackend{}
		response := httptest.NewRecorder()
		New(backend).ServeHTTP(response, httptest.NewRequest(http.MethodGet, route, nil))
		if response.Code != 400 || backend.calls != 0 {
			t.Fatal("technical or ignored resource-specific query reached the backend")
		}
	}
}

func (b *stubBackend) Lookup(_ context.Context, query string) (catalog.TitleLookup, error) {
	b.calls++
	return catalog.TitleLookup{Items: []catalog.TitleSuggestion{}, CatalogRevision: catalog.Revision}, b.err
}

func TestInvalidTitleQueriesNeverReachDatabase(t *testing.T) {
	for _, query := range []string{"", "q=a&q=b", "q=a&genres=drama", "q=a&v=2", "q=a&v=1&v=1", "q=%zz", "q=%00", "q=%FF", "q=%E2%80%AE", "q=" + strings.Repeat("a", 121), "q=" + strings.Repeat("a", 4097)} {
		backend := &stubBackend{}
		response := httptest.NewRecorder()
		New(backend).ServeHTTP(response, httptest.NewRequest("GET", "/api/titles?"+query, nil))
		if response.Code != 400 || backend.calls != 0 {
			t.Fatalf("invalid %q: %d, %d calls", query, response.Code, backend.calls)
		}
	}
}

func TestTitleLookupHTTPStates(t *testing.T) {
	for _, query := range []string{"q=", "q=Orbit", "q=Orbit+%D9%85%D8%AF%D8%A7%D8%B1&v=1", "q=%25_%27"} {
		backend := &stubBackend{}
		response := httptest.NewRecorder()
		New(backend).ServeHTTP(response, httptest.NewRequest("GET", "/api/titles?"+query, nil))
		if response.Code != 200 || backend.calls != 1 || response.Header().Get("Cache-Control") != "no-store" || !strings.Contains(response.Body.String(), `"items":[]`) {
			t.Fatalf("lookup: %d %s", response.Code, response.Body)
		}
	}
}

func TestAdvancedFilterHTTPBoundaries(t *testing.T) {
	for _, score := range []string{"0", "10", "7.25"} {
		backend := &stubBackend{}
		response := httptest.NewRecorder()
		New(backend).ServeHTTP(response, httptest.NewRequest("GET", "/api/movies?v=1&languages=fa,en&countries=IR,US&ratingMin="+score+"&voteCountMin=0", nil))
		if response.Code != 200 || backend.calls != 1 || len(backend.last.Languages) != 2 || len(backend.last.Countries) != 2 || backend.last.RatingMin == nil || backend.last.VoteCountMin == nil || *backend.last.VoteCountMin != 0 {
			t.Fatalf("advanced filters lost: %d %#v", response.Code, backend.last)
		}
	}
	backend := &stubBackend{}
	New(backend).ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/api/movies?ratingMin=8", nil))
	if backend.last.VoteCountMin != nil {
		t.Fatal("rating silently introduced a vote threshold")
	}
}
