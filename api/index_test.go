package handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRewriteAdapterPreservesPublicQueryAndRequest(t *testing.T) {
	for _, test := range []struct{ route, publicPath, query string }{
		{"health", "/api/health", ""},
		{"movies", "/api/movies", "genres=drama&genreMode=all&page=2"},
		{"movies/the-space-between", "/api/movies/the-space-between", "v=1"},
		{"unknown", "/api/unknown", ""},
		{"movies", "/api/movies", "page=1&page=2"},
	} {
		t.Run(test.route+test.query, func(t *testing.T) {
			original := httptest.NewRequest(http.MethodGet, "/api/index?__route="+test.route+"&"+test.query, nil)
			original.Header.Set("X-Trace", "preserved")
			before := original.URL.String()
			calls := 0
			next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls++
				if r.URL.Path != test.publicPath || r.URL.Query().Has("__route") || r.Header.Get("X-Trace") != "preserved" || r.Context() != original.Context() {
					t.Fatal("adapter changed public path, headers, context, or leaked technical state")
				}
				if strings.Contains(test.query, "genres=") && (r.URL.Query().Get("genres") != "drama" || r.URL.Query().Get("genreMode") != "all" || r.URL.Query().Get("page") != "2") {
					t.Fatal("public filters were not preserved")
				}
				if strings.Contains(test.query, "page=1&page=2") && len(r.URL.Query()["page"]) != 2 {
					t.Fatal("adapter hid duplicate public parameters from validation")
				}
				w.WriteHeader(204)
			})
			response := httptest.NewRecorder()
			routeRequest(next, response, original)
			if calls != 1 || response.Code != 204 || original.URL.String() != before {
				t.Fatal("adapter did not clone and dispatch exactly once")
			}
		})
	}
}

func TestMalformedTechnicalRoutesAreRejectedBeforeDispatch(t *testing.T) {
	for _, target := range []string{
		"/api/index?__route=", "/api/index?__route=movies&__route=health", "/api/index?__route=../health",
		"/api/index?__route=/health", "/api/index?__route=movies/", "/api/index?__route=movies//film",
		"/api/index?__route=movies%5Cfilm", "/api/index?__route=movies%00film", "/api/index?__route=%zz",
		"/api/index?__route=" + strings.Repeat("a", 201), "/api/movies?__route=health",
	} {
		t.Run(target, func(t *testing.T) {
			calls := 0
			next := http.HandlerFunc(func(http.ResponseWriter, *http.Request) { calls++ })
			response := httptest.NewRecorder()
			routeRequest(next, response, httptest.NewRequest(http.MethodGet, target, nil))
			if response.Code != 400 || calls != 0 || !strings.Contains(response.Body.String(), `"code":"invalid_route"`) {
				t.Fatal("malformed technical route reached public application")
			}
		})
	}
}

func TestDirectPortablePathDoesNotRequireRewriteState(t *testing.T) {
	called := false
	request := httptest.NewRequest(http.MethodGet, "/api/movies?genres=drama", nil)
	routeRequest(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		if r != request || r.URL.Path != "/api/movies" || r.URL.Query().Get("genres") != "drama" {
			t.Fatal("direct request was modified")
		}
	}), httptest.NewRecorder(), request)
	if !called {
		t.Fatal("direct public request was not dispatched")
	}
}

func TestRewriteWithPreservedPublicPath(t *testing.T) {
	for _, path := range []string{"health", "movies", "movies/the-space-between"} {
		t.Run(path, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodGet, "/api/"+path+"?__route="+path+"&v=1", nil)
			response := httptest.NewRecorder()
			routeRequest(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path != "/api/"+path || r.URL.Query().Has("__route") || r.URL.Query().Get("v") != "1" {
					t.Fatal("preserved route lost public query or leaked rewrite state")
				}
				w.WriteHeader(http.StatusNoContent)
			}), response, request)
			if response.Code != http.StatusNoContent {
				t.Fatalf("status=%d, want 204", response.Code)
			}
		})
	}
}
