package catalog

import "regexp"

var tmdbRevision = regexp.MustCompile(`^tmdb-[a-f0-9]{64}$`)

func ValidTMDBRevision(revision string) bool { return tmdbRevision.MatchString(revision) }
func StagingSchema(revision string) string {
	if !ValidTMDBRevision(revision) {
		return ""
	}
	return "tmdb_" + revision[5:45]
}
