package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"bettermovie/httpapi"
)

func main() {
	app := httpapi.NewFromEnvironment()
	defer app.Close()
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	address := ":" + port
	if os.Getenv("CATALOG_REVISION") != "" && os.Getenv("CATALOG_REVISION") != "synthetic-v1" && os.Getenv("TMDB_PUBLICATION_APPROVED") != "1" {
		address = "127.0.0.1:" + port
	}
	server := &http.Server{
		Addr: address, Handler: app,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    16 << 10,
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdown)
	}()
	log.Printf("catalog API listening on port %s", port)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal("catalog API server failed")
	}
}
