package httpapi

import (
	"errors"
	"net/url"
	"regexp"
	"strconv"
	"strings"

	"bettermovie/internal/catalog"
)

var integerValue = regexp.MustCompile(`^[0-9]+$`)

func parseFilter(rawQuery string) (catalog.Filter, error) {
	f := catalog.DefaultFilter()
	values, err := url.ParseQuery(rawQuery)
	if err != nil {
		return f, errors.New("The query string is malformed.")
	}
	for key, entries := range values {
		if len(entries) != 1 || entries[0] == "" {
			return f, errors.New("Query parameters must have one nonempty value.")
		}
		value := entries[0]
		switch key {
		case "genres":
			f.Genres = strings.Split(value, ",")
		case "excludeGenres":
			f.ExcludeGenres = strings.Split(value, ",")
		case "genreMode":
			f.GenreMode = value
		case "sort":
			f.Sort = value
		case "v":
			if value != "1" {
				return f, errors.New("Only URL version 1 is supported.")
			}
		case "yearMin", "yearMax", "runtimeMin", "runtimeMax", "page":
			if !integerValue.MatchString(value) {
				return f, errors.New("Numeric filters must be whole positive integers.")
			}
			n, err := strconv.ParseInt(value, 10, 32)
			if err != nil {
				return f, errors.New("A numeric filter is outside the supported range.")
			}
			number := int32(n)
			switch key {
			case "yearMin":
				f.YearMin = &number
			case "yearMax":
				f.YearMax = &number
			case "runtimeMin":
				f.RuntimeMin = &number
			case "runtimeMax":
				f.RuntimeMax = &number
			case "page":
				f.Page = number
			}
		default:
			return f, errors.New("An unsupported query parameter was supplied.")
		}
	}
	return f, f.Validate()
}
