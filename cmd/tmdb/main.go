// tmdb is an explicit operator tool. No token is needed for mapping, staging or tests.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"bettermovie/internal/database"
	"bettermovie/internal/tmdb"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err.Error())
		os.Exit(1)
	}
}
func run() error {
	if len(os.Args) < 2 {
		return errors.New("usage: tmdb mapping | import | report | stage")
	}
	command := os.Args[1]
	flags := flag.NewFlagSet(command, flag.ContinueOnError)
	mapping := flags.String("mapping", "", "private manual mapping JSON")
	checkpoint := flags.String("checkpoint", "", "private checkpoint JSON")
	out := flags.String("out", "", "private completed artifact JSON")
	artifact := flags.String("artifact", "", "private artifact to stage")
	limit := flags.Int("limit", 40, "maximum selected IDs to attempt (1–40)")
	isolated := flags.Bool("isolated-database", false, "confirm dedicated local/staging database")
	if flags.Parse(os.Args[2:]) != nil || flags.NArg() != 0 {
		return errors.New("invalid command arguments")
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	ctx, cancel := context.WithTimeout(ctx, 20*time.Minute)
	defer cancel()
	switch command {
	case "mapping":
		return json.NewEncoder(os.Stdout).Encode(tmdb.MappingTemplate())
	case "import":
		// These are operator acknowledgements, not assertions of legal clearance.
		if os.Getenv("TMDB_ACCESS_APPROVED") != "1" || os.Getenv("TMDB_TERMS_REFERENCE") == "" {
			return errors.New("private access acknowledgement and accepted-terms reference required")
		}
		if *mapping == "" || *checkpoint == "" || *out == "" || *mapping == *checkpoint || *mapping == *out || *checkpoint == *out {
			return errors.New("distinct private mapping, checkpoint and output paths required")
		}
		var selection tmdb.Mapping
		if tmdb.Read(*mapping, &selection) != nil || selection.Validate() != nil {
			return errors.New("invalid reviewed sample mapping")
		}
		var saved tmdb.Checkpoint
		if _, err := os.Stat(*checkpoint); err == nil {
			if tmdb.Read(*checkpoint, &saved) != nil {
				return errors.New("invalid private checkpoint")
			}
		} else if !os.IsNotExist(err) {
			return errors.New("checkpoint unavailable")
		}
		client, err := tmdb.NewClient(os.Getenv("TMDB_READ_ACCESS_TOKEN"))
		if err != nil {
			return err
		}
		saved, completed, err := tmdb.Import(ctx, selection, saved, client, *limit, os.Getenv("TMDB_RETAIN_UNTIL"), time.Now(), func(value tmdb.Checkpoint) error { return tmdb.WritePrivate(*checkpoint, value) })
		summary := struct {
			Selected, Complete int
			ArtifactReady      bool `json:"artifactReady"`
		}{Selected: len(selection.Movies), ArtifactReady: completed != nil}
		for _, r := range saved.Results {
			if r.Movie != nil {
				summary.Complete++
			}
		}
		if err == nil {
			err = tmdb.WritePrivate(*out, completed)
		}
		if err != nil {
			summary.ArtifactReady = false
		}
		_ = json.NewEncoder(os.Stdout).Encode(summary)
		return err
	case "report":
		if *checkpoint == "" {
			return errors.New("report requires --checkpoint")
		}
		var saved tmdb.Checkpoint
		if tmdb.Read(*checkpoint, &saved) != nil || saved.SampleHash != tmdb.SampleHash {
			return errors.New("invalid private checkpoint")
		}
		type status struct {
			SampleID string `json:"sampleId"`
			Code     string `json:"code"`
		}
		rows := []status{}
		for _, r := range saved.Results {
			rows = append(rows, status{r.SampleID, r.Code})
		}
		return json.NewEncoder(os.Stdout).Encode(rows)
	case "stage":
		if !*isolated || *artifact == "" {
			return errors.New("stage requires --artifact and --isolated-database acknowledgement")
		}
		var projection tmdb.Artifact
		if tmdb.Read(*artifact, &projection) != nil {
			return errors.New("private completed artifact unavailable")
		}
		if _, err := projection.Movies(time.Now()); err != nil {
			return err
		}
		pool, err := database.Open(ctx, os.Getenv("TMDB_STAGING_DATABASE_URL"))
		if err != nil {
			return errors.New("isolated staging database configuration invalid")
		}
		defer pool.Close()
		if tmdb.Stage(ctx, pool, projection) != nil {
			return errors.New("staging failed; no activation performed; inspect isolated database access/state")
		}
		return json.NewEncoder(os.Stdout).Encode(map[string]string{"revision": projection.CatalogRevision, "schema": tmdb.Schema(projection.CatalogRevision), "state": "staged; not published"})
	default:
		return errors.New("usage: tmdb mapping | import | report | stage")
	}
}
