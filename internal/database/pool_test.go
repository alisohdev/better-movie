package database

import (
	"errors"
	"strings"
	"testing"
)

func TestDatabaseTransportPolicy(t *testing.T) {
	for _, test := range []struct {
		name, connection string
		valid            bool
	}{
		{"local IPv4", "postgres://movie@127.0.0.1:55432/movie_discovery?sslmode=disable", true},
		{"localhost", "postgres://movie@localhost/movie?sslmode=disable", true},
		{"local IPv6", "postgres://movie@[::1]/movie?sslmode=disable", true},
		{"verified remote", "postgres://movie@db.example.test/movie?sslmode=verify-full", true},
		{"empty", "", false},
		{"wrong scheme", "https://db.example.test/movie?sslmode=verify-full", false},
		{"missing TLS policy", "postgres://movie@db.example.test/movie", false},
		{"remote plaintext", "postgres://movie@db.example.test/movie?sslmode=disable", false},
		{"unverified remote", "postgres://movie@db.example.test/movie?sslmode=require", false},
		{"opportunistic local", "postgres://movie@localhost/movie?sslmode=prefer", false},
		{"duplicate TLS policy", "postgres://movie@localhost/movie?sslmode=disable&sslmode=verify-full", false},
		{"remote host override", "postgres://movie@localhost/movie?sslmode=disable&host=db.example.test", false},
		{"unix host override", "postgres://movie@localhost/movie?sslmode=disable&host=%2Ftmp", false},
		{"mixed plaintext hosts", "postgres://movie@localhost,db.example.test/movie?sslmode=disable", false},
	} {
		t.Run(test.name, func(t *testing.T) {
			config, err := Config(test.connection)
			if test.valid {
				if err != nil {
					t.Fatal("valid transport policy rejected:", err)
				}
				if config.MaxConns != 2 || config.MinConns != 0 || config.MinIdleConns != 0 {
					t.Fatal("serverless connection budget is not bounded")
				}
				if strings.Contains(test.connection, "verify-full") &&
					(config.ConnConfig.TLSConfig == nil || config.ConnConfig.TLSConfig.InsecureSkipVerify || config.ConnConfig.TLSConfig.ServerName == "") {
					t.Fatal("remote TLS does not verify the server")
				}
			} else if !errors.Is(err, ErrConfiguration) {
				t.Fatal("invalid transport policy was accepted")
			}
		})
	}
}

func TestConfigurationErrorsDoNotContainCredentials(t *testing.T) {
	_, err := Config("postgres://movie:private-secret@db.example.test/movie?sslmode=disable")
	if err == nil || strings.Contains(err.Error(), "private-secret") || strings.Contains(err.Error(), "postgres://") {
		t.Fatal("configuration error exposed connection details")
	}
}
