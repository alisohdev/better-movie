package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strings"

	"bettermovie/internal/catalog"
)

type Backend interface {
	Health(context.Context) error
	Search(context.Context, catalog.Filter) (catalog.Page, error)
	Lookup(context.Context, string) (catalog.TitleLookup, error)
	Detail(context.Context, string) (catalog.Detail, error)
}

type Handler struct {
	backend  Backend
	revision string
}

func New(backend Backend) http.Handler {
	revision := catalog.Revision
	if source, ok := backend.(interface{ CatalogRevision() string }); ok {
		revision = source.CatalogRevision()
	}
	return &Handler{backend: backend, revision: revision}
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Vary", "X-Catalog-Revision")
	expected := r.Header.Get("X-Catalog-Revision")
	if r.URL.Path != "/api/health" && (expected != "" && expected != h.revision || h.revision != catalog.Revision && expected == "") {
		writeError(w, r, http.StatusConflict, "catalog_revision_mismatch", "The page and API catalog revisions do not match.")
		return
	}
	path := r.URL.Path
	isDetail := strings.HasPrefix(path, "/api/movies/") && len(path) > len("/api/movies/") && !strings.Contains(strings.TrimPrefix(path, "/api/movies/"), "/")
	if path != "/api/health" && path != "/api/movies" && path != "/api/titles" && !isDetail {
		writeError(w, r, http.StatusNotFound, "not_found", "The requested resource was not found.")
		return
	}
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		writeError(w, r, http.StatusMethodNotAllowed, "method_not_allowed", "Use GET or HEAD for this resource.")
		return
	}
	if len(r.URL.RawQuery) > 4096 {
		code := "invalid_filters"
		if path == "/api/titles" {
			code = "invalid_query"
		}
		writeError(w, r, http.StatusBadRequest, code, "The query string is too long.")
		return
	}
	if path == "/api/titles" {
		h.lookup(w, r)
		return
	}
	filter, err := parseFilter(r.URL.RawQuery)
	if err != nil {
		writeError(w, r, http.StatusBadRequest, "invalid_filters", err.Error())
		return
	}
	if path != "/api/movies" {
		values, _ := url.ParseQuery(r.URL.RawQuery)
		for key := range values {
			if key != "v" {
				writeError(w, r, http.StatusBadRequest, "invalid_filters", "Only v=1 is accepted on this resource.")
				return
			}
		}
	}
	if path == "/api/health" {
		if err := h.backend.Health(r.Context()); err != nil {
			unavailable(w, r)
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		writeJSON(w, r, http.StatusOK, map[string]string{"status": "ok", "database": "connected", "catalogRevision": h.revision})
		return
	}
	if path == "/api/movies" {
		page, err := h.backend.Search(r.Context(), filter)
		if err != nil {
			unavailable(w, r)
			return
		}
		w.Header().Set("Cache-Control", "public, max-age=15, s-maxage=30")
		if h.revision != catalog.Revision {
			w.Header().Set("Cache-Control", "no-store")
		}
		writeJSON(w, r, http.StatusOK, page)
		return
	}
	detail, err := h.backend.Detail(r.Context(), strings.TrimPrefix(path, "/api/movies/"))
	if errors.Is(err, catalog.ErrNotFound) {
		writeError(w, r, http.StatusNotFound, "not_found", "The requested movie was not found.")
		return
	}
	if err != nil {
		unavailable(w, r)
		return
	}
	w.Header().Set("Cache-Control", "public, max-age=15, s-maxage=30")
	if h.revision != catalog.Revision {
		w.Header().Set("Cache-Control", "no-store")
	}
	writeJSON(w, r, http.StatusOK, detail)
}

func unavailable(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Retry-After", "1")
	writeError(w, r, http.StatusServiceUnavailable, "service_unavailable", "The catalog is temporarily unavailable.")
}

func writeJSON(w http.ResponseWriter, r *http.Request, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(status)
	if r.Method != http.MethodHead {
		_ = json.NewEncoder(w).Encode(value)
	}
}

func writeError(w http.ResponseWriter, r *http.Request, status int, code, message string) {
	w.Header().Set("Cache-Control", "no-store")
	type publicError struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	}
	writeJSON(w, r, status, struct {
		Error publicError `json:"error"`
	}{Error: publicError{Code: code, Message: message}})
}

func (h *Handler) lookup(w http.ResponseWriter, r *http.Request) {
	values, err := url.ParseQuery(r.URL.RawQuery)
	if err != nil || len(values["q"]) != 1 {
		writeError(w, r, 400, "invalid_query", "Supply one q title query.")
		return
	}
	for key, entries := range values {
		if (key != "q" && key != "v") || len(entries) != 1 || (key == "v" && entries[0] != "1") {
			writeError(w, r, 400, "invalid_query", "Only q and optional v=1 are accepted.")
			return
		}
	}
	if err := catalog.ValidateLookup(values.Get("q")); err != nil {
		writeError(w, r, 400, "invalid_query", err.Error())
		return
	}
	result, err := h.backend.Lookup(r.Context(), values.Get("q"))
	if err != nil {
		unavailable(w, r)
		return
	}
	// Search text is not retained in intermediary HTTP caches.
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, r, http.StatusOK, result)
}
