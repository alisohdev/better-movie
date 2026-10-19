// Generates only self-authored test projections; never calls a provider or reads a token.
// CI uses this to test the real-data build/runtime mode against an isolated schema.
package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"time"

	audit "bettermovie/docs/audit"
	"bettermovie/internal/catalog"
	"bettermovie/internal/database"
	"bettermovie/internal/tmdb"
)

func main() {
	if os.Getenv("TMDB_TEST_FIXTURE") != "1" {
		panic("test fixture acknowledgement required")
	}
	var sample struct {
		Films []struct {
			ID    string `json:"id"`
			Title string `json:"title"`
			Year  int    `json:"year"`
		} `json:"films"`
	}
	if json.Unmarshal([]byte(audit.SampleJSON), &sample) != nil {
		panic("sample")
	}
	movies := []catalog.Movie{}
	for i, f := range sample.Films[:13] {
		raw := fmt.Sprintf(`{"id":%d,"title":"Audit Feature %02d","original_title":"Self-authored original %02d","release_date":"%d-01-01","runtime":%d,"vote_average":null,"vote_count":0,"popularity":%d,"adult":false,"video":false,"original_language":"en","production_countries":[{"iso_3166_1":"US"}],"genres":[{"id":18}],"translations":{"translations":[{"iso_639_1":"fa","data":{"title":""}}]},"alternative_titles":{"titles":[{"title":%q},{"title":"FixtureAlias %02d"}]}}`, 900000100+i, i+1, i+1, f.Year, 90+i, 100-i, f.Title, i+1)
		var d tmdb.Details
		if json.Unmarshal([]byte(raw), &d) != nil {
			panic("self-authored fixture invalid")
		}
		m, err := tmdb.Project(d, tmdb.Selection{SampleID: f.ID, TMDBID: int64(900000100 + i), MatchTitle: f.Title, Reviewed: true}, time.Now(), time.Now().AddDate(0, 1, 0).Format(time.DateOnly))
		if err != nil {
			panic("test projection invalid")
		}
		movies = append(movies, m)
	}
	projection, _ := json.Marshal(movies)
	sum := sha256.Sum256(projection)
	a := tmdb.Artifact{CatalogRevision: "tmdb-" + hex.EncodeToString(sum[:]), SampleHash: tmdb.SampleHash, Notice: "SELF-AUTHORED TEST DATA", Projection: string(projection)}
	if os.Getenv("TMDB_TEST_NO_DATABASE") != "1" {
		pool, err := database.Open(context.Background(), os.Getenv("TEST_DATABASE_URL"))
		if err != nil {
			panic("isolated test database unavailable")
		}
		defer pool.Close()
		if tmdb.Stage(context.Background(), pool, a) != nil {
			panic("test stage failed")
		}
	}
	if tmdb.WritePrivate(".local/tmdb-test-artifact.json", a) != nil {
		panic("test artifact write failed")
	}
	fmt.Println(a.CatalogRevision)
}
