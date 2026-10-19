package tmdb

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"regexp"
	"sort"
	"strings"
	"time"
	"unicode"

	audit "bettermovie/docs/audit"
	"bettermovie/internal/catalog"
	"golang.org/x/text/unicode/norm"
)

type Target struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Year  int32  `json:"year"`
}
type Selection struct {
	SampleID   string `json:"sampleId"`
	TMDBID     int64  `json:"tmdbId"`
	MatchTitle string `json:"matchTitle"`
	Reviewed   bool   `json:"reviewed"`
}
type Mapping struct {
	Movies []Selection `json:"movies"`
}
type Details struct {
	ID               int64    `json:"id"`
	Title            string   `json:"title"`
	OriginalTitle    string   `json:"original_title"`
	ReleaseDate      string   `json:"release_date"`
	Adult            bool     `json:"adult"`
	Video            bool     `json:"video"`
	Runtime          *int32   `json:"runtime"`
	Rating           *float64 `json:"vote_average"`
	Votes            *int32   `json:"vote_count"`
	Popularity       *float64 `json:"popularity"`
	OriginalLanguage string   `json:"original_language"`
	Countries        []struct {
		Code string `json:"iso_3166_1"`
	} `json:"production_countries"`
	Genres []struct {
		ID int64 `json:"id"`
	} `json:"genres"`
	Translations struct {
		Items []struct {
			Language string `json:"iso_639_1"`
			Data     struct {
				Title string `json:"title"`
			} `json:"data"`
		} `json:"translations"`
	} `json:"translations"`
	AlternativeTitles struct {
		Items []struct {
			Title string `json:"title"`
		} `json:"titles"`
	} `json:"alternative_titles"`
}

var targets map[string]Target
var SampleHash string

func init() {
	var manifest struct {
		Films []Target `json:"films"`
	}
	if json.Unmarshal([]byte(audit.SampleJSON), &manifest) != nil || len(manifest.Films) != 40 {
		panic("invalid frozen sample")
	}
	targets = map[string]Target{}
	for _, film := range manifest.Films {
		targets[film.ID] = film
	}
	sum := sha256.Sum256([]byte(audit.SampleJSON))
	SampleHash = hex.EncodeToString(sum[:])
}
func MappingTemplate() Mapping {
	m := Mapping{}
	var manifest struct {
		Films []Target `json:"films"`
	}
	_ = json.Unmarshal([]byte(audit.SampleJSON), &manifest)
	for _, f := range manifest.Films {
		m.Movies = append(m.Movies, Selection{SampleID: f.ID, MatchTitle: f.Title})
	}
	return m
}
func (m Mapping) Validate() error {
	if len(m.Movies) < 1 || len(m.Movies) > 40 {
		return errors.New("select 1 through 40 frozen sample rows")
	}
	seen, ids := map[string]bool{}, map[int64]bool{}
	for _, s := range m.Movies {
		if _, ok := targets[s.SampleID]; !ok || seen[s.SampleID] || ids[s.TMDBID] || s.TMDBID <= 0 || !s.Reviewed || !safeText(s.MatchTitle, 200) {
			return errors.New("mapping needs unique frozen sample IDs, unique positive TMDB IDs, reviewed titles and explicit review")
		}
		seen[s.SampleID] = true
		ids[s.TMDBID] = true
	}
	return nil
}

var genres = map[int64]string{28: "action", 12: "adventure", 16: "animation", 35: "comedy", 80: "crime", 99: "documentary", 18: "drama", 10751: "family", 14: "fantasy", 36: "history", 27: "horror", 10402: "music", 9648: "mystery", 10749: "romance", 878: "science-fiction", 53: "thriller", 10752: "war", 37: "western"}
var lang = regexp.MustCompile(`^[a-z]{2,3}$`)
var country = regexp.MustCompile(`^[A-Z]{2}$`)

func safeText(s string, limit int) bool {
	if strings.TrimSpace(s) == "" || len([]rune(s)) > limit {
		return false
	}
	for _, r := range s {
		if unicode.IsControl(r) || unicode.Is(unicode.Cf, r) && r != '\u200c' {
			return false
		}
	}
	return true
}
func normalized(s string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(norm.NFKC.String(s)) {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(r)
		}
	}
	return b.String()
}
func ptr[T any](v T) *T { return &v }
func Project(d Details, s Selection, now time.Time, retain string) (catalog.Movie, error) {
	fail := func() (catalog.Movie, error) { return catalog.Movie{}, errors.New("identity_or_metadata_rejected") }
	target, ok := targets[s.SampleID]
	if !ok || !s.Reviewed || d.ID != s.TMDBID || d.ID <= 0 || d.Adult || d.Video || !safeText(d.OriginalTitle, 200) {
		return fail()
	}
	released, err := time.Parse(time.DateOnly, d.ReleaseDate)
	if err != nil || int32(released.Year()) != target.Year {
		return fail()
	}
	aliases := []string{}
	seen := map[string]bool{}
	add := func(value string) {
		value = strings.TrimSpace(value)
		if safeText(value, 200) && !seen[value] && len(aliases) < 32 {
			seen[value] = true
			aliases = append(aliases, value)
		}
	}
	add(d.Title)
	add(d.OriginalTitle)
	var fa *string
	for _, t := range d.Translations.Items {
		if t.Language == "fa" || t.Language == "en" {
			add(t.Data.Title)
		}
		if t.Language == "fa" && safeText(strings.TrimSpace(t.Data.Title), 200) {
			value := strings.TrimSpace(t.Data.Title)
			if fa != nil && *fa != value {
				return fail()
			}
			fa = ptr(value)
		}
	}
	for _, a := range d.AlternativeTitles.Items {
		add(a.Title)
	}
	matches := false
	for _, title := range aliases {
		if normalized(title) == normalized(s.MatchTitle) {
			matches = true
		}
	}
	if !matches {
		return fail()
	}
	title := strings.TrimSpace(d.Title)
	if !safeText(title, 200) {
		title = d.OriginalTitle
	}
	m := catalog.Movie{ID: fmt.Sprintf("tmdb-%d", d.ID), TitleEn: title, TitleFa: fa, OriginalTitle: d.OriginalTitle, SynopsisEn: "", Runtime: d.Runtime, Rating: d.Rating, VoteCount: d.Votes, Year: ptr(target.Year), Genres: []string{}, Countries: []string{}, Poster: "/posters/placeholder.svg", Source: "TMDB", Synthetic: false, ReleaseObservations: []catalog.ReleaseObservation{}, Aliases: aliases, Provenance: &catalog.Provenance{ProviderID: d.ID, SampleID: s.SampleID, SourceURL: fmt.Sprintf("https://www.themoviedb.org/movie/%d", d.ID), RetrievedAt: now.UTC().Format(time.RFC3339), RetainUntil: retain}}
	if m.Runtime != nil && *m.Runtime == 0 {
		m.Runtime = nil
	}
	if d.Popularity != nil {
		m.Popularity = *d.Popularity
	}
	if d.OriginalLanguage != "" {
		if !lang.MatchString(d.OriginalLanguage) {
			return fail()
		}
		m.OriginalLanguage = ptr(d.OriginalLanguage)
	}
	for _, c := range d.Countries {
		if !country.MatchString(c.Code) {
			return fail()
		}
		if !contains(m.Countries, c.Code) {
			m.Countries = append(m.Countries, c.Code)
		}
	}
	for _, g := range d.Genres {
		slug, ok := genres[g.ID]
		if !ok {
			return fail()
		}
		if !contains(m.Genres, slug) {
			m.Genres = append(m.Genres, slug)
		}
	}
	sort.Strings(m.Genres)
	sort.Strings(m.Countries)
	if ValidateMovie(m, now) != nil {
		return fail()
	}
	return m, nil
}
func contains(values []string, s string) bool {
	for _, v := range values {
		if v == s {
			return true
		}
	}
	return false
}
func ValidateMovie(m catalog.Movie, now time.Time) error {
	bad := errors.New("invalid TMDB projection")
	p := m.Provenance
	if p == nil || m.Source != "TMDB" || m.Synthetic || m.ID != fmt.Sprintf("tmdb-%d", p.ProviderID) || p.ProviderID <= 0 || p.SourceURL != fmt.Sprintf("https://www.themoviedb.org/movie/%d", p.ProviderID) {
		return bad
	}
	target, ok := targets[p.SampleID]
	if !ok || m.Year == nil || *m.Year != target.Year || !safeText(m.TitleEn, 200) || !safeText(m.OriginalTitle, 200) || (m.TitleFa != nil && !safeText(*m.TitleFa, 200)) {
		return bad
	}
	retrieved, e1 := time.Parse(time.RFC3339, p.RetrievedAt)
	until, e2 := time.Parse(time.DateOnly, p.RetainUntil)
	if e1 != nil || e2 != nil || retrieved.After(now.Add(time.Minute)) || until.Before(now.UTC().Truncate(24*time.Hour)) || until.Before(retrieved.UTC().Truncate(24*time.Hour)) {
		return bad
	}
	if m.SynopsisEn != "" || m.SynopsisFa != nil || m.Poster != "/posters/placeholder.svg" || len(m.ReleaseObservations) != 0 || m.ReleaseObservations == nil {
		return bad
	}
	if m.Runtime != nil && (*m.Runtime < 1 || *m.Runtime > 600) || m.Rating != nil && (math.IsNaN(*m.Rating) || *m.Rating < 0 || *m.Rating > 10) || m.VoteCount != nil && *m.VoteCount < 0 || math.IsNaN(m.Popularity) || math.IsInf(m.Popularity, 0) || m.Popularity < 0 {
		return bad
	}
	if m.Genres == nil || m.Countries == nil || len(m.Countries) > 16 || len(m.Aliases) > 32 {
		return bad
	}
	for _, g := range m.Genres {
		if !catalog.KnownGenre(g) {
			return bad
		}
	}
	for _, c := range m.Countries {
		if !country.MatchString(c) {
			return bad
		}
	}
	for _, a := range m.Aliases {
		if !safeText(a, 200) {
			return bad
		}
	}
	if m.OriginalLanguage != nil && !lang.MatchString(*m.OriginalLanguage) {
		return bad
	}
	return nil
}
