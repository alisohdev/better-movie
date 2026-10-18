package database

import (
	"context"
	"errors"
	"net"
	"net/url"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrConfiguration = errors.New("database configuration is unavailable or invalid")

// Config accepts verified TLS remotely and explicit plaintext only on loopback.
// Parsing errors are deliberately not returned: a driver error can include a URL.
func Config(rawURL string) (*pgxpool.Config, error) {
	u, err := url.Parse(rawURL)
	if err != nil || (u.Scheme != "postgres" && u.Scheme != "postgresql") || u.Hostname() == "" {
		return nil, ErrConfiguration
	}
	values, err := url.ParseQuery(u.RawQuery)
	if err != nil || len(values["sslmode"]) != 1 {
		return nil, ErrConfiguration
	}
	mode := values.Get("sslmode")
	if mode != "verify-full" && mode != "disable" {
		return nil, ErrConfiguration
	}
	config, err := pgxpool.ParseConfig(rawURL)
	if err != nil {
		return nil, ErrConfiguration
	}
	loopback := func(host string) bool {
		if strings.EqualFold(host, "localhost") {
			return true
		}
		ip := net.ParseIP(host)
		return ip != nil && ip.IsLoopback()
	}
	if mode == "disable" {
		if !loopback(config.ConnConfig.Host) {
			return nil, ErrConfiguration
		}
		for _, fallback := range config.ConnConfig.Fallbacks {
			if !loopback(fallback.Host) {
				return nil, ErrConfiguration
			}
		}
	} else if config.ConnConfig.TLSConfig == nil || config.ConnConfig.TLSConfig.InsecureSkipVerify || config.ConnConfig.TLSConfig.ServerName == "" {
		return nil, ErrConfiguration
	}
	config.MaxConns = 2
	config.MinConns = 0
	config.MinIdleConns = 0
	config.MaxConnLifetime = 5 * time.Minute
	config.MaxConnIdleTime = time.Minute
	config.HealthCheckPeriod = 30 * time.Second
	config.ConnConfig.ConnectTimeout = 3 * time.Second
	return config, nil
}

func Open(ctx context.Context, rawURL string) (*pgxpool.Pool, error) {
	config, err := Config(rawURL)
	if err != nil {
		return nil, err
	}
	return pgxpool.NewWithConfig(ctx, config)
}
