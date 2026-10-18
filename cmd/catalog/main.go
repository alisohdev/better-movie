package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"time"

	"bettermovie/db"
	"bettermovie/internal/catalog"
	"bettermovie/internal/database"
)

func main() {
	if len(os.Args) < 2 || (os.Args[1] != "migrate" && os.Args[1] != "seed") {
		fmt.Fprintln(os.Stderr, "usage: go run ./cmd/catalog migrate | seed [-file catalog/movies.json]")
		os.Exit(2)
	}
	flags := flag.NewFlagSet(os.Args[1], flag.ExitOnError)
	file := flags.String("file", "catalog/movies.json", "owned synthetic catalog JSON")
	_ = flags.Parse(os.Args[2:])
	if flags.NArg() != 0 || (os.Args[1] == "migrate" && len(os.Args) != 2) {
		fmt.Fprintln(os.Stderr, "unexpected command arguments")
		os.Exit(2)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	pool, err := database.Open(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		fmt.Fprintln(os.Stderr, "database configuration is unavailable or invalid")
		os.Exit(1)
	}
	defer pool.Close()
	if os.Args[1] == "migrate" {
		if err = db.Migrate(ctx, pool); err != nil {
			fmt.Fprintln(os.Stderr, "catalog migration failed; check database access and migration state")
			os.Exit(1)
		}
		fmt.Println("catalog migrations applied")
		return
	}
	reader, err := os.Open(*file)
	if err != nil {
		fmt.Fprintln(os.Stderr, "unable to open the synthetic catalog fixture")
		os.Exit(1)
	}
	defer reader.Close()
	fixture, err := catalog.ReadFixture(reader)
	if err != nil {
		fmt.Fprintln(os.Stderr, "synthetic catalog fixture is invalid")
		os.Exit(1)
	}
	if err = catalog.Seed(ctx, pool, fixture); err != nil {
		fmt.Fprintln(os.Stderr, "catalog seed failed; check database access and migration state")
		os.Exit(1)
	}
	fmt.Printf("seeded %d owned synthetic movies at %s\n", len(fixture.Movies), fixture.CatalogRevision)
}
