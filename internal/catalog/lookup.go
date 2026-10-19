package catalog

import (
	"context"
	"errors"
	"unicode"
	"unicode/utf8"

	"bettermovie/internal/dbgen"
)

const LookupLimit = 6
const LookupMaxRunes = 120

// ValidateLookup bounds work before acquiring a connection. Unicode text and
// whitespace are accepted; control/format characters other than ZWNJ are not.
func ValidateLookup(query string) error {
	if !utf8.ValidString(query) || utf8.RuneCountInString(query) > LookupMaxRunes {
		return errors.New("Use at most 120 characters for a title.")
	}
	for _, r := range query {
		if (unicode.IsControl(r) && !unicode.IsSpace(r)) || (unicode.Is(unicode.Cf, r) && r != '\u200c') {
			return errors.New("The title contains unsupported control characters.")
		}
	}
	return nil
}

type TitleSuggestion struct {
	ID            string  `json:"id"`
	TitleEn       string  `json:"titleEn"`
	TitleFa       *string `json:"titleFa"`
	OriginalTitle string  `json:"originalTitle"`
	Year          *int32  `json:"year"`
}

type TitleLookup struct {
	Items           []TitleSuggestion `json:"items"`
	CatalogRevision string            `json:"catalogRevision"`
}

func (s *Store) Lookup(ctx context.Context, query string) (TitleLookup, error) {
	result := TitleLookup{Items: []TitleSuggestion{}, CatalogRevision: s.revision}
	if err := ValidateLookup(query); err != nil {
		return result, err
	}
	err := s.read(ctx, func(ctx context.Context, queries *dbgen.Queries) error {
		if s.revision != Revision {
			rows, err := queries.LookupStagedTitles(ctx, query)
			if err != nil {
				return err
			}
			for _, row := range rows {
				result.Items = append(result.Items, TitleSuggestion{ID: row.ID, TitleEn: row.TitleEn, TitleFa: nullable(row.TitleFa.String, row.TitleFa.Valid), OriginalTitle: row.OriginalTitle, Year: nullable(row.Year.Int32, row.Year.Valid)})
			}
			return nil
		}
		rows, err := queries.LookupTitles(ctx, query)
		if err != nil {
			return err
		}
		for _, row := range rows {
			result.Items = append(result.Items, TitleSuggestion{
				ID: row.ID, TitleEn: row.TitleEn,
				TitleFa:       nullable(row.TitleFa.String, row.TitleFa.Valid),
				OriginalTitle: row.OriginalTitle, Year: nullable(row.Year.Int32, row.Year.Valid),
			})
		}
		return nil
	})
	return result, err
}
