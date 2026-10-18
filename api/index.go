package handler

import (
	"io"
	"net/http"
	"net/url"
	"regexp"

	"bettermovie/httpapi"
)

var application = httpapi.NewFromEnvironment()

var canonicalRoute = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*(/[a-z0-9]+(-[a-z0-9]+)*)*$`)

func Handler(w http.ResponseWriter, r *http.Request) {
	routeRequest(application, w, r)
}

// Vercel carries the route in the query and may preserve the public path.
// Accept either representation only when it agrees with the canonical route.
func routeRequest(next http.Handler, w http.ResponseWriter, r *http.Request) {
	values, err := url.ParseQuery(r.URL.RawQuery)
	if err != nil {
		invalidRoute(w, r)
		return
	}
	routes, present := values["__route"]
	if !present {
		next.ServeHTTP(w, r)
		return
	}
	if len(routes) != 1 || len(routes[0]) > 200 || !canonicalRoute.MatchString(routes[0]) {
		invalidRoute(w, r)
		return
	}
	if r.URL.Path != "/api/index" && r.URL.Path != "/api/"+routes[0] {
		invalidRoute(w, r)
		return
	}
	// The named Vercel wildcard also becomes a query parameter. Consume only
	// the single matching value, so conflicting or duplicate input is rejected.
	if paths, ok := values["path"]; ok {
		if len(paths) != 1 || paths[0] != routes[0] {
			invalidRoute(w, r)
			return
		}
		delete(values, "path")
	}
	delete(values, "__route")
	request := r.Clone(r.Context())
	request.URL.Path = "/api/" + routes[0]
	request.URL.RawPath = ""
	request.URL.RawQuery = values.Encode()
	request.URL.ForceQuery = false
	request.RequestURI = request.URL.RequestURI()
	next.ServeHTTP(w, request)
}

func invalidRoute(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusBadRequest)
	if r.Method != http.MethodHead {
		_, _ = io.WriteString(w, "{\"error\":{\"code\":\"invalid_route\",\"message\":\"The API route is invalid.\"}}\n")
	}
}
