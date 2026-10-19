package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRevisionMismatchStopsBeforeBackend(t *testing.T) {
	backend := &stubBackend{}
	handler := New(backend)
	request := httptest.NewRequest(http.MethodGet, "/api/movies?v=1", nil)
	request.Header.Set("X-Catalog-Revision", "tmdb-wrong")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if backend.calls != 0 || response.Code != 409 || response.Header().Get("Cache-Control") != "no-store" || response.Header().Get("Vary") != "X-Catalog-Revision" {
		t.Fatal("mismatch not closed", response.Code)
	}
}
