package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"bettermovie/internal/catalog"
	"bettermovie/internal/httpapi"
	"bettermovie/internal/testdb"
)

func TestPostgresFunctionRewrite(t *testing.T) {
	pool := testdb.Open(t)
	app := httpapi.New(catalog.NewStore(pool))
	for _, test := range []struct {
		target string
		status int
	}{
		{"/api/index?__route=health", 200},
		{"/api/index?__route=movies&genres=drama,romance&genreMode=all", 200},
		{"/api/index?__route=movies/the-space-between", 200},
		{"/api/index?__route=unknown", 404},
		{"/api/index?__route=movies/missing", 404},
		{"/api/index?__route=movies&page=1&page=2", 400},
		{"/api/index?__route=movies&unknown=1", 400},
	} {
		t.Run(test.target, func(t *testing.T) {
			response := httptest.NewRecorder()
			routeRequest(app, response, httptest.NewRequest(http.MethodGet, test.target, nil))
			if response.Code != test.status {
				t.Fatalf("adapter status=%d want=%d body=%s", response.Code, test.status, response.Body.String())
			}
			if test.target == "/api/index?__route=movies&genres=drama,romance&genreMode=all" {
				var page catalog.Page
				if json.Unmarshal(response.Body.Bytes(), &page) != nil || page.Total != 3 || len(page.Items) != 3 {
					t.Fatal("rewritten query did not filter the actual database")
				}
			}
		})
	}
}
