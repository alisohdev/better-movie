package httpapi

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"testing"
	"time"

	"bettermovie/internal/catalog"
	"bettermovie/internal/testdb"
)

func TestPostgresHTTP(t *testing.T) {
	pool := testdb.Open(t)
	server := httptest.NewServer(New(catalog.NewStore(pool)))
	defer server.Close()
	client := &http.Client{Timeout: 5 * time.Second}
	for _, test := range []struct {
		method, path string
		status       int
	}{
		{"GET", "/api/health", 200},
		{"GET", "/api/movies", 200},
		{"GET", "/api/movies?genres=drama,romance&genreMode=all", 200},
		{"GET", "/api/movies/the-space-between", 200},
		{"GET", "/api/movies/missing", 404},
		{"GET", "/api/unknown", 404},
		{"GET", "/api/movies?genres=drama&excludeGenres=drama", 400},
		{"GET", "/api/movies?runtimeMin=601", 400},
		{"POST", "/api/movies", 405},
		{"HEAD", "/api/movies?genres=drama", 200},
	} {
		t.Run(test.method+" "+test.path, func(t *testing.T) {
			request, err := http.NewRequest(test.method, server.URL+test.path, nil)
			if err != nil {
				t.Fatal(err)
			}
			response, err := client.Do(request)
			if err != nil {
				t.Fatal(err)
			}
			defer response.Body.Close()
			body, err := io.ReadAll(response.Body)
			if err != nil || response.StatusCode != test.status {
				t.Fatalf("HTTP status=%d want=%d body=%s", response.StatusCode, test.status, body)
			}
			if test.method == "HEAD" && len(body) != 0 {
				t.Fatal("HEAD returned a response body")
			}
			if test.path == "/api/movies?genres=drama,romance&genreMode=all" {
				var page catalog.Page
				if json.Unmarshal(body, &page) != nil || page.Total != 3 || len(page.Items) != 3 || page.Items[0].ID != "the-space-between" {
					t.Fatal("HTTP filtering did not return the real SQL result")
				}
			}
		})
	}
	t.Run("closed database returns 503 without catalog fallback", func(t *testing.T) {
		pool.Close()
		response, err := client.Get(server.URL + "/api/movies")
		if err != nil {
			t.Fatal(err)
		}
		defer response.Body.Close()
		var body struct {
			Error struct {
				Code string `json:"code"`
			} `json:"error"`
			Items []catalog.Movie `json:"items"`
		}
		if response.StatusCode != 503 || json.NewDecoder(response.Body).Decode(&body) != nil || body.Error.Code != "service_unavailable" || body.Items != nil {
			t.Fatal("database outage did not return the sanitized 503 envelope")
		}
	})
}

func TestPostgresRuntimeRetriesMissingConfiguration(t *testing.T) {
	pool := testdb.Open(t)
	configured, err := url.Parse(os.Getenv("TEST_DATABASE_URL"))
	if err != nil {
		t.Fatal("invalid explicit test database URL")
	}
	values := configured.Query()
	values.Set("search_path", pool.Config().ConnConfig.RuntimeParams["search_path"])
	configured.RawQuery = values.Encode()
	runtime := NewFromEnvironment()
	defer runtime.Close()
	t.Setenv("DATABASE_URL", "")
	failed := httptest.NewRecorder()
	runtime.ServeHTTP(failed, httptest.NewRequest("GET", "/api/health", nil))
	if failed.Code != 503 {
		t.Fatal("missing configuration did not fail safely")
	}
	t.Setenv("DATABASE_URL", configured.String())
	recovered := httptest.NewRecorder()
	runtime.ServeHTTP(recovered, httptest.NewRequest("GET", "/api/health", nil))
	if recovered.Code != 200 {
		t.Fatal("a failed initialization was cached permanently")
	}
}
