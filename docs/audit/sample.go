// Package audit exposes only the frozen public title/year sampling manifest.
package audit

import _ "embed"

//go:embed sample.json
var SampleJSON string
