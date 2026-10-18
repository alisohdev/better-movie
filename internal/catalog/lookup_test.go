package catalog

import (
	"strings"
	"testing"
)

func TestValidateLookup(t *testing.T) {
	for _, query := range []string{"", " \t\n", "يَك\u200cفیلم", "Orbit مدار 2", "a' OR 1=1 --", "%_", strings.Repeat("ی", 120)} {
		if err := ValidateLookup(query); err != nil {
			t.Fatalf("valid %q: %v", query, err)
		}
	}
	for _, query := range []string{strings.Repeat("a", 121), strings.Repeat("ی", 121), "a\x00", "\xff", "a\u202eb", "a\u200fb"} {
		if ValidateLookup(query) == nil {
			t.Fatalf("accepted invalid query %q", query)
		}
	}
}
