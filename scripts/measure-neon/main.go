package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
)

func main() {
	raw := os.Getenv("DATABASE_URL")
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" {
		panic("database URL unavailable")
	}
	q := u.Query()
	q.Set("sslmode", "verify-full")
	u.RawQuery = q.Encode()
	samples := make([]map[string]any, 0, 6)
	for i := 0; i < 6; i++ {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		start := time.Now()
		c, e := pgx.Connect(ctx, u.String())
		if e != nil {
			fmt.Fprintln(os.Stderr, "verified database connection failed")
			os.Exit(1)
		}
		connect := time.Since(start)
		var one int
		var serverStart time.Time
		e = c.QueryRow(ctx, "SELECT 1, pg_postmaster_start_time()").Scan(&one, &serverStart)
		total := time.Since(start)
		c.Close(ctx)
		cancel()
		if e != nil || one != 1 {
			panic("read-only probe failed")
		}
		samples = append(samples, map[string]any{"sample": i, "postmasterStart": serverStart.UTC().Format(time.RFC3339), "connectMs": float64(connect.Microseconds()) / 1000, "connectAndQueryMs": float64(total.Microseconds()) / 1000})
	}
	json.NewEncoder(os.Stdout).Encode(map[string]any{"timestamp": time.Now().UTC().Format(time.RFC3339), "tls": "verify-full", "scope": "Six separate pooled-host TLS connections and SELECT 1 from this workstation. First request after documented idle interval is a wake-up candidate; endpoint suspension status is unobserved. Includes WAN, TLS, authentication and pooler, not isolated compute wake-up.", "errors": 0, "samples": samples})
}
