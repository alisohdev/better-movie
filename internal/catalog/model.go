package catalog

type ReleaseObservation struct {
	EventType    string  `json:"eventType"`
	Date         *string `json:"date"`
	Country      string  `json:"country"`
	Source       string  `json:"source"`
	CheckedAt    string  `json:"checkedAt"`
	Verification string  `json:"verification"`
}

type Provenance struct {
	ProviderID  int64  `json:"providerId"`
	SampleID    string `json:"sampleId"`
	SourceURL   string `json:"sourceUrl"`
	RetrievedAt string `json:"retrievedAt"`
	RetainUntil string `json:"retainUntil"`
}

type Movie struct {
	Aliases             []string             `json:"aliases,omitempty"`
	Provenance          *Provenance          `json:"provenance,omitempty"`
	ID                  string               `json:"id"`
	TitleEn             string               `json:"titleEn"`
	TitleFa             *string              `json:"titleFa"`
	OriginalTitle       string               `json:"originalTitle"`
	SynopsisEn          string               `json:"synopsisEn"`
	SynopsisFa          *string              `json:"synopsisFa"`
	Year                *int32               `json:"year"`
	Runtime             *int32               `json:"runtime"`
	Rating              *float64             `json:"rating"`
	VoteCount           *int32               `json:"voteCount"`
	Popularity          float64              `json:"popularity"`
	Genres              []string             `json:"genres"`
	OriginalLanguage    *string              `json:"originalLanguage"`
	Countries           []string             `json:"countries"`
	Poster              string               `json:"poster"`
	Source              string               `json:"source"`
	Synthetic           bool                 `json:"synthetic"`
	ReleaseObservations []ReleaseObservation `json:"releaseObservations"`
}

const PageSize int32 = 12

type Page struct {
	Items           []Movie `json:"items"`
	Total           int64   `json:"total"`
	Page            int32   `json:"page"`
	PageSize        int32   `json:"pageSize"`
	CatalogRevision string  `json:"catalogRevision"`
}

type Detail struct {
	Movie           Movie  `json:"movie"`
	CatalogRevision string `json:"catalogRevision"`
}
